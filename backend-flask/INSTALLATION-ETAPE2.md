# ForecastIQ — Backend Flask (Étape 2 : Upload + Moteur de prévision IA)

Étape 2 sur 4. **20/20 tests passés.**

## Nouveautés de cette étape

- **Upload CSV/Excel** avec détection automatique des colonnes (date, valeur, catégories)
- **Moteur de prévision** avec 4 algorithmes ML : Régression linéaire, Polynomiale, Random Forest, ARIMA
- **Ensemble** : moyenne pondérée par le R² de chaque modèle
- **Détection d'anomalies** par Z-score (seuil 2σ)
- **Métriques** MAE, RMSE, R² par modèle
- **Granularité** mensuelle / hebdomadaire / journalière

## Installation (mise à jour de l'étape 1)

Tu as déjà l'étape 1 installée et fonctionnelle. Pour l'étape 2 :

### 1. Arrête le serveur Flask actuel

Dans le terminal où `python app.py` tourne : `Ctrl+C`

### 2. Remplace/ajoute les fichiers

Extrais l'archive `forecastiq-backend-flask-v2.tar` — elle contient TOUS les fichiers
(ceux de l'étape 1 + les 4 nouveaux). Les nouveaux :
- `csv_analyzer.py`  (détection auto des colonnes)
- `forecast_engine.py`  (les 4 modèles ML)
- `datasets.py`  (blueprint upload/liste/preview)
- `forecasts.py`  (blueprint prévision + dashboard)

Et `app.py` est mis à jour (enregistre les nouveaux blueprints).

```bash
cd ~/Downloads/forecastiq
# sauvegarde de l'ancien backend
mv backend-flask backend-flask-etape1-backup
# extraire la v2
tar -xf ~/Desktop/forecastiq-backend-flask-v2.tar
```

### 3. Récupère ton venv et ton .env

```bash
cd backend-flask
# recopier le venv et le .env depuis la sauvegarde
cp -r ../backend-flask-etape1-backup/venv .
cp ../backend-flask-etape1-backup/.env .
source venv/bin/activate
```

Les dépendances ML (pandas, scikit-learn, statsmodels) sont déjà installées
depuis l'étape 1 — rien à réinstaller.

### 4. Pas besoin de refaire init_db.py

Les tables existent déjà. Mais si tu veux repartir de zéro :
```bash
python init_db.py   # ne recrée pas ce qui existe déjà
```

### 5. Relance

```bash
python app.py
```

## Test rapide

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@forecastiq.com","password":"Admin@2026"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Upload de train.csv (adapte le chemin vers ton train.csv)
curl -X POST http://localhost:3001/api/datasets/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/Users/malak/Downloads/sales-forecast-pro/backend/train.csv"

# → réponse avec dataset.id et analysis.detected (Order Date, Sales, ...)

# Dashboard (remplace 1 par l'id du dataset)
curl "http://localhost:3001/api/datasets/1/dashboard?granularity=monthly&horizon=6" \
  -H "Authorization: Bearer $TOKEN"
```

## Nouveaux endpoints

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `/api/datasets/upload` | user, admin | Upload CSV/Excel + détection auto |
| GET | `/api/datasets` | tous | Liste (user=siens, manager/admin=tous) |
| GET | `/api/datasets/<id>` | accès | Détails d'un dataset |
| GET | `/api/datasets/<id>/preview` | accès | 10 premières lignes |
| PUT | `/api/datasets/<id>/mapping` | propriétaire, admin | Corriger le mapping |
| DELETE | `/api/datasets/<id>` | propriétaire, admin | Supprimer |
| POST | `/api/forecasts/run` | user, admin | Lancer une prévision |
| GET | `/api/forecasts/<id>` | accès | Résultats sauvegardés |
| GET | `/api/datasets/<id>/forecasts` | accès | Historique des prévisions |
| GET | `/api/datasets/<id>/dashboard` | accès | Données complètes du dashboard |

## Format de réponse du dashboard

```json
{
  "dataset": { "id": 1, "name": "train.csv", ... },
  "cleaning_report": { "rows_before": 9800, "duplicates_removed": 0, ... },
  "available_categories": ["Ship Mode", "Segment", "Region", "Category", "Sub-Category"],
  "active_category": "Ship Mode",
  "result": {
    "granularity": "monthly",
    "horizon": 6,
    "series": [ {"period": "2015-01-01", "value": 14205.71}, ... ],
    "forecast_labels": ["Prév.+1", ..., "Prév.+6"],
    "moving_average": [ ... ],
    "stats": { "total": 2261536.79, "mean": 47115.35, "min": 4519.89,
               "max": 117938.15, "max_period": "2018-11-01",
               "growth_percent": 484.5, "periods": 48 },
    "anomalies": [ {"period": "2018-11-01", "value": 117938.15, "zscore": 2.865} ],
    "models": [
      { "name": "Régression linéaire", "key": "linear",
        "fitted": [...], "forecast": [68879, 69767, ...], "slope": 888.31,
        "metrics": {"mae": 17400.98, "rmse": 21435.83, "r2": 0.2479} },
      { "name": "Régression polynomiale (degré 2)", "key": "polynomial", ... },
      { "name": "Random Forest", "key": "random_forest", ... },
      { "name": "ARIMA(1, 1, 1)", "key": "arima", ... }
    ],
    "ensemble": {
      "name": "Ensemble (pondéré par R²)", "key": "ensemble",
      "forecast": [77652, 78237, ...],
      "weights": {"linear": 0.169, "polynomial": 0.184,
                  "random_forest": 0.561, "arima": 0.086}
    },
    "best_model": "random_forest",
    "category_breakdown": {
      "Consumer": {"total": 1148060.53, "count": 5101}, ...
    }
  }
}
```

## Résultats validés sur train.csv (9800 lignes)

| Modèle | R² | MAE | Prévision P+1 |
|---|---|---|---|
| Régression linéaire | 0.248 | 17 401 | 68 879 |
| Régression polynomiale | 0.270 | 17 024 | 77 712 |
| Random Forest | **0.824** | **8 390** | 80 812 |
| ARIMA(1,1,1) | 0.126 | 17 530 | 74 121 |
| Ensemble (pondéré R²) | — | — | 77 652 |

Random Forest est le meilleur modèle (capture la saisonnalité). L'ensemble lui
donne 56% du poids.

## Prochaine étape (étape 3)

Frontend : landing page ForecastIQ, login, signup, navbar — branchés sur ce backend.
