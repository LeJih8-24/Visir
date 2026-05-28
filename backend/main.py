from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import engine, get_db

app = FastAPI(
    title="Visir OS API",
    description="Le backend du Second Brain",
    version="0.1.0"
)

@app.get("/")
def read_root():
    return {"message": "Visir est en ligne et à l'écoute."}

@app.get("/health/db")
def check_db(db: Session = Depends(get_db)):
    try:
        # Test simple de connexion à la base de données
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Connexion à PostgreSQL établie avec succès."}
    except Exception as e:
        return {"status": "error", "message": str(e)}