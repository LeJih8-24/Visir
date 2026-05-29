from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Ce qu'on attend de toi (ou de l'IA) pour créer une tâche
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "normale"

# Ce que l'API renvoie une fois la tâche en base de données
class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    is_completed: bool
    priority: str
    created_at: datetime

    class Config:
        from_attributes = True

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    is_completed: Optional[bool] = None