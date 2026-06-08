from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import engine, get_db
import models, schemas
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
import os
from datetime import datetime
from pydantic import BaseModel
from models import Event, Task, Note
import asyncio

# Création des tables manquantes dans PostgreSQL
models.Base.metadata.create_all(bind=engine)

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)
# Initialisation automatique du client Gemini (lit la variable GEMINI_API_KEY)

app = FastAPI(title="Visir OS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health/db")
def check_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Connexion à PostgreSQL établie avec succès."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- LOGIQUE DES TÂCHES ---

@app.post("/tasks/", response_model=schemas.TaskResponse)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    db_task = models.Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/tasks/", response_model=list[schemas.TaskResponse])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tasks = db.query(models.Task).offset(skip).limit(limit).all()
    return tasks

@app.put("/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task(task_id: int, task_update: schemas.TaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Tâche non trouvée")
    update_data = task_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Tâche non trouvée")
    db.delete(db_task)
    db.commit()
    return {"status": "success", "message": f"La tâche {task_id} a été supprimée avec succès."}


# --- LOGIQUE TERMINAL IA (CHART) ---

# --- LOGIQUE TERMINAL IA ---

class ChatMessage(BaseModel):
    message: str

@app.post("/chat/")
async def chat_with_visir(chat: ChatMessage, db: Session = Depends(get_db)):
    try:
        # 1. Extraction du contexte complet (Tâches, Agenda et NOTES)
        taches = db.query(Task).all()
        contexte_taches = "\n".join([f"- [ID: {t.id}] [{ 'X' if t.is_completed else ' ' }] {t.title} (Prio: {t.priority})" for t in taches]) or "- Aucune tâche."

        maintenant = datetime.now()
        evenements = db.query(Event).filter(Event.start_time >= maintenant).order_by(Event.start_time).all()
        contexte_events = "\n".join([f"- [ID: {e.id}] {e.title} : du {e.start_time.strftime('%Y-%m-%d %H:%M')} au {e.end_time.strftime('%Y-%m-%d %H:%M')}" for e in evenements]) or "- Aucun événement prévu."

        notes = db.query(Note).order_by(Note.created_at.desc()).all()
        contexte_notes = "\n".join([f"- [ID: {n.id}] {n.content}" for n in notes]) or "- Aucune note enregistrée."

        # =================================================================
        # 2. BOÎTE À OUTILS (TOOLS)
        # =================================================================

        def add_calendar_event(title: str, start_time: str, end_time: str) -> str:
            """Ajoute un événement à l'agenda. Format attendu : YYYY-MM-DD HH:MM:SS"""
            try:
                start = datetime.strptime(start_time, '%Y-%m-%d %H:%M:%S')
                end = datetime.strptime(end_time, '%Y-%m-%d %H:%M:%S')
                new_event = Event(title=title, start_time=start, end_time=end)
                db.add(new_event)
                db.commit()
                return f"Succès : l'événement '{title}' a été ajouté."
            except Exception as e:
                return f"Erreur agenda : {str(e)}"

        def create_todo_task(title: str, priority: int) -> str:
            """Crée une tâche dans la todo list. priority : 1 (Haute), 2 (Normale), 3 (Basse)."""
            try:
                new_task = Task(title=title, priority=priority, is_completed=False)
                db.add(new_task)
                db.commit()
                return f"Succès : La tâche '{title}' a été ajoutée."
            except Exception as e:
                return f"Erreur tâche : {str(e)}"

        def complete_todo_task(task_id: int) -> str:
            """Marque une tâche existante comme complétée via son ID numérique."""
            try:
                task = db.query(Task).filter(Task.id == task_id).first()
                if not task: return f"Erreur : La tâche ID {task_id} n'existe pas."
                task.is_completed = True
                db.commit()
                return f"Succès : La tâche ID {task_id} a été validée."
            except Exception as e:
                return f"Erreur modification : {str(e)}"

        def create_quick_note(content: str) -> str:
            """Prend une note rapide ou enregistre une idée, une pensée, une information importante à retenir."""
            try:
                new_note = Note(content=content)
                db.add(new_note)
                db.commit()
                return f"Succès : La note a été enregistrée dans la mémoire de Visir OS."
            except Exception as e:
                return f"Erreur sauvegarde note : {str(e)}"

        # =================================================================
        # 3. DIRECTIVES SYSTÈME REVISITÉES
        # =================================================================
        system_instruction = f"""Tu es Visir, le système d'exploitation privé et l'assistant personnel de l'utilisateur.
        Tu es concis, professionnel, avec un ton légèrement cyberpunk. Tu réponds en français.

        CONTEXTE EN TEMPS RÉEL ({maintenant.strftime('%Y-%m-%d %H:%M:%S')}) :
        [TODO LIST]
        {contexte_taches}

        [AGENDA]
        {contexte_events}

        [NOTES RAPIDES ET IDÉES COMPILÉES]
        {contexte_notes}

        RÈGLES D'OUTILS :
        1. Tu as un accès complet en lecture et écriture sur l'agenda, les tâches et les notes rapides.
        2. Si l'utilisateur te donne une information à retenir, une idée de projet, ou te dit textuellement "Prends note de X", utilise l'outil `create_quick_note`.
        3. Formule ta confirmation de manière fluide dès que les fonctions ont retourné un succès.
        """

        # =================================================================
        # 4. EXÉCUTION AVEC GESTION DE LA CHARGE (RETRY & FALLBACK)
        # =================================================================
        max_tentatives = 3
        
        for tentative in range(max_tentatives):
            try:
                # Modèle principal en 1er essai, modèle secondaire (fallback) ensuite
                modele_a_utiliser = 'gemini-2.5-flash' if tentative == 0 else 'gemini-2.5-flash-lite'
                
                chat_session = client.aio.chats.create(
                    model=modele_a_utiliser,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        tools=[add_calendar_event, create_todo_task, complete_todo_task, create_quick_note],
                    )
                )
                
                response = await chat_session.send_message(chat.message)
                texte_reponse = response.text if response.text else "Données synchronisées dans le noyau."
                return {"response": texte_reponse}

            except Exception as e:
                erreur_str = str(e)
                # Vérifie s'il s'agit d'une erreur de surcharge serveur
                if "503" in erreur_str or "UNAVAILABLE" in erreur_str or "high demand" in erreur_str:
                    if tentative < max_tentatives - 1:
                        temps_attente = 2 ** tentative  # Attend 1s au premier échec, puis 2s...
                        print(f"[Visir OS] Surcharge API détectée. Nouvel essai dans {temps_attente}s avec {modele_a_utiliser}...")
                        await asyncio.sleep(temps_attente)
                        continue
                    else:
                        # Si toutes les tentatives échouent, on prévient l'utilisateur proprement
                        return {"response": "[ERREUR NOYAU] Connexion aux serveurs cognitifs distants impossible pour le moment. La bande passante est saturée. Veuillez réessayer dans un instant."}
                else:
                    # Si c'est une vraie erreur de code ou de connexion, on crash proprement pour débugger
                    raise HTTPException(status_code=500, detail=erreur_str)
                    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- LOGIQUE DE L'AGENDA (GET) ---

@app.get("/events/")
def get_events(db: Session = Depends(get_db)):
    """Récupère l'ensemble des événements planifiés."""
    evenements = db.query(Event).all()
    return evenements

class EventCreate(BaseModel):
    title: str
    start_time: str
    end_time: str

@app.post("/events/")
def create_event_manual(event: EventCreate, db: Session = Depends(get_db)):
    start = datetime.strptime(event.start_time, '%Y-%m-%d %H:%M:%S')
    end = datetime.strptime(event.end_time, '%Y-%m-%d %H:%M:%S')
    new_event = Event(title=event.title, start_time=start, end_time=end)
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

@app.delete("/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    db.delete(db_event)
    db.commit()
    return {"status": "success", "message": "Événement supprimé."}


class NoteCreate(BaseModel):
    content: str

# --- ROUTE DES NOTES EN REST ---

@app.get("/notes/")
def get_notes(db: Session = Depends(get_db)):
    return db.query(Note).order_by(Note.created_at.desc()).all()

@app.post("/notes/")
def create_note_manual(note: NoteCreate, db: Session = Depends(get_db)):
    new_note = Note(content=note.content)
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note

@app.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    db.delete(db_note)
    db.commit()
    return {"status": "success", "message": "Note supprimée."}