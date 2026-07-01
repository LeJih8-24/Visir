from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    is_completed = Column(Boolean, default=False)
    priority = Column(String, default="normale") # 'basse', 'normale', 'haute'
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)

from datetime import datetime
from database import Base

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Objective(Base):
    __tablename__ = "objectives"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)      # Ex: "Préparer l'expatriation académique"
    quarter = Column(String, index=True)    # Ex: "Q3 2026"
    progress = Column(Float, default=0.0)   # Pourcentage de complétion global
    
    key_results = relationship("KeyResult", back_populates="objective", cascade="all, delete-orphan")

class KeyResult(Base):
    __tablename__ = "key_results"
    id = Column(Integer, primary_key=True, index=True)
    objective_id = Column(Integer, ForeignKey("objectives.id"))
    title = Column(String)                  # Ex: "Valider le dossier et le logement pour Dorset College"
    target_value = Column(Integer, default=1) # Utile si c'est quantitatif (ex: "Clôturer 3 contrats")
    current_value = Column(Integer, default=0)
    
    objective = relationship("Objective", back_populates="key_results")

# --- MODULE MACRO-VISION : ROADMAP & GANTT ---

class ProjectMilestone(Base):
    __tablename__ = "project_milestones"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)      # Ex: "Campagne de com: Nos régions au galop"
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    status = Column(String, default="Planifié") # "Planifié", "En cours", "Terminé"
    color_hex = Column(String, default="#0d9488") # Pour l'affichage dans le diagramme de Gantt
    
    notes = relationship("ProjectNote", back_populates="project", cascade="all, delete-orphan")

class ProjectNote(Base):
    __tablename__ = "project_notes"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project_milestones.id"))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("ProjectMilestone", back_populates="notes")