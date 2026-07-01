import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MacroService } from '../../services/macro.service';

@Component({
  selector: 'app-macro-vision',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './macro-vision.component.html',
  styleUrls: ['./macro-vision.component.scss'],
  host: {
    class: 'block w-full h-full'
  }
})
export class MacroVisionComponent implements OnInit {
  projects: any[] = [];
  
  // État de la modale
  isModalOpen = false;
  isEditMode = false;
  selectedMilestoneId: string | null = null;
  modalData: { title: string, start_date: string, end_date: string } = { title: '', start_date: '', end_date: '' };

  // État des notes de projet
  projectNotes: any[] = [];
  newNoteContent: string = '';

  constructor(private macroService: MacroService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadRoadmap();
  }

  loadRoadmap(): void {
    this.macroService.getRoadmap().subscribe({
      next: (data) => {
        this.projects = data.map(item => ({
          id: item.id.toString(),
          name: item.title,
          start: item.start_date.split('T')[0],
          end: item.end_date.split('T')[0],
          status: item.status || 'Planifié',
          color_hex: item.color_hex || '#8b5cf6'
        }));
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur chargement Roadmap:', err)
    });
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedMilestoneId = null;
    this.modalData = { title: '', start_date: '', end_date: '' };
    this.projectNotes = [];
    this.newNoteContent = '';
    this.isModalOpen = true;
  }

  openEditModal(project: any): void {
    this.isEditMode = true;
    this.selectedMilestoneId = project.id;
    this.modalData = {
      title: project.name,
      start_date: project.start,
      end_date: project.end
    };
    this.isModalOpen = true;
    this.loadProjectNotes(project.id);
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedMilestoneId = null;
  }

  saveMilestone(): void {
    if (!this.modalData.title || !this.modalData.start_date || !this.modalData.end_date) return;

    if (this.isEditMode && this.selectedMilestoneId) {
      this.macroService.updateMilestone(this.selectedMilestoneId, this.modalData).subscribe({
        next: () => {
          this.closeModal();
          this.loadRoadmap();
        },
        error: (err) => console.error('Erreur MAJ projet:', err)
      });
    } else {
      this.macroService.createMilestone(this.modalData).subscribe({
        next: () => {
          this.closeModal();
          this.loadRoadmap();
        },
        error: (err) => console.error('Erreur création projet:', err)
      });
    }
  }

  deleteMilestone(): void {
    if (this.isEditMode && this.selectedMilestoneId) {
      if(confirm('Êtes-vous sûr de vouloir supprimer ce projet et toutes ses notes ?')) {
        this.macroService.deleteMilestone(this.selectedMilestoneId).subscribe({
          next: () => {
            this.closeModal();
            this.loadRoadmap();
          },
          error: (err) => console.error('Erreur suppression projet:', err)
        });
      }
    }
  }

  // --- Gestion des Notes de Projet ---

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
}