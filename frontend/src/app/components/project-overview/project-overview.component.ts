import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MacroService } from '../../services/macro.service';

@Component({
  selector: 'app-project-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-overview.component.html',
  styleUrls: ['./project-overview.component.scss'],
  host: {
    class: 'block w-full h-full'
  }
})
export class ProjectOverviewComponent implements OnInit {
  isEditMode = false;
  selectedMilestoneId: string | null = null;
  modalData: { title: string, start_date: string, end_date: string } = { title: '', start_date: '', end_date: '' };

  projectNotes: any[] = [];
  newNoteContent: string = '';

  // Kanban Tasks
  todoTasks: any[] = [];
  inProgressTasks: any[] = [];
  doneTasks: any[] = [];
  newTaskTitle: string = '';
  draggedTask: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private macroService: MacroService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEditMode = true;
      this.selectedMilestoneId = id;
      this.loadProjectDetails(id);
      this.loadProjectNotes(id);
      this.loadProjectTasks(id);
    } else {
      this.isEditMode = false;
    }
  }

  loadProjectDetails(id: string): void {
    this.macroService.getRoadmap().subscribe({
      next: (data) => {
        const project = data.find(p => p.id.toString() === id);
        if (project) {
          this.modalData = {
            title: project.title,
            start_date: project.start_date.split('T')[0],
            end_date: project.end_date.split('T')[0]
          };
          this.cdr.detectChanges();
        } else {
          console.error('Projet non trouvé');
          this.goBack();
        }
      },
      error: (err) => console.error('Erreur chargement Roadmap:', err)
    });
  }

  goBack(): void {
    this.router.navigate(['/macrovision']);
  }

  saveMilestone(): void {
    if (!this.modalData.title || !this.modalData.start_date || !this.modalData.end_date) return;

    if (this.isEditMode && this.selectedMilestoneId) {
      this.macroService.updateMilestone(this.selectedMilestoneId, this.modalData).subscribe({
        next: () => this.goBack(),
        error: (err) => console.error('Erreur MAJ projet:', err)
      });
    } else {
      this.macroService.createMilestone(this.modalData).subscribe({
        next: () => this.goBack(),
        error: (err) => console.error('Erreur création projet:', err)
      });
    }
  }

  deleteMilestone(): void {
    if (this.isEditMode && this.selectedMilestoneId) {
      if(confirm('Êtes-vous sûr de vouloir supprimer ce projet et toutes ses notes ?')) {
        this.macroService.deleteMilestone(this.selectedMilestoneId).subscribe({
          next: () => this.goBack(),
          error: (err) => console.error('Erreur suppression projet:', err)
        });
      }
    }
  }

  // --- Gestion des Notes ---
  loadProjectNotes(projectId: string): void {
    this.macroService.getProjectNotes(projectId).subscribe({
      next: (notes) => {
        this.projectNotes = notes;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur chargement notes:', err)
    });
  }

  addProjectNote(): void {
    if (!this.newNoteContent.trim() || !this.selectedMilestoneId) return;
    this.macroService.addProjectNote(this.selectedMilestoneId, { content: this.newNoteContent }).subscribe({
      next: () => {
        this.newNoteContent = '';
        this.loadProjectNotes(this.selectedMilestoneId as string);
      },
      error: (err) => console.error('Erreur ajout note:', err)
    });
  }

  deleteProjectNote(noteId: number): void {
    if (!this.selectedMilestoneId) return;
    this.macroService.deleteProjectNote(this.selectedMilestoneId, noteId).subscribe({
      next: () => {
        this.projectNotes = this.projectNotes.filter(n => n.id !== noteId);
      },
      error: (err) => console.error('Erreur suppression note:', err)
    });
  }

  // --- Gestion du Kanban (Tâches) ---
  loadProjectTasks(projectId: string): void {
    this.macroService.getProjectTasks(projectId).subscribe({
      next: (tasks) => {
        this.todoTasks = tasks.filter(t => t.status === 'todo');
        this.inProgressTasks = tasks.filter(t => t.status === 'in_progress');
        this.doneTasks = tasks.filter(t => t.status === 'done');
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur chargement tâches:', err)
    });
  }

  addProjectTask(): void {
    if (!this.newTaskTitle.trim() || !this.selectedMilestoneId) return;
    this.macroService.createProjectTask(this.selectedMilestoneId, { title: this.newTaskTitle, status: 'todo' }).subscribe({
      next: () => {
        this.newTaskTitle = '';
        this.loadProjectTasks(this.selectedMilestoneId as string);
      },
      error: (err) => console.error('Erreur ajout tâche:', err)
    });
  }

  deleteProjectTask(taskId: number): void {
    if (!this.selectedMilestoneId) return;
    this.macroService.deleteProjectTask(this.selectedMilestoneId, taskId).subscribe({
      next: () => this.loadProjectTasks(this.selectedMilestoneId as string),
      error: (err) => console.error('Erreur suppression tâche:', err)
    });
  }

  updateTaskStatus(task: any, newStatus: string): void {
    if (!this.selectedMilestoneId || task.status === newStatus) return;
    
    // Update local state for immediate feedback
    task.status = newStatus;
    
    this.macroService.updateProjectTask(this.selectedMilestoneId, task.id, { status: newStatus }).subscribe({
      next: () => this.loadProjectTasks(this.selectedMilestoneId as string),
      error: (err) => {
        console.error('Erreur maj statut:', err);
        this.loadProjectTasks(this.selectedMilestoneId as string); // Rollback on error
      }
    });
  }

  // Drag and Drop Handlers
  onDragStart(task: any, event: DragEvent): void {
    this.draggedTask = task;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify(task));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault(); // Necessary to allow dropping
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(newStatus: string, event: DragEvent): void {
    event.preventDefault();
    if (this.draggedTask) {
      this.updateTaskStatus(this.draggedTask, newStatus);
      this.draggedTask = null;
    }
  }
}
