import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MacroService {
  private apiUrl = '/api/macro/';

  constructor(private http: HttpClient) {}

  getRoadmap(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl + 'roadmap');
  }

  createMilestone(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl + 'roadmap', data);
  }

  updateMilestone(id: string, data: any): Observable<any> {
    return this.http.put<any>(this.apiUrl + `roadmap/${id}`, data);
  }

  deleteMilestone(id: string): Observable<any> {
    return this.http.delete<any>(this.apiUrl + `roadmap/${id}`);
  }

  getProjectNotes(milestoneId: string): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl + `roadmap/${milestoneId}/notes`);
  }

  addProjectNote(milestoneId: string, data: { content: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl + `roadmap/${milestoneId}/notes`, data);
  }

  deleteProjectNote(milestoneId: string, noteId: number): Observable<any> {
    return this.http.delete<any>(this.apiUrl + `roadmap/${milestoneId}/notes/${noteId}`);
  }

  // --- Project Tasks ---
  getProjectTasks(milestoneId: string): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl + `roadmap/${milestoneId}/tasks`);
  }

  createProjectTask(milestoneId: string, data: { title: string, description?: string, status?: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl + `roadmap/${milestoneId}/tasks`, data);
  }

  updateProjectTask(milestoneId: string, taskId: number, data: any): Observable<any> {
    return this.http.put<any>(this.apiUrl + `roadmap/${milestoneId}/tasks/${taskId}`, data);
  }

  deleteProjectTask(milestoneId: string, taskId: number): Observable<any> {
    return this.http.delete<any>(this.apiUrl + `roadmap/${milestoneId}/tasks/${taskId}`);
  }
}
