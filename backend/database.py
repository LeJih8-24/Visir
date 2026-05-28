import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Récupération de l'URL depuis le docker-compose
# Note: SQLAlchemy préfère le préfixe 'postgresql://' plutôt que 'pgsql://'
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://visir_user:visir_password@db:5432/visir_db").replace("pgsql://", "postgresql://")

# Création du moteur de base de données
engine = create_engine(DATABASE_URL)

# Création de la fabrique de sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Classe de base pour nos futurs modèles (Tables)
Base = declarative_base()

# Dépendance pour obtenir la session DB dans nos routes FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()