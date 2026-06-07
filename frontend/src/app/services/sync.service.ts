import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  // Le canal de communication
  private refreshSource = new Subject<void>();
  
  // La fréquence que les widgets vont écouter
  refreshNeeded$ = this.refreshSource.asObservable();

  // La fonction que l'IA va appeler pour déclencher la mise à jour
  triggerRefresh() {
    this.refreshSource.next();
  }
}