import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat.service';

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

@Component({
  selector: 'app-chat-interface',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-interface.component.html'
})
export class ChatInterfaceComponent {
  messages: Message[] = [];
  newMessage: string = '';
  isLoading: boolean = false;

  constructor(private chatService: ChatService) {}

  sendMessage(): void {
    if (!this.newMessage.trim() || this.isLoading) return;

    const userMsg = this.newMessage;
    this.messages.push({
      text: userMsg,
      isUser: true,
      timestamp: new Date()
    });

    this.newMessage = '';
    this.isLoading = true;

    this.chatService.sendMessage(userMsg).subscribe({
      next: (res) => {
        this.messages.push({
          text: res.response,
          isUser: false,
          timestamp: new Date()
        });
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur IA:', err);
        this.messages.push({
          text: "Erreur lors de la communication avec le terminal IA. Vérifie qu'Ollama est bien actif et que le modèle Llama 3 est chargé.",
          isUser: false,
          timestamp: new Date()
        });
        this.isLoading = false;
      }
    });
  }
}