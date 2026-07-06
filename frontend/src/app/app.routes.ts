import { Routes } from '@angular/router';
import { ChatInterfaceComponent } from './components/chat-interface/chat-interface.component';
import { AgendaComponent } from './components/agenda/agenda.component';
import { TaskManagerComponent } from './components/task-manager/task-manager.component';
import { QuickNotesComponent } from './components/quick-notes/quick-notes.component';
import { MacroVisionComponent } from './components/macro-vision/macro-vision.component';
import { ProjectOverviewComponent } from './components/project-overview/project-overview.component';
import { NewsPortalComponent } from './components/news-portal/news-portal.component';

export const routes: Routes = [
  { path: 'chat', component: ChatInterfaceComponent },
  { path: 'agenda', component: AgendaComponent },
  { path: 'tasks', component: TaskManagerComponent },
  { path: 'notes', component: QuickNotesComponent },
  { path: 'macrovision', component: MacroVisionComponent },
  { path: 'macrovision/new', component: ProjectOverviewComponent },
  { path: 'macrovision/:id', component: ProjectOverviewComponent },
  { path: 'news', component: NewsPortalComponent },
  // Redirection par défaut : si l'utilisateur arrive sur '/', il va directement sur le chat
  { path: '', redirectTo: 'chat', pathMatch: 'full' },
  { path: '**', redirectTo: 'chat' } // Sécurité pour les routes inconnues
];