# Utilisation d'une image Python légère
FROM python:3.11-slim

# Définition du répertoire de travail dans le conteneur
WORKDIR /app

# Copie des dépendances et installation
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code source
COPY . .

# Exposition du port (le même que dans le docker-compose)
EXPOSE 8000

# Commande pour lancer le serveur FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]