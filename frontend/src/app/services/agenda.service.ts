import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AppEvent {
  id?: number;
  title: string;
  start_time: string;
  end_time?: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AgendaService {
  private apiUrl = '/api/events/';

  constructor(private http: HttpClient) { }

  getEvents(): Observable<AppEvent[]> {
    return this.http.get<AppEvent[]>(this.apiUrl);
  }

  createEvent(eventData: any): Observable<any> {
    return this.http.post(this.apiUrl, eventData);
  }

  deleteEvent(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}${id}`);
  }
}