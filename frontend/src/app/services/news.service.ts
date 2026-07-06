import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NewsService {
  private apiUrl = 'http://127.0.0.1:8000/api/news';

  constructor(private http: HttpClient) {}

  getNews(category?: string): Observable<any[]> {
    let params = new HttpParams();
    if (category && category !== 'Tous') {
      params = params.set('category', category);
    }
    return this.http.get<any[]>(this.apiUrl, { params });
  }
}
