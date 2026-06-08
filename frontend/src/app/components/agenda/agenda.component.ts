import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { AgendaService } from '../../services/agenda.service';
import { SyncService } from '../../services/sync.service'; // Réintégration de la synchro

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule],
  templateUrl: './agenda.component.html',
  // =======================================================================
  // LE CORRECTIF MAJEUR : Force la balise hôte à occuper tout l'espace disponible
  // =======================================================================
  host: {
    class: 'block h-full w-full'
  }
})
export class AgendaComponent implements OnInit {
  
  calendarOptions: CalendarOptions = {
    initialView: 'timeGridWeek',
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    events: [],
    height: '100%',
    locale: 'fr',
    eventColor: '#0d9488',
    eventDisplay: 'block',
    nowIndicator: true,
    slotMinTime: '06:00:00',
    slotMaxTime: '24:00:00',
    allDaySlot: false,

    dateClick: this.handleDateClick.bind(this),
    eventClick: this.handleEventClick.bind(this),
  };

  isModalOpen: boolean = false;
  selectedDate: string = '';
  newEventTitle: string = '';
  newEventTime: string = '12:00';

  isDetailsModalOpen: boolean = false;
  selectedEventDetails: any = null;

  constructor(
    private agendaService: AgendaService,
    private syncService: SyncService, // Injection de la synchro
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadEvents();

    // Tendre l'oreille aux signaux radio du Terminal IA
    this.syncService.refreshNeeded$.subscribe(() => {
      this.loadEvents();
    });
  }

  loadEvents(): void {
    this.agendaService.getEvents().subscribe({
      next: (data) => {
        const formattedEvents = data.map(evt => ({
          id: evt.id?.toString(),
          title: evt.title,
          start: evt.start_time,
          end: evt.end_time
        }));
        this.calendarOptions = { ...this.calendarOptions, events: formattedEvents };
        this.cdr.detectChanges(); 
      },
      error: (err) => console.error('Erreur lors du chargement de l\'agenda', err)
    });
  }

  // --- LOGIQUE DE CRÉATION ---

  handleDateClick(arg: any) {
    const dateObj = new Date(arg.date);
    const pad = (n: number) => n.toString().padStart(2, '0');

    this.selectedDate = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;

    if (!arg.allDay) {
      this.newEventTime = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
    } else {
      this.newEventTime = '12:00';
    }

    this.isModalOpen = true;
    this.cdr.detectChanges();
  }

  closeModal() {
    this.isModalOpen = false;
    this.newEventTitle = '';
    this.newEventTime = '12:00';
  }

  saveEvent() {
    if (!this.newEventTitle.trim()) return;

    const startDateTime = `${this.selectedDate} ${this.newEventTime}:00`;
    const endDateObj = new Date(startDateTime);
    endDateObj.setHours(endDateObj.getHours() + 1);
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    const endDateTime = `${endDateObj.getFullYear()}-${pad(endDateObj.getMonth() + 1)}-${pad(endDateObj.getDate())} ${pad(endDateObj.getHours())}:${pad(endDateObj.getMinutes())}:00`;

    const newEvent = { title: this.newEventTitle, start_time: startDateTime, end_time: endDateTime };

    this.agendaService.createEvent(newEvent).subscribe({
      next: () => {
        this.loadEvents();
        this.closeModal();
      }
    });
  }

  // --- LOGIQUE DE LECTURE / SUPPRESSION ---

  handleEventClick(arg: any) {
    const event = arg.event;
    const formatOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
    
    this.selectedEventDetails = {
      id: event.id,
      title: event.title,
      startFormatted: event.start ? new Intl.DateTimeFormat('fr-FR', formatOptions).format(event.start) : '',
      endFormatted: event.end ? new Intl.DateTimeFormat('fr-FR', formatOptions).format(event.end) : 'Non spécifié'
    };

    this.isDetailsModalOpen = true;
    this.cdr.detectChanges();
  }

  closeDetailsModal() {
    this.isDetailsModalOpen = false;
    this.selectedEventDetails = null;
    this.cdr.detectChanges();
  }

  deleteSelectedEvent() {
    if (!this.selectedEventDetails || !this.selectedEventDetails.id) return;

    this.agendaService.deleteEvent(this.selectedEventDetails.id).subscribe({
      next: () => {
        this.loadEvents(); 
        this.closeDetailsModal(); 
      },
      error: (err) => console.error('Erreur lors de la suppression', err)
    });
  }
}