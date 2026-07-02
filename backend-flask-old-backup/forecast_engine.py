"""
forecast_engine.py — Moteur de prévision des ventes (couche IA).

Implémente 4 algorithmes de Machine Learning + un ensemble :
  1. Régression linéaire OLS    (scikit-learn LinearRegression)
  2. Régression polynomiale     (scikit-learn PolynomialFeatures degré 2)
  3. Random Forest              (scikit-learn RandomForestRegressor)
  4. ARIMA                      (statsmodels — séries temporelles)
  + Ensemble : moyenne pondérée par le R² de chaque modèle

Métriques MAE, RMSE, R² pour chaque modèle.
Détection d'anomalies par Z-score (seuil 2σ).
"""
import warnings
import numpy as np
import pandas as pd

from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

warnings.filterwarnings("ignore")  # ARIMA est bavard


GRANULARITY_RULES = {"daily": "D", "weekly": "W", "monthly": "MS"}


def aggregate_series(df, granularity="monthly"):
    """Agrège df (colonnes _date, _value) par période. Retourne [{period, value}]."""
    rule = GRANULARITY_RULES.get(granularity, "MS")
    s = df.set_index("_date")["_value"].resample(rule).sum().fillna(0)
    return [
        {"period": idx.strftime("%Y-%m-%d"), "value": round(float(val), 2)}
        for idx, val in s.items()
    ]


def compute_metrics(y_true, y_pred):
    """
    Calcule MAE, RMSE, R², MAPE et accuracy_pct.

    MAPE = Mean Absolute Percentage Error (erreur moyenne en %)
    accuracy_pct = 100 - MAPE = qualité du modèle en %
    Si accuracy_pct >= 70% → modèle fiable, sinon → à rejeter.
    """
    if len(y_true) < 2:
        return {"mae": None, "rmse": None, "r2": None, "mape": None, "accuracy_pct": None}

    y_true_arr = np.array(y_true, dtype=float)
    y_pred_arr = np.array(y_pred, dtype=float)

    mae = mean_absolute_error(y_true_arr, y_pred_arr)
    rmse = float(np.sqrt(mean_squared_error(y_true_arr, y_pred_arr)))
    try:
        r2 = r2_score(y_true_arr, y_pred_arr)
    except Exception:
        r2 = None

    # MAPE — on évite la division par zéro
    nonzero = y_true_arr != 0
    if nonzero.sum() > 0:
        mape = float(np.mean(np.abs((y_true_arr[nonzero] - y_pred_arr[nonzero]) / y_true_arr[nonzero])) * 100)
        # Plafonner MAPE à 100% pour que accuracy reste positive ou nulle
        mape_capped = min(mape, 100.0)
        accuracy_pct = round(100.0 - mape_capped, 2)
    else:
        mape = None
        accuracy_pct = None

    return {
        "mae": round(float(mae), 2),
        "rmse": round(rmse, 2),
        "r2": round(float(r2), 4) if r2 is not None else None,
        "mape": round(mape, 2) if mape is not None else None,
        "accuracy_pct": accuracy_pct,
    }


