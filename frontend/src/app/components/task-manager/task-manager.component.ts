import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService, Task } from '../../services/task.service';

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-manager.component.html'
})
export class TaskManagerComponent implements OnInit {
  tasks: Task[] = [];
  newTaskTitle: string = '';

  // Variables pour gérer l'édition en ligne
  editingTaskId: number | undefined | null = null;
  editTaskTitle: string = '';

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.taskService.getTasks().subscribe({
      next: (data) => this.tasks = data,
      error: (err) => console.error('Erreur lors du chargement des tâches', err)
    });
  }

  addTask(): void {
    if (!this.newTaskTitle.trim()) return;
    
    const newTask: Task = { title: this.newTaskTitle, priority: 'normale' };
    this.taskService.createTask(newTask).subscribe({
      next: (task) => {
        this.tasks.push(task);
        this.newTaskTitle = '';
      }
    });
  }

  toggleCompletion(task: Task): void {
    const updatedStatus = !task.is_completed;
    this.taskService.updateTask(task.id!, { is_completed: updatedStatus }).subscribe({
      next: () => task.is_completed = updatedStatus
    });
  }

  // --- NOUVELLES MÉTHODES DE GESTION ---

  deleteTask(id: number | undefined): void {
    if (!id) return;
    this.taskService.deleteTask(id).subscribe({
      next: () => {
        // On retire la tâche du tableau visuel une fois supprimée en base
        this.tasks = this.tasks.filter(t => t.id !== id);
      },
      error: (err) => console.error('Erreur lors de la suppression', err)
    });
  }

  startEdit(task: Task): void {
    this.editingTaskId = task.id;
    this.editTaskTitle = task.title;
  }

  cancelEdit(): void {
    this.editingTaskId = null;
    this.editTaskTitle = '';
  }

  saveEdit(task: Task): void {
    if (!task.id || !this.editTaskTitle.trim()) {
      this.cancelEdit();
      return;
    }

    this.taskService.updateTask(task.id, { title: this.editTaskTitle }).subscribe({
      next: (updatedTask) => {
        // On met à jour l'affichage
        task.title = updatedTask.title;
        this.cancelEdit();
      },
      error: (err) => console.error('Erreur lors de la modification', err)
    });
  }
}