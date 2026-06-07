import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat.service';
import { SyncService } from '../../services/sync.service'; // L'import est bien là

interface Message {
  text: string;
  isUser: boolean;
}

@Component({
  selector: 'app-chat-interface',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-interface.component.html'
})
export class ChatInterfaceComponent implements OnInit {
  messages: Message[] = [];
  newMessage: string = ''; 
  isLoading: boolean = false; 

  constructor(
    private chatService: ChatService,
    private cdr: ChangeDetectorRef,
    private syncService: SyncService // <-- 1. INJECTION DU SERVICE ICI
  ) {}

  ngOnInit(): void {}

  sendMessage(): void {
    if (!this.newMessage.trim() || this.isLoading) return;

    const messageToSend = this.newMessage;
    
    this.messages.push({ text: messageToSend, isUser: true });
    this.newMessage = ''; 
    
    this.isLoading = true;
    this.cdr.detectChanges(); 

    this.chatService.sendMessage(messageToSend).subscribe({
      next: (res: any) => {
        const aiReply = res && res.response ? res.response : "Signal reçu, mais réponse vide.";
        this.messages.push({ text: aiReply, isUser: false });
        
        this.isLoading = false; 
        this.cdr.detectChanges(); 

        // <-- 2. DÉCLENCHEMENT DU SIGNAL MAGIQUE POUR RAFRAÎCHIR L'OS
        this.syncService.triggerRefresh(); 
      },
      error: (err) => {
        console.error('Erreur reçue dans le composant chat :', err);
        this.messages.push({ text: "Système corrompu. Impossible de joindre le noyau de l'IA.", isUser: false });
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}