# ============================================================
# VALIDATION TRAIN/TEST (80% / 20%)
# ============================================================
def train_test_validation(values, test_ratio=0.2):
    """
    Validation hold-out : on découpe la série en 80% train et 20% test,
    on entraîne chaque modèle UNIQUEMENT sur le train, puis on compare
    ses prédictions avec les vraies valeurs du test.

    C'est la VRAIE mesure de précision prédictive (sur données jamais vues).

    Retourne pour chaque modèle :
      - accuracy_pct : précision en % (100 - MAPE)
      - is_reliable : True si accuracy >= 70%, False sinon
      - les autres métriques (R², MAE, RMSE, MAPE)
    """
    n = len(values)
    if n < 10:
        # Trop peu de données pour faire un split fiable
        return {"error": "Pas assez de données pour la validation (minimum 10 périodes)"}

    # Découpage chronologique : le test = les dernières 20% périodes
    n_train = int(n * (1 - test_ratio))
    train = values[:n_train]
    test = values[n_train:]
    n_test = len(test)

    results = {}

    # --- Modèle 1 : Régression linéaire ---
    X_train = np.arange(n_train).reshape(-1, 1)
    model_lin = LinearRegression().fit(X_train, np.array(train))
    X_test = np.arange(n_train, n).reshape(-1, 1)
    pred_lin = model_lin.predict(X_test)
    results["linear"] = compute_metrics(test, pred_lin)
    results["linear"]["predictions"] = [round(float(v), 2) for v in pred_lin]

    # --- Modèle 2 : Régression polynomiale (degré 2) ---
    poly = PolynomialFeatures(degree=2)
    X_train_poly = poly.fit_transform(X_train)
    model_poly = LinearRegression().fit(X_train_poly, np.array(train))
    X_test_poly = poly.transform(X_test)
    pred_poly = model_poly.predict(X_test_poly)
    results["polynomial"] = compute_metrics(test, pred_poly)
    results["polynomial"]["predictions"] = [round(float(v), 2) for v in pred_poly]

    # --- Modèle 3 : Random Forest (avec lags) ---
    n_lags = min(3, n_train - 1)
    if n_train > n_lags + 1:
        X_rf_train, y_rf_train = [], []
        train_arr = np.array(train)
        for i in range(n_lags, n_train):
            X_rf_train.append(train_arr[i - n_lags:i])
            y_rf_train.append(train_arr[i])
        model_rf = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=8)
        model_rf.fit(np.array(X_rf_train), np.array(y_rf_train))
        # Prédiction itérative sur le test
        pred_rf = []
        window = list(train_arr[-n_lags:])
        for _ in range(n_test):
            p = model_rf.predict(np.array(window[-n_lags:]).reshape(1, -1))[0]
            pred_rf.append(p)
            window.append(p)
        results["random_forest"] = compute_metrics(test, pred_rf)
        results["random_forest"]["predictions"] = [round(float(v), 2) for v in pred_rf]
    else:
        results["random_forest"] = {"accuracy_pct": None, "error": "Pas assez de données", "predictions": []}

    # --- Modèle 4 : ARIMA ---
    from statsmodels.tsa.arima.model import ARIMA
    try:
        arima_fit = ARIMA(np.array(train, dtype=float), order=(1, 1, 1)).fit()
        pred_arima = arima_fit.forecast(steps=n_test)
        results["arima"] = compute_metrics(test, pred_arima)
        results["arima"]["predictions"] = [round(float(v), 2) for v in pred_arima]
    except Exception as e:
        results["arima"] = {"accuracy_pct": None, "error": str(e), "predictions": []}

    # Ajouter is_reliable (seuil 70%) et le verdict pour chaque modèle
    THRESHOLD = 70.0
    for key, metrics in results.items():
        acc = metrics.get("accuracy_pct")
        if acc is None:
            metrics["is_reliable"] = False
            metrics["verdict"] = "non évaluable"
        elif acc >= THRESHOLD:
            metrics["is_reliable"] = True
            metrics["verdict"] = "fiable"
        else:
            metrics["is_reliable"] = False
            metrics["verdict"] = "à rejeter"

    return {
        "n_train": n_train,
        "n_test": n_test,
        "threshold_pct": THRESHOLD,
        "test_values": [round(float(v), 2) for v in test],
        "models": results,
    }


# ----- Modèle 1 : Régression linéaire OLS -----
def forecast_linear(values, horizon):
    n = len(values)
    X = np.arange(n).reshape(-1, 1)
    y = np.array(values)

    model = LinearRegression()
    model.fit(X, y)

    fitted = model.predict(X)
    future_X = np.arange(n, n + horizon).reshape(-1, 1)
    forecast = model.predict(future_X)

    return {
        "name": "Régression linéaire",
        "key": "linear",
        "fitted": [round(float(v), 2) for v in fitted],
        "forecast": [round(float(v), 2) for v in forecast],
        "slope": round(float(model.coef_[0]), 2),
        "metrics": compute_metrics(y, fitted),
    }


# ----- Modèle 2 : Régression polynomiale -----
def forecast_polynomial(values, horizon, degree=2):
    n = len(values)
    X = np.arange(n).reshape(-1, 1)
    y = np.array(values)

    poly = PolynomialFeatures(degree=degree)
    X_poly = poly.fit_transform(X)

    model = LinearRegression()
    model.fit(X_poly, y)

    fitted = model.predict(X_poly)
    future_X = poly.transform(np.arange(n, n + horizon).reshape(-1, 1))
    forecast = model.predict(future_X)

    return {
        "name": f"Régression polynomiale (degré {degree})",
        "key": "polynomial",
        "fitted": [round(float(v), 2) for v in fitted],
        "forecast": [round(float(v), 2) for v in forecast],
        "metrics": compute_metrics(y, fitted),
    }


