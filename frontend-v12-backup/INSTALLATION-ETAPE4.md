# ForecastIQ — Étape 4 (FINALE) : Dashboard + Upload + Admin

L'application ForecastIQ est maintenant **complète**.

## Ce qui a été ajouté à l'étape 4

**Backend** : `admin.py` (nouveau blueprint) + `app.py` mis à jour
- Endpoints `/api/admin/users`, `/api/admin/logs`, `/api/admin/stats`
- Gestion des rôles et des comptes

**Frontend** : 3 pages + 1 composant
- `app/upload/page.js` — import CSV/Excel avec détection auto + mapping correctible
- `app/dashboard/page.js` — tableau de bord complet (5 onglets)
- `app/admin/page.js` — administration (utilisateurs + journal d'activité)
- `components/DashboardTabs.js` — les graphiques Recharts des 5 onglets

## Installation

### Backend — remplacer 2 fichiers

Tu as déjà le backend des étapes 1-3. Il faut juste ajouter `admin.py` et
remplacer `app.py`. Extrais l'archive `forecastiq-backend-v4.tar` qui contient
tout le backend à jour :

```bash
cd ~/Downloads/forecastiq
mv backend-flask backend-flask-v3-backup
tar -xf ~/Downloads/forecastiq-backend-v4.tar
cd backend-flask
cp -r ../backend-flask-v3-backup/venv .
cp ../backend-flask-v3-backup/.env .
source venv/bin/activate
python app.py
```

Pas besoin de refaire `init_db.py` (les tables existent déjà).

### Frontend — remplacer le dossier

```bash
cd ~/Downloads/forecastiq
mv frontend frontend-v3-backup
tar -xf ~/Downloads/forecastiq-frontend-v4.tar
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

## Lancement (2 terminaux)

```bash
# Terminal 1
cd ~/Downloads/forecastiq/backend-flask
source venv/bin/activate
python app.py

# Terminal 2
cd ~/Downloads/forecastiq/frontend
npm run dev
```

Ouvre **http://localhost:3000**

## Le parcours complet

1. **Landing page** → "Commencer" ou "Se connecter"
2. **Connexion** admin : `admin@forecastiq.com` / `Admin@2026`
3. **Importer** → glisse `train.csv` → le système détecte les colonnes
4. **Vérifier le mapping** → confirmer
5. **Tableau de bord** → 5 onglets :
   - Vue d'ensemble : courbe + tendance + prévisions + stats
   - Prévisions : barres réelles vs prévues
   - Anomalies : détection Z-score
   - Catégories : ventilation par segment/région/...
   - Modèles ML : comparaison des 4 algorithmes + métriques R²/MAE/RMSE
6. **Administration** (admin uniquement) : gérer les utilisateurs, voir le journal

## Contrôles du dashboard

- **Jeu de données** : bascule entre tes fichiers importés
- **Granularité** : mensuelle / hebdomadaire / journalière
- **Horizon** : curseur de 1 à 24 périodes
- **Catégorie** : choisir la colonne de ventilation

## Validé en sandbox (test end-to-end Playwright)

- Login admin → upload train.csv → détection (Order Date, Sales, 5 catégories)
- Dashboard : KPIs corrects (2.26M, 47.1K, 117.9K, +484.5%)
- Les 5 onglets s'affichent
- Page admin : liste users, stats, contrôle d'accès (403 pour non-admin)
