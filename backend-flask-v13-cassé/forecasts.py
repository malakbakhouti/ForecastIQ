"""
forecasts.py — Blueprint des prévisions et du tableau de bord.

Routes :
- POST /api/forecasts/run                  : lancer une prévision (user, admin)
- GET  /api/forecasts/<id>                 : récupérer une prévision sauvegardée
- GET  /api/datasets/<id>/dashboard        : données complètes pour le dashboard
- GET  /api/datasets/<id>/forecasts        : historique des prévisions d'un dataset
"""
from flask import Blueprint, request, jsonify

from models import db, Dataset, Forecast, log_activity
from decorators import require_auth, require_role, current_user
from csv_analyzer import load_file, clean_dataframe
from forecast_engine import run_full_forecast

forecasts_bp = Blueprint("forecasts", __name__, url_prefix="/api")


def can_access_dataset(ds, user):
    """Manager : tous datasets (lecture). User : ses propres datasets. Admin : aucun (gestion pure)."""
    if user.role == "manager":
        return True
    if user.role == "user":
        return ds.user_id == user.id
    return False


def _prepare_clean_df(ds):
    """Charge et nettoie le DataFrame d'un dataset selon son mapping."""
    df = load_file(ds.storage_path)
    clean, report = clean_dataframe(
        df, ds.detected_date_column, ds.detected_value_column, ds.date_format
    )
    return clean, report


# ---------------------------------------------------------------------------
# Lancer une prévision
# ---------------------------------------------------------------------------
@forecasts_bp.route("/forecasts/run", methods=["POST"])
@require_role("user", "admin")
def run_forecast():
    user = current_user()
    data = request.get_json(silent=True) or {}

    dataset_id = data.get("dataset_id")
    granularity = data.get("granularity", "monthly")
    horizon = int(data.get("horizon", 6))
    category_column = data.get("category_column")

    if granularity not in ("daily", "weekly", "monthly"):
        return jsonify({"error": "granularity doit être daily, weekly ou monthly"}), 400
    if not (1 <= horizon <= 120):
        return jsonify({"error": "horizon doit être entre 1 et 120"}), 400

    ds = Dataset.query.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404
    if ds.user_id != user.id and user.role != "admin":
        return jsonify({"error": "Accès refusé"}), 403

    if not ds.detected_date_column or not ds.detected_value_column:
        return jsonify({"error": "Mapping incomplet : colonnes date/valeur non définies"}), 400

    # Exécution du moteur IA
    try:
        clean, clean_report = _prepare_clean_df(ds)
        result = run_full_forecast(
            clean, granularity=granularity, horizon=horizon,
            category_column=category_column,
        )
    except Exception as e:
        return jsonify({"error": f"Échec de la prévision : {e}"}), 400

    # Sauvegarde du meilleur modèle dans la table forecasts
    best_key = result["best_model"]
    best = next(m for m in result["models"] if m["key"] == best_key)
    fc = Forecast(
        dataset_id=ds.id,
        algorithm=best_key,
        horizon=horizon,
        granularity=granularity,
        results=result,
        mae=best["metrics"].get("mae"),
        rmse=best["metrics"].get("rmse"),
        r2=best["metrics"].get("r2"),
    )
    db.session.add(fc)
    db.session.commit()

    log_activity(
        user_id=user.id, action="forecast",
        target_type="dataset", target_id=ds.id,
        details={"granularity": granularity, "horizon": horizon, "best": best_key},
        ip=request.remote_addr,
    )

    return jsonify({
        "forecast_id": fc.id,
        "cleaning_report": clean_report,
        "result": result,
    }), 201


# ---------------------------------------------------------------------------
# Récupérer une prévision sauvegardée
# ---------------------------------------------------------------------------
@forecasts_bp.route("/forecasts/<int:forecast_id>", methods=["GET"])
@require_auth
def get_forecast(forecast_id):
    user = current_user()
    fc = Forecast.query.get(forecast_id)
    if fc is None:
        return jsonify({"error": "Prévision introuvable"}), 404
    if not can_access_dataset(fc.dataset, user):
        return jsonify({"error": "Accès refusé"}), 403
    return jsonify({"forecast": fc.to_dict()}), 200


# ---------------------------------------------------------------------------
# Historique des prévisions d'un dataset
# ---------------------------------------------------------------------------
@forecasts_bp.route("/datasets/<int:dataset_id>/forecasts", methods=["GET"])
@require_auth
def list_forecasts(dataset_id):
    user = current_user()
    ds = Dataset.query.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404
    if not can_access_dataset(ds, user):
        return jsonify({"error": "Accès refusé"}), 403

    items = (
        Forecast.query.filter_by(dataset_id=dataset_id)
        .order_by(Forecast.created_at.desc())
        .all()
    )
    # Version légère (sans le gros champ results)
    summary = [{
        "id": f.id,
        "algorithm": f.algorithm,
        "horizon": f.horizon,
        "granularity": f.granularity,
        "metrics": {"mae": f.mae, "rmse": f.rmse, "r2": f.r2},
        "created_at": f.created_at.isoformat() if f.created_at else None,
    } for f in items]
    return jsonify({"forecasts": summary}), 200


# ---------------------------------------------------------------------------
# Dashboard — données complètes pour le frontend
# ---------------------------------------------------------------------------
@forecasts_bp.route("/datasets/<int:dataset_id>/dashboard", methods=["GET"])
@require_auth
def dashboard(dataset_id):
    """
    Calcule à la volée toutes les données du tableau de bord.
    Query params : granularity (monthly/weekly/daily), horizon (1-120),
                    category (nom de colonne catégorielle).
    """
    user = current_user()
    ds = Dataset.query.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404
    if not can_access_dataset(ds, user):
        return jsonify({"error": "Accès refusé"}), 403

    granularity = request.args.get("granularity", "monthly")
    horizon = int(request.args.get("horizon", 6))
    category = request.args.get("category") or (
        ds.detected_category_columns[0] if ds.detected_category_columns else None
    )

    if granularity not in ("daily", "weekly", "monthly"):
        return jsonify({"error": "granularity invalide"}), 400
    horizon = max(1, min(horizon, 120))

    try:
        clean, clean_report = _prepare_clean_df(ds)
        result = run_full_forecast(
            clean, granularity=granularity, horizon=horizon,
            category_column=category,
        )
    except Exception as e:
        return jsonify({"error": f"Calcul impossible : {e}"}), 400

    return jsonify({
        "dataset": ds.to_dict(),
        "cleaning_report": clean_report,
        "available_categories": ds.detected_category_columns or [],
        "active_category": category,
        "result": result,
    }), 200
