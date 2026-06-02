import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { AgendaService } from '../../services/agenda.service';

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [CommonModule, FullCalendarModule],
  templateUrl: './agenda.component.html'
})
export class AgendaComponent implements OnInit {
  
  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, interactionPlugin],
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek'
    },
    events: [], // Sera rempli par l'API
    height: '100%',
    locale: 'fr', // Pour avoir les jours en français
    eventColor: '#0d9488', // La couleur teal-600 de Tailwind
    dateClick: this.handleDateClick.bind(this),
  };

  constructor(private agendaService: AgendaService) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.agendaService.getEvents().subscribe({
      next: (data) => {
        // On formate les données reçues de FastAPI pour FullCalendar
        const formattedEvents = data.map(evt => ({
          id: evt.id?.toString(),
          title: evt.title,
          start: evt.start_time,
          end: evt.end_time
        }));
        // On met à jour les options du calendrier
        this.calendarOptions = { ...this.calendarOptions, events: formattedEvents };
      },
      error: (err) => console.error('Erreur lors du chargement de l\'agenda', err)
    });
  }

  handleDateClick(arg: any) {
    // Pour l'instant, un simple log. 
    // Plus tard, on pourra ouvrir une modale pour ajouter un événement manuellement.
    console.log('Date cliquée :', arg.dateStr);
  }
}