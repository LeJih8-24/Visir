# -------------------------------------------------------------------
# ALIAS DE CONTROLE POUR VISIR OS
# -------------------------------------------------------------------

# Lancement et Création
alias vup="sudo docker compose up -d"
alias vbuild="sudo docker compose up -d --build"

# Redémarrage (Global ou par module, ex: vrestart backend)
alias vrestart="sudo docker compose restart"

# Arrêt propre
alias vdown="sudo docker compose down"

# Le grand nettoyage radical (Supprime TOUS les conteneurs du PC + réseaux orphelins)
alias vclean="sudo docker rm -f \$(sudo docker ps -aq) 2>/dev/null && sudo docker network prune -f"

# Logs en temps réel (Global ou par module, ex: vlogs backend)
alias vlogs="sudo docker compose logs -f"
alias vps="sudo docker compose ps"