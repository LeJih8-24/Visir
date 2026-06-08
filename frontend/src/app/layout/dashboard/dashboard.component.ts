import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskManagerComponent } from '../../components/task-manager/task-manager.component';
// Si tu as déjà généré les autres composants, décommente les lignes ci-dessous :
// import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ChatInterfaceComponent } from '../../components/chat-interface/chat-interface.component';
import { QuickNotesComponent } from '../../components/quick-notes/quick-notes.component';
import { AgendaComponent } from '../../components/agenda/agenda.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TaskManagerComponent,
    ChatInterfaceComponent,
    AgendaComponent,
    // SidebarComponent,
    QuickNotesComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {

}