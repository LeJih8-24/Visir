import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MacroService } from '../../services/macro.service';

@Component({
  selector: 'app-macro-vision',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './macro-vision.component.html',
  styleUrls: ['./macro-vision.component.scss'],
  host: {
    class: 'block w-full h-full'
  }
})
export class MacroVisionComponent implements OnInit {
  projects: any[] = [];
  
  constructor(
    private macroService: MacroService, 
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRoadmap();
  }

  loadRoadmap(): void {
    this.macroService.getRoadmap().subscribe({
      next: (data) => {
        this.projects = data.map(item => ({
          id: item.id.toString(),
          name: item.title,
          start: item.start_date.split('T')[0],
          end: item.end_date.split('T')[0],
          status: item.status || 'Planifié',
          color_hex: item.color_hex || '#8b5cf6'
        }));
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Erreur chargement Roadmap:', err)
    });
  }

  openCreatePage(): void {
    this.router.navigate(['/macrovision/new']);
  }

  openEditPage(project: any): void {
    this.router.navigate(['/macrovision', project.id]);
  }
}