# ----- Modèle 3 : Random Forest -----
def forecast_random_forest(values, horizon, n_lags=3):
    n = len(values)
    y = np.array(values)

    if n <= n_lags + 1:
        lin = forecast_linear(values, horizon)
        lin["name"] = "Random Forest (fallback linéaire)"
        lin["key"] = "random_forest"
        return lin

    X_train, y_train = [], []
    for i in range(n_lags, n):
        X_train.append(y[i - n_lags:i])
        y_train.append(y[i])
    X_train = np.array(X_train)
    y_train = np.array(y_train)

    model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=8)
    model.fit(X_train, y_train)

    fitted_partial = model.predict(X_train)
    fitted = list(y[:n_lags]) + list(fitted_partial)

    forecast = []
    window = list(y[-n_lags:])
    for _ in range(horizon):
        pred = model.predict(np.array(window[-n_lags:]).reshape(1, -1))[0]
        forecast.append(pred)
        window.append(pred)

    return {
        "name": "Random Forest",
        "key": "random_forest",
        "fitted": [round(float(v), 2) for v in fitted],
        "forecast": [round(float(v), 2) for v in forecast],
        "metrics": compute_metrics(y_train, fitted_partial),
    }


# ----- Modèle 4 : ARIMA -----
def forecast_arima(values, horizon, order=(1, 1, 1)):
    from statsmodels.tsa.arima.model import ARIMA

    y = np.array(values, dtype=float)
    n = len(y)

    if n < 6:
        lin = forecast_linear(values, horizon)
        lin["name"] = "ARIMA (fallback linéaire)"
        lin["key"] = "arima"
        return lin

    try:
        model = ARIMA(y, order=order)
        fit = model.fit()
        fitted = fit.fittedvalues
        forecast = fit.forecast(steps=horizon)

        if len(fitted) < n:
            fitted = np.concatenate([[y[0]], fitted])
        fitted = fitted[:n]

        return {
            "name": f"ARIMA{order}",
            "key": "arima",
            "fitted": [round(float(v), 2) for v in fitted],
            "forecast": [round(float(v), 2) for v in forecast],
            "metrics": compute_metrics(y, fitted),
        }
    except Exception as e:
        lin = forecast_linear(values, horizon)
        lin["name"] = "ARIMA (fallback linéaire)"
        lin["key"] = "arima"
        lin["error"] = str(e)
        return lin


# ----- Ensemble -----
def build_ensemble(models, horizon, validation=None):
    """
    Combine les prévisions, pondérées par la précision train/test des modèles.
    Si validation est fournie, seuls les modèles avec is_reliable=True (≥70%)
    sont inclus. Sinon, fallback sur la pondération par R² in-sample.
    """
    # Cas 1 : on a la validation train/test → on filtre par fiabilité
    if validation and "models" in validation:
        reliable_models = []
        reliable_weights = []
        for m in models:
            val_data = validation["models"].get(m["key"], {})
            if val_data.get("is_reliable"):
                acc = val_data.get("accuracy_pct", 70) / 100.0  # poids = accuracy
                reliable_models.append(m)
                reliable_weights.append(max(acc, 0.01))

        # Si au moins un modèle fiable existe, on construit l'ensemble fiable
        if reliable_models:
            total = sum(reliable_weights) or 1.0
            reliable_weights = [w / total for w in reliable_weights]

            ensemble_forecast = []
            for h in range(horizon):
                val = sum(reliable_models[i]["forecast"][h] * reliable_weights[i]
                          for i in range(len(reliable_models)))
                ensemble_forecast.append(round(float(val), 2))

            return {
                "name": "Ensemble (modèles fiables uniquement, ≥70%)",
                "key": "ensemble",
                "forecast": ensemble_forecast,
                "weights": {reliable_models[i]["key"]: round(reliable_weights[i], 3)
                            for i in range(len(reliable_models))},
                "reliable_models": [m["key"] for m in reliable_models],
                "all_rejected": False,
            }
        else:
            # Aucun modèle fiable : on retourne un ensemble vide avec une alerte
            return {
                "name": "Aucun modèle fiable",
                "key": "ensemble",
                "forecast": [None] * horizon,
                "weights": {},
                "reliable_models": [],
                "all_rejected": True,
            }

    # Cas 2 : fallback historique → pondération par R² in-sample
    weights = []
    for m in models:
        r2 = m["metrics"].get("r2")
        w = max(r2, 0.01) if isinstance(r2, (int, float)) else 0.01
        weights.append(w)

    total = sum(weights) or 1.0
    weights = [w / total for w in weights]

    ensemble_forecast = []
    for h in range(horizon):
        val = sum(models[i]["forecast"][h] * weights[i] for i in range(len(models)))
        ensemble_forecast.append(round(float(val), 2))

    return {
        "name": "Ensemble (pondéré par R²)",
        "key": "ensemble",
        "forecast": ensemble_forecast,
        "weights": {models[i]["key"]: round(weights[i], 3) for i in range(len(models))},
        "reliable_models": [m["key"] for m in models],
        "all_rejected": False,
    }


