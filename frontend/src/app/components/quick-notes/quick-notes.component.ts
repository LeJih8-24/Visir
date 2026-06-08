import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NoteService, Note } from '../../services/note.service';
import { SyncService } from '../../services/sync.service';

@Component({
  selector: 'app-quick-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quick-notes.component.html'
})
export class QuickNotesComponent implements OnInit {
  notes: Note[] = [];
  newNoteContent: string = '';

  constructor(
    private noteService: NoteService,
    private syncService: SyncService, // Écoute le canal radio de l'IA
    private cdr: ChangeDetectorRef   // Force le rafraîchissement instantané
  ) {}

  ngOnInit(): void {
    this.loadNotes();

    // Connexion au bus de synchronisation
    this.syncService.refreshNeeded$.subscribe(() => {
      this.loadNotes();
    });
  }

  loadNotes(): void {
    this.noteService.getNotes().subscribe({
      next: (data) => {
        this.notes = data;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur au chargement des notes', err)
    });
  }

  addNote(): void {
    if (!this.newNoteContent.trim()) return;

    this.noteService.createNote({ content: this.newNoteContent }).subscribe({
      next: () => {
        this.newNoteContent = '';
        this.loadNotes();
      }
    });
  }

  deleteNote(id: number | undefined): void {
    if (!id) return;
    this.noteService.deleteNote(id).subscribe({
      next: () => {
        this.notes = this.notes.filter(n => n.id !== id);
        this.cdr.detectChanges();
      }
    });
  }
}