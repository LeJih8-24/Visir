# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Depends, HTTPException, Header
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
from models import Event, Task, Note, Objective, KeyResult, ProjectMilestone
import asyncio
from typing import Optional, List, Dict, Any

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

WEBHOOK_SECRET = os.getenv("VISIR_WEBHOOK_SECRET", "mot_de_passe_par_defaut")

class WebhookNote(BaseModel):
    content: str

@app.post("/webhook/note")
def webhook_create_note(note: WebhookNote, x_visir_token: str = Header(None), db: Session = Depends(get_db)):
    """
    Point d'entrée sécurisé pour les Raccourcis iPhone ou n8n/Make.
    Vérifie le token dans le header avant d'écrire en base.
    """
    # 1. Vérification de l'identité
    print(WEBHOOK_SECRET, x_visir_token)
    if x_visir_token != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Accès refusé au Noyau Visir. Token invalide.")
    
    try:
        # 2. Écriture dans la mémoire (base de données)
        new_note = Note(content=note.content)
        db.add(new_note)
        db.commit()
        return {"status": "success", "message": "Donnée intégrée à Visir OS."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'écriture : {str(e)}")


# --- WEBHOOKS SUPPLÉMENTAIRES (TODO LIST & AGENDA) ---

class WebhookTask(BaseModel):
    title: str
    priority: int = 2  # 1: Haute, 2: Normale, 3: Basse

class WebhookEvent(BaseModel):
    title: str
    start_time: str  # Format attendu : YYYY-MM-DD HH:MM:SS
    end_time: str    # Format attendu : YYYY-MM-DD HH:MM:SS

@app.post("/webhook/task")
def webhook_create_task(task: WebhookTask, x_visir_token: str = Header(None), db: Session = Depends(get_db)):
    """
    Point d'entrée sécurisé pour ajouter une tâche à la Todo List.
    """
    if x_visir_token != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Accès refusé au Noyau Visir. Token invalide.")
    
    try:
        new_task = Task(title=task.title, priority=task.priority, is_completed=False)
        db.add(new_task)
        db.commit()
        return {"status": "success", "message": f"Tâche '{task.title}' intégrée à la Todo List."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'écriture Task : {str(e)}")


@app.post("/webhook/event")
def webhook_create_event(event: WebhookEvent, x_visir_token: str = Header(None), db: Session = Depends(get_db)):
    """
    Point d'entrée sécurisé pour ajouter un événement à l'Agenda.
    Format de date requis : YYYY-MM-DD HH:MM:SS
    """
    if x_visir_token != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Accès refusé au Noyau Visir. Token invalide.")
    
    try:
        # Conversion des chaînes de caractères reçues en objets datetime Python
        start = datetime.strptime(event.start_time, '%Y-%m-%d %H:%M:%S')
        end = datetime.strptime(event.end_time, '%Y-%m-%d %H:%M:%S')
        
        new_event = Event(title=event.title, start_time=start, end_time=end)
        db.add(new_event)
        db.commit()
        return {"status": "success", "message": f"Événement '{event.title}' synchronisé avec l'agenda."}
    except ValueError:
        raise HTTPException(status_code=422, detail="Format de date invalide. Utilisez 'YYYY-MM-DD HH:MM:SS'")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'écriture Event : {str(e)}")
    

class ObjectiveCreate(BaseModel):
    title: str
    quarter: str

class MilestoneCreate(BaseModel):
    title: str
    start_date: str # YYYY-MM-DD
    end_date: str   # YYYY-MM-DD
    color_hex: str = "#8b5cf6"

class MilestoneUpdate(BaseModel):
    title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    color_hex: Optional[str] = None

@app.get("/macro/okrs")
def get_okrs(db: Session = Depends(get_db)):
    """Récupère tous les objectifs avec leurs résultats clés."""
    objectives = db.query(Objective).all()
    # Retourne les entités avec leurs relations
    return objectives

@app.post("/macro/okrs")
def create_okr(okr: ObjectiveCreate, db: Session = Depends(get_db)):
    new_objective = Objective(title=okr.title, quarter=okr.quarter)
    db.add(new_objective)
    db.commit()
    return {"status": "success", "id": new_objective.id}

@app.get("/macro/roadmap")
def get_roadmap(db: Session = Depends(get_db)):
    """Récupère les projets pour le diagramme de Gantt."""
    return db.query(ProjectMilestone).order_by(ProjectMilestone.start_date).all()

@app.post("/macro/roadmap")
def create_milestone(milestone: MilestoneCreate, db: Session = Depends(get_db)):
    start = datetime.strptime(milestone.start_date, '%Y-%m-%d')
    end = datetime.strptime(milestone.end_date, '%Y-%m-%d')
    new_milestone = ProjectMilestone(title=milestone.title, start_date=start, end_date=end, color_hex=milestone.color_hex)
    db.add(new_milestone)
    db.commit()
    db.refresh(new_milestone)
    return new_milestone

@app.put("/macro/roadmap/{milestone_id}")
def update_milestone(milestone_id: int, milestone: MilestoneUpdate, db: Session = Depends(get_db)):
    db_milestone = db.query(ProjectMilestone).filter(ProjectMilestone.id == milestone_id).first()
    if not db_milestone:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    if milestone.title is not None:
        db_milestone.title = milestone.title
    if milestone.start_date is not None:
        db_milestone.start_date = datetime.strptime(milestone.start_date, '%Y-%m-%d')
    if milestone.end_date is not None:
        db_milestone.end_date = datetime.strptime(milestone.end_date, '%Y-%m-%d')
    if milestone.color_hex is not None:
        db_milestone.color_hex = milestone.color_hex
        
    db.commit()
    db.refresh(db_milestone)
    return db_milestone

@app.delete("/macro/roadmap/{milestone_id}")
def delete_milestone(milestone_id: int, db: Session = Depends(get_db)):
    db_milestone = db.query(ProjectMilestone).filter(ProjectMilestone.id == milestone_id).first()
    if not db_milestone:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    db.delete(db_milestone)
    db.commit()
    return {"status": "success", "message": "Projet supprimé."}

# --- PROJECT NOTES ---

@app.get("/macro/roadmap/{milestone_id}/notes", response_model=list[schemas.ProjectNoteResponse])
def get_project_notes(milestone_id: int, db: Session = Depends(get_db)):
    return db.query(models.ProjectNote).filter(models.ProjectNote.project_id == milestone_id).order_by(models.ProjectNote.created_at.desc()).all()

@app.post("/macro/roadmap/{milestone_id}/notes", response_model=schemas.ProjectNoteResponse)
def create_project_note(milestone_id: int, note: schemas.ProjectNoteCreate, db: Session = Depends(get_db)):
    db_milestone = db.query(models.ProjectMilestone).filter(models.ProjectMilestone.id == milestone_id).first()
    if not db_milestone:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    new_note = models.ProjectNote(project_id=milestone_id, content=note.content)
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note

@app.delete("/macro/roadmap/{milestone_id}/notes/{note_id}")
def delete_project_note(milestone_id: int, note_id: int, db: Session = Depends(get_db)):
    db_note = db.query(models.ProjectNote).filter(models.ProjectNote.id == note_id, models.ProjectNote.project_id == milestone_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    db.delete(db_note)
    db.commit()
    return {"status": "success", "message": "Note de projet supprimée."}

# --- PROJECT TASKS ---

@app.get("/macro/roadmap/{milestone_id}/tasks", response_model=list[schemas.ProjectTaskResponse])
def get_project_tasks(milestone_id: int, db: Session = Depends(get_db)):
    return db.query(models.ProjectTask).filter(models.ProjectTask.project_id == milestone_id).order_by(models.ProjectTask.created_at.desc()).all()

@app.post("/macro/roadmap/{milestone_id}/tasks", response_model=schemas.ProjectTaskResponse)
def create_project_task(milestone_id: int, task: schemas.ProjectTaskCreate, db: Session = Depends(get_db)):
    db_milestone = db.query(models.ProjectMilestone).filter(models.ProjectMilestone.id == milestone_id).first()
    if not db_milestone:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    new_task = models.ProjectTask(project_id=milestone_id, title=task.title, description=task.description, status=task.status)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@app.put("/macro/roadmap/{milestone_id}/tasks/{task_id}", response_model=schemas.ProjectTaskResponse)
def update_project_task(milestone_id: int, task_id: int, task_update: schemas.ProjectTaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(models.ProjectTask).filter(models.ProjectTask.id == task_id, models.ProjectTask.project_id == milestone_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    
    update_data = task_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
        
    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/macro/roadmap/{milestone_id}/tasks/{task_id}")
def delete_project_task(milestone_id: int, task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(models.ProjectTask).filter(models.ProjectTask.id == task_id, models.ProjectTask.project_id == milestone_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    db.delete(db_task)
    db.commit()
    return {"status": "success", "message": "Tâche de projet supprimée."}