# ----- Anomalies -----
def detect_anomalies(series, threshold=2.0):
    """Anomalies = points dont |z-score| > seuil."""
    values = [p["value"] for p in series]
    n = len(values)
    if n < 3:
        return []
    mean = float(np.mean(values))
    std = float(np.std(values))
    if std == 0:
        return []

    anomalies = []
    for p in series:
        z = (p["value"] - mean) / std
        if abs(z) > threshold:
            anomalies.append({
                "period": p["period"],
                "value": p["value"],
                "zscore": round(z, 3),
            })
    return anomalies


# ----- Stats descriptives -----
def descriptive_stats(series):
    values = [p["value"] for p in series]
    n = len(values)
    if n == 0:
        return {}
    total = float(np.sum(values))
    mean = float(np.mean(values))
    growth = ((values[-1] / values[0]) - 1) * 100 if values[0] else 0.0
    max_idx = int(np.argmax(values))

    return {
        "total": round(total, 2),
        "mean": round(mean, 2),
        "min": round(float(np.min(values)), 2),
        "max": round(float(np.max(values)), 2),
        "max_period": series[max_idx]["period"],
        "growth_percent": round(growth, 1),
        "periods": n,
    }


def moving_average(values, window=3):
    s = pd.Series(values)
    return [round(float(v), 2) for v in s.rolling(window, center=True, min_periods=1).mean()]


# ----- Orchestration complète -----
def run_full_forecast(df, granularity="monthly", horizon=6, category_column=None):
    """Exécute l'analyse complète. Retourne un dict JSON-sérialisable."""
    series = aggregate_series(df, granularity)

    if len(series) < 2:
        raise ValueError("Pas assez de données après agrégation (minimum 2 périodes)")

    values = [p["value"] for p in series]

    m_linear = forecast_linear(values, horizon)
    m_poly = forecast_polynomial(values, horizon)
    m_rf = forecast_random_forest(values, horizon)
    m_arima = forecast_arima(values, horizon)
    models = [m_linear, m_poly, m_rf, m_arima]

    # 1. Validation train/test (80% / 20%) — précision réelle sur données jamais vues
    validation = train_test_validation(values, test_ratio=0.2)

    # 2. Ajouter les labels (dates) du test set pour l'affichage de la comparaison
    if validation and not validation.get("error"):
        n_train = validation["n_train"]
        validation["test_labels"] = [p["period"] for p in series[n_train:]]

    # 3. Construire l'ensemble UNIQUEMENT à partir des modèles fiables (≥70%)
    ensemble = build_ensemble(models, horizon, validation=validation)
    forecast_labels = [f"Prév.+{i + 1}" for i in range(horizon)]

    best = max(
        models,
        key=lambda m: m["metrics"].get("r2") if isinstance(m["metrics"].get("r2"), (int, float)) else -999
    )

    category_breakdown = None
    if category_column and category_column in df.columns:
        grp = df.groupby(category_column)["_value"].agg(["sum", "count"])
        category_breakdown = {
            str(k): {"total": round(float(v["sum"]), 2), "count": int(v["count"])}
            for k, v in grp.iterrows()
        }

    return {
        "granularity": granularity,
        "horizon": horizon,
        "series": series,
        "forecast_labels": forecast_labels,
        "moving_average": moving_average(values, 3),
        "stats": descriptive_stats(series),
        "anomalies": detect_anomalies(series, 2.0),
        "models": models,
        "ensemble": ensemble,
        "best_model": best["key"],
        "category_breakdown": category_breakdown,
        "validation": validation,
    }
