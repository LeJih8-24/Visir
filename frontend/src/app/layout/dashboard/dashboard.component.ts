import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskManagerComponent } from '../../components/task-manager/task-manager.component';
// Si tu as déjà généré les autres composants, décommente les lignes ci-dessous :
// import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ChatInterfaceComponent } from '../../components/chat-interface/chat-interface.component';
// import { QuickNoteComponent } from '../../components/quick-note/quick-note.component';
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
    // QuickNoteComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {

}