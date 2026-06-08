# Utilisation d'une image Node.js légère
FROM node:20-alpine

# Définition du répertoire de travail
WORKDIR /app

# Copie des fichiers de configuration NPM
COPY package*.json ./

# Installation des dépendances et du CLI Angular globalement
RUN npm install --legacy-peer-deps
RUN npm install -g @angular/cli

# Copie du reste du code source
COPY . .

# On expose le port 4200 (standard Angular)
EXPOSE 4200

# Commande de lancement avec écoute sur toutes les interfaces réseau pour Docker
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--poll", "2000"]
