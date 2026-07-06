import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NewsService } from '../../services/news.service';

@Component({
  selector: 'app-news-portal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news-portal.component.html',
  styleUrls: ['./news-portal.component.scss'],
  host: {
    class: 'block w-full h-full'
  }
})
export class NewsPortalComponent implements OnInit {
  articles: any[] = [];
  categories: string[] = ['Tous', 'Informatique', 'Trading', 'Pédagogie', 'Dev Personnel', 'Science'];
  activeCategory: string = 'Tous';
  loading: boolean = true;

  constructor(private newsService: NewsService) {}

  ngOnInit(): void {
    this.loadNews();
  }

  loadNews(category?: string): void {
    if (category) {
      this.activeCategory = category;
    }
    this.loading = true;
    this.newsService.getNews(this.activeCategory).subscribe({
      next: (data) => {
        this.articles = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement news', err);
        this.loading = false;
      }
    });
  }
}
