import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list'; // <-- Ajout du plugin de Liste (Design iOS mobile)
import { AgendaService } from '../../services/agenda.service';
import { SyncService } from '../../services/sync.service';

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.scss'], // Assure-toi que cette ligne est présente pour le style iOS
  host: {
    class: 'block h-[80vh] w-full' 
  }
})
export class AgendaComponent implements OnInit {
  
  // Fenêtre de création (Style iOS)
  isModalOpen: boolean = false;
  newEventTitle: string = '';
  newEventStart: Date | null = null;
  newEventEnd: Date | null = null;

  // Fenêtre de détails / suppression
  isDetailsModalOpen: boolean = false;
  selectedEventDetails: any = null;

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
    // Affichage intelligent : Liste sur mobile, Grille sur PC
    initialView: window.innerWidth < 768 ? 'listWeek' : 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listWeek'
    },
    events: [],
    slotDuration: '00:30:00',
    height: 'auto',       // La grille s'adapte à l'écran sans créer de double scrollbar
    locale: 'fr',
    firstDay: 1,
    nowIndicator: true,
    selectable: true, // Permet de glisser pour sélectionner une plage horaire
    selectMirror: true,
    dayMaxEvents: true,
    eventDisplay: 'block',
    slotMinTime: '06:00:00',
    slotMaxTime: '24:00:00',
    allDaySlot: false,

    // Remplacement de dateClick par "select" pour gérer les plages horaires
    select: this.handleDateSelect.bind(this),
    eventClick: this.handleEventClick.bind(this),

    // Rendre l'agenda responsive en direct
    windowResize: (arg) => {
      if (window.innerWidth < 768) {
        arg.view.calendar.changeView('listWeek');
      } else {
        arg.view.calendar.changeView('timeGridWeek');
      }
    }
  };

  constructor(
    private agendaService: AgendaService,
    private syncService: SyncService,
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
        // FullCalendar attend un format spécifique (les couleurs Apple seront gérées en CSS)
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

  // ==========================================
  // LOGIQUE DE CRÉATION (MODALE iOS)
  // ==========================================

  handleDateSelect(selectInfo: any) {
    console.log("Clic détecté sur l'agenda !", selectInfo);
    this.newEventStart = selectInfo.start;
    this.newEventEnd = selectInfo.end;
    this.newEventTitle = '';
    this.isModalOpen = true;
    
    // Déselectionne la grille visuellement après l'ouverture de la modale
    const calendarApi = selectInfo.view.calendar;
    calendarApi.unselect(); 
    this.cdr.detectChanges();
    console.log("État de isModalOpen :", this.isModalOpen);
  }

  closeModal() {
    this.isModalOpen = false;
    this.newEventTitle = '';
    this.newEventStart = null;
    this.newEventEnd = null;
  }

  saveEvent() {
    if (!this.newEventTitle.trim() || !this.newEventStart || !this.newEventEnd) return;

    // Fonction utilitaire pour formater la date pour FastAPI (YYYY-MM-DD HH:MM:SS)
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatForDB = (dateObj: Date) => {
      return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:00`;
    };

    const newEvent = { 
      title: this.newEventTitle, 
      start_time: formatForDB(this.newEventStart), 
      end_time: formatForDB(this.newEventEnd) 
    };

    this.agendaService.createEvent(newEvent).subscribe({
      next: () => {
        this.loadEvents();
        this.closeModal();
      }
    });
  }

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