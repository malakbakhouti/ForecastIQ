# ForecastIQ — Application web de prévision des ventes

Application full-stack de prévision des ventes par Machine Learning, développée dans le cadre du Projet de Fin d'Année (PFA) à l'**EMSI Rabat** (École Marocaine des Sciences de l'Ingénieur, 4ème année DDSIR).

## Aperçu

ForecastIQ analyse automatiquement n'importe quel fichier CSV de ventes et produit :

- Une **analyse exploratoire** complète (statistiques descriptives, courbes, tendances)
- Des **prévisions de ventes** via 4 modèles de Machine Learning
- Une **validation scientifique** train/test 80/20 avec seuil de fiabilité à 70%
- Une **détection d'anomalies** par méthode Z-score
- Une **ventilation par catégories** quand le dataset le permet

## Stack technique

### Backend
- **Flask** (Python) — API REST
- **PostgreSQL** — base de données
- **JWT** (HS256) — authentification sécurisée
- **bcrypt** — hashage des mots de passe (coût 12)

### Machine Learning
- **scikit-learn** — Régression linéaire, Régression polynomiale, Random Forest
- **statsmodels** — ARIMA(1,1,1)
- **pandas** — manipulation des séries temporelles
- **numpy** — calculs statistiques

### Frontend
- **Next.js 14** (App Router) — framework React
- **Tailwind CSS** — styling
- **Recharts** — graphiques

## Fonctionnalités principales

### Détection automatique des colonnes
L'application détecte automatiquement la colonne **date** et la colonne **valeur** d'un CSV en se basant sur un système de score (format, nom, variabilité).

### Quatre modèles ML en parallèle
1. **Régression linéaire** — tendance long terme (sklearn)
2. **Régression polynomiale degré 2** — courbure (sklearn)
3. **Random Forest** (100 arbres) — patterns complexes (sklearn)
4. **ARIMA(1,1,1)** — séries temporelles (statsmodels)

### Validation rigoureuse train/test 80/20
Chaque modèle est testé sur 20% de données qu'il n'a jamais vues pendant l'entraînement. Précision calculée comme `100% - MAPE`. Seuil de fiabilité : **70%**.

### Ensemble pondéré
La prévision finale combine **uniquement les modèles validés** (≥70%) via une moyenne pondérée par leur précision.

### Granularité dynamique
Bascule en temps réel entre granularité **journalière, hebdomadaire, mensuelle**. Réagrégation et ré-entraînement automatique des modèles.

### Horizon paramétrable
Prévisions de 1 à 24 périodes futures, ajustables par curseur.

### Rôles utilisateurs
- **Utilisateur** — analyse de ses propres datasets
- **Manager** — lecture seule
- **Administrateur** — gestion des utilisateurs et de tous les datasets

## Architecture

```
forecastiq/
├── backend-flask/        # API Flask + moteur ML
│   ├── app.py            # Point d'entrée
│   ├── auth.py           # JWT, bcrypt
│   ├── csv_analyzer.py   # Détection auto + nettoyage
│   ├── forecast_engine.py # 4 modèles ML + validation + anomalies
│   ├── datasets.py       # Endpoints datasets
│   ├── forecasts.py      # Endpoints prévisions
│   ├── admin.py          # Endpoints administration
│   └── models.py         # ORM SQLAlchemy
│
└── frontend/             # Next.js dashboard
    ├── app/
    │   ├── dashboard/    # Dashboard 5 onglets
    │   ├── upload/       # Import CSV
    │   ├── admin/        # Gestion utilisateurs
    │   └── login/        # Authentification
    └── components/
        └── DashboardTabs.js # Vue d'ensemble, Modèles ML, Prévisions, Anomalies, Catégories
```

## Installation

### Prérequis
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### Backend

```bash
cd backend-flask
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configurer la base
cp .env.example .env
# Éditer .env avec votre DATABASE_URL et JWT_SECRET_KEY

python init_db.py
python app.py
```

Backend disponible sur `http://localhost:3001`.

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Frontend disponible sur `http://localhost:3000`.

## Utilisation

1. Se connecter avec le compte administrateur par défaut
2. Aller dans **Importer** et déposer un fichier CSV (avec une colonne date + une colonne numérique)
3. Confirmer la détection automatique des colonnes
4. Explorer les 5 onglets du dashboard :
   - **Vue d'ensemble** — Courbe historique + tendance + prévisions
   - **Modèles ML** — Comparaison des 4 modèles + validation 80/20
   - **Prévisions** — Réel vs prédit + prévisions futures
   - **Anomalies** — Détection Z-score 2σ
   - **Catégories** — Ventilation par segments

## Captures d'écran

À ajouter dans le dossier `docs/screenshots/`.

## Auteurs

- **Malak BAKHOUTI** — Développement full-stack, conception du moteur ML
- **EL-GHAZOUI Mohamed** — Binôme PFA

**Encadrante :** Mme Aarich Mounia
**Établissement :** EMSI Rabat — 4ème année DDSIR
**Année :** 2025-2026

## Licence

Projet académique — usage éducatif.
