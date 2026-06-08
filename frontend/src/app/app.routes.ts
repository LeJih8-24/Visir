import { Routes } from '@angular/router';
import { ChatInterfaceComponent } from './components/chat-interface/chat-interface.component';
import { AgendaComponent } from './components/agenda/agenda.component';
import { TaskManagerComponent } from './components/task-manager/task-manager.component';
import { QuickNotesComponent } from './components/quick-notes/quick-notes.component';

export const routes: Routes = [
  { path: 'chat', component: ChatInterfaceComponent },
  { path: 'agenda', component: AgendaComponent },
  { path: 'tasks', component: TaskManagerComponent },
  { path: 'notes', component: QuickNotesComponent },
  // Redirection par défaut : si l'utilisateur arrive sur '/', il va directement sur le chat
  { path: '', redirectTo: 'chat', pathMatch: 'full' },
  { path: '**', redirectTo: 'chat' } // Sécurité pour les routes inconnues
];