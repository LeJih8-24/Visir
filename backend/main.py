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
from models import Event, Task

# Création des tables manquantes dans PostgreSQL
models.Base.metadata.create_all(bind=engine)

# Initialisation automatique du client Gemini (lit la variable GEMINI_API_KEY)
client = genai.Client()

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

class ChatMessage(BaseModel):
    message: str

@app.post("/chat/")
def chat_with_visir(chat: ChatMessage, db: Session = Depends(get_db)):
    """
    Route IA principale. Le mot-clé async a été retiré pour éviter 
    le blocage de la boucle d'événements par le SDK synchrone de Google.
    """
    try:
        # 1. Récupération dynamique du Contexte local (PostgreSQL)
        taches = db.query(Task).all()
        contexte_taches = "\n".join([f"[{'X' if t.is_completed else ' '}] {t.title} (Prio: {t.priority})" for t in taches]) or "- Aucune tâche."

        maintenant = datetime.now()
        evenements = db.query(Event).filter(Event.start_time >= maintenant).order_by(Event.start_time).all()
        contexte_events = "\n".join([f"- {e.title} : du {e.start_time.strftime('%d/%m %H:%M')} au {e.end_time.strftime('%d/%m %H:%M')}" for e in evenements]) or "- Aucun événement prévu."

        # 2. Déclaration de la fonction Outil (Tool) pour Gemini.
        # Placée à l'intérieur de la route, elle bénéficie de la session 'db' active.
        def add_calendar_event(title: str, start_time: str, end_time: str) -> str:
            """
            Ajoute un événement à l'agenda de l'utilisateur.
            Format de date STRICTEMENT attendu pour les paramètres : YYYY-MM-DD HH:MM:SS
            """
            try:
                start = datetime.strptime(start_time, '%Y-%m-%d %H:%M:%S')
                end = datetime.strptime(end_time, '%Y-%m-%d %H:%M:%S')
                
                new_event = Event(title=title, start_time=start, end_time=end)
                db.add(new_event)
                db.commit()
                return f"Succès : l'événement '{title}' a bien été enregistré dans la base de données."
            except Exception as e:
                return f"Erreur lors de l'insertion en base de données : {str(e)}"

        # 3. Élaboration du System Prompt enrichi
        system_instruction = f"""Tu es Visir, le système d'exploitation privé et l'assistant personnel de l'utilisateur.
        Tu es concis, professionnel, avec un ton légèrement cyberpunk. Tu réponds toujours en français.

        CONTEXTE SYSTÈME EN TEMPS RÉEL :
        - Date et heure actuelles : {maintenant.strftime('%Y-%m-%d %H:%M:%S')}

        [TÂCHES EN COURS]
        {contexte_taches}

        [AGENDA FUTUR]
        {contexte_events}

        RÈGLES D'INTERACTION :
        1. Utilise la date actuelle transmise ci-dessus pour interpréter des expressions temporelles relatives ("demain", "ce soir", "lundi prochain").
        2. Pour ajouter un événement à l'agenda, utilise SYSTÉMATIQUEMENT ton outil `add_calendar_event`.
        3. Si l'utilisateur demande une planification sans donner d'heure de fin, déduis une durée cohérente (ex: 1 heure pour un rendez-vous).
        4. Reste transparent : n'annonce jamais au format texte "j'exécute l'outil", décris directement l'action confirmée de manière fluide.
        """

        # 4. Appel au modèle Gemini 2.5 Flash avec intégration des outils
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=chat.message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=[add_calendar_event],  # Injection de la fonction Python comme outil natif
            ),
        )
        
        return {"response": response.text}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- LOGIQUE DE L'AGENDA (GET) ---

@app.get("/events/")
def get_events(db: Session = Depends(get_db)):
    """Récupère l'ensemble des événements planifiés."""
    evenements = db.query(Event).all()
    return evenements