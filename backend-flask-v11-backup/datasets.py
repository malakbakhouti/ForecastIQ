"""
datasets.py — Blueprint de gestion des datasets.

Routes :
- POST   /api/datasets/upload       : upload CSV/Excel + analyse auto (user, admin)
- GET    /api/datasets              : liste (user=les siens, manager/admin=tous)
- GET    /api/datasets/<id>         : détails d'un dataset
- GET    /api/datasets/<id>/preview : 10 premières lignes
- PUT    /api/datasets/<id>/mapping : corriger le mapping des colonnes
- DELETE /api/datasets/<id>         : supprimer (propriétaire ou admin)
"""
import os
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename

from models import db, Dataset, log_activity
from decorators import require_auth, require_role, current_user
from csv_analyzer import analyze_file

datasets_bp = Blueprint("datasets", __name__, url_prefix="/api/datasets")


def allowed_file(filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in current_app.config["ALLOWED_EXTENSIONS"]


def can_access_dataset(ds, user):
    """Un user accède aux siens ; manager et admin accèdent à tout."""
    if user.role in ("admin", "manager"):
        return True
    return ds.user_id == user.id


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------
@datasets_bp.route("/upload", methods=["POST"])
@require_role("user", "admin")
def upload():
    user = current_user()

    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier fourni (champ 'file' manquant)"}), 400

    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "Nom de fichier vide"}), 400
    if not allowed_file(f.filename):
        return jsonify({
            "error": "Format non supporté",
            "allowed": list(current_app.config["ALLOWED_EXTENSIONS"])
        }), 400

    # Sauvegarde avec un nom unique
    original_name = secure_filename(f.filename)
    ext = original_name.rsplit(".", 1)[-1].lower()
    stored_name = f"{uuid.uuid4().hex}.{ext}"
    storage_path = os.path.join(current_app.config["UPLOAD_FOLDER"], stored_name)
    f.save(storage_path)
    file_size = os.path.getsize(storage_path)

    # Analyse automatique
    try:
        analysis = analyze_file(storage_path)
    except Exception as e:
        os.remove(storage_path)
        return jsonify({"error": f"Analyse impossible : {e}"}), 400

    # Enregistrement en base
    ds = Dataset(
        user_id=user.id,
        name=original_name,
        storage_path=storage_path,
        file_size=file_size,
        row_count=analysis["row_count"],
        column_count=analysis["column_count"],
        detected_date_column=analysis["detected"]["date_column"],
        detected_value_column=analysis["detected"]["value_column"],
        detected_category_columns=analysis["detected"]["category_columns"],
        date_format=analysis["detected"]["date_format"],
        analysis_summary={
            "columns": analysis["columns"],
            "category_details": analysis["category_details"],
            "date_confidence": analysis["detected"]["date_confidence"],
            "value_confidence": analysis["detected"]["value_confidence"],
        },
        status="analyzed",
    )
    db.session.add(ds)
    db.session.commit()

    log_activity(
        user_id=user.id, action="upload", target_type="dataset", target_id=ds.id,
        details={"name": original_name, "rows": analysis["row_count"]},
        ip=request.remote_addr,
    )

    return jsonify({
        "dataset": ds.to_dict(),
        "analysis": analysis,
    }), 201


# ---------------------------------------------------------------------------
# Liste
# ---------------------------------------------------------------------------
@datasets_bp.route("", methods=["GET"])
@require_auth
def list_datasets():
    user = current_user()
    if user.role in ("admin", "manager"):
        items = Dataset.query.order_by(Dataset.created_at.desc()).all()
    else:
        items = (
            Dataset.query.filter_by(user_id=user.id)
            .order_by(Dataset.created_at.desc())
            .all()
        )
    return jsonify({"datasets": [d.to_dict() for d in items]}), 200


# ---------------------------------------------------------------------------
# Détails
# ---------------------------------------------------------------------------
@datasets_bp.route("/<int:dataset_id>", methods=["GET"])
@require_auth
def get_dataset(dataset_id):
    user = current_user()
    ds = Dataset.query.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404
    if not can_access_dataset(ds, user):
        return jsonify({"error": "Accès refusé"}), 403

    data = ds.to_dict()
    data["analysis_summary"] = ds.analysis_summary
    return jsonify({"dataset": data}), 200


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------
@datasets_bp.route("/<int:dataset_id>/preview", methods=["GET"])
@require_auth
def preview_dataset(dataset_id):
    user = current_user()
    ds = Dataset.query.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404
    if not can_access_dataset(ds, user):
        return jsonify({"error": "Accès refusé"}), 403

    try:
        analysis = analyze_file(ds.storage_path)
        return jsonify({
            "columns": analysis["columns"],
            "preview": analysis["preview"],
            "row_count": analysis["row_count"],
        }), 200
    except Exception as e:
        return jsonify({"error": f"Lecture impossible : {e}"}), 400


# ---------------------------------------------------------------------------
# Correction du mapping
# ---------------------------------------------------------------------------
@datasets_bp.route("/<int:dataset_id>/mapping", methods=["PUT"])
@require_role("user", "admin")
def update_mapping(dataset_id):
    user = current_user()
    ds = Dataset.query.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404
    if ds.user_id != user.id and user.role != "admin":
        return jsonify({"error": "Accès refusé"}), 403

    data = request.get_json(silent=True) or {}
    if "date_column" in data:
        ds.detected_date_column = data["date_column"]
    if "value_column" in data:
        ds.detected_value_column = data["value_column"]
    if "category_columns" in data:
        ds.detected_category_columns = data["category_columns"]
    if "date_format" in data:
        ds.date_format = data["date_format"]

    db.session.commit()
    log_activity(
        user_id=user.id, action="update_mapping",
        target_type="dataset", target_id=ds.id, ip=request.remote_addr,
    )
    return jsonify({"dataset": ds.to_dict()}), 200


# ---------------------------------------------------------------------------
# Suppression
# ---------------------------------------------------------------------------
@datasets_bp.route("/<int:dataset_id>", methods=["DELETE"])
@require_auth
def delete_dataset(dataset_id):
    user = current_user()
    ds = Dataset.query.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404
    if ds.user_id != user.id and user.role != "admin":
        return jsonify({"error": "Accès refusé"}), 403

    # Supprimer le fichier physique
    try:
        if os.path.exists(ds.storage_path):
            os.remove(ds.storage_path)
    except Exception:
        pass

    db.session.delete(ds)
    db.session.commit()
    log_activity(
        user_id=user.id, action="delete_dataset",
        target_type="dataset", target_id=dataset_id, ip=request.remote_addr,
    )
    return jsonify({"message": "Dataset supprimé"}), 200


# ============================================================
# PRÉDICTION SUR ÉCHANTILLON DE NOUVELLES DONNÉES
# ============================================================
@datasets_bp.route("/<int:dataset_id>/predict-sample", methods=["POST"])
@require_auth
def predict_sample(dataset_id):
    """
    L'utilisateur a un dataset existant avec ses modèles entraînés.
    Il importe un échantillon de NOUVELLES données (CSV).
    L'app applique le meilleur modèle sur ces nouvelles données et retourne
    les prédictions avec le pourcentage de fiabilité du modèle.
    """
    import pandas as pd
    from csv_analyzer import load_file, detect_date_column
    from forecast_engine import run_full_forecast, aggregate_series

    user = current_user()
    ds = Dataset.query.get(dataset_id)
    if not ds:
        return jsonify({"error": "Dataset introuvable"}), 404
    if not can_access_dataset(ds, user):
        return jsonify({"error": "Accès refusé"}), 403

    # 1. Récupérer le fichier échantillon uploadé
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400
    f = request.files["file"]
    if not f or not allowed_file(f.filename):
        return jsonify({"error": "Format de fichier non supporté"}), 400

    # 2. Sauver temporairement le fichier
    filename = secure_filename(f.filename)
    tmp_id = uuid.uuid4().hex[:8]
    tmp_path = os.path.join(current_app.config["UPLOAD_FOLDER"], f"sample_{tmp_id}_{filename}")
    f.save(tmp_path)

    try:
        # 3. Lire l'échantillon avec le même mapping de colonnes que le dataset d'origine
        sample_df = load_file(tmp_path)
        date_col = ds.detected_date_column
        val_col = ds.detected_value_column

        if not date_col or not val_col:
            return jsonify({"error": "Le dataset d'origine n'a pas de mapping de colonnes"}), 400

        if date_col not in sample_df.columns or val_col not in sample_df.columns:
            return jsonify({
                "error": f"L'échantillon doit contenir les colonnes '{date_col}' et '{val_col}'",
                "expected_columns": [date_col, val_col],
                "found_columns": list(sample_df.columns),
            }), 400

        # 4. Nettoyer l'échantillon
        sample_df = sample_df[[date_col, val_col]].copy()
        sample_df.rename(columns={date_col: "_date", val_col: "_value"}, inplace=True)
        sample_df["_date"] = pd.to_datetime(sample_df["_date"], errors="coerce")
        sample_df["_value"] = pd.to_numeric(sample_df["_value"], errors="coerce")
        sample_df = sample_df.dropna().drop_duplicates(subset=["_date"]).sort_values("_date")

        if len(sample_df) < 2:
            return jsonify({"error": "Échantillon trop petit (au moins 2 lignes valides requises)"}), 400

        # 5. Agréger selon la granularité (passée en paramètre, défaut monthly)
        granularity = request.form.get("granularity") or request.args.get("granularity") or "monthly"
        if granularity not in ("monthly", "weekly", "daily"):
            granularity = "monthly"

        sample_series = aggregate_series(sample_df, granularity)
        sample_values = [p["value"] for p in sample_series]
        sample_labels = [p["period"] for p in sample_series]

        # 6. Charger le dataset original
        orig_df = load_file(ds.storage_path)
        orig_df = orig_df[[date_col, val_col]].copy()
        orig_df.rename(columns={date_col: "_date", val_col: "_value"}, inplace=True)
        orig_df["_date"] = pd.to_datetime(orig_df["_date"], errors="coerce")
        orig_df["_value"] = pd.to_numeric(orig_df["_value"], errors="coerce")
        orig_df = orig_df.dropna().drop_duplicates(subset=["_date"]).sort_values("_date")

        # 7. Lancer la prévision complète sur le dataset original
        # (entraîne les modèles + valide + identifie le meilleur fiable)
        full_result = run_full_forecast(
            orig_df,
            granularity=granularity,
            horizon=len(sample_values),  # même nombre de périodes que l'échantillon
        )

        # 8. Identifier le meilleur modèle fiable
        validation = full_result.get("validation", {})
        threshold = validation.get("threshold_pct", 70.0)
        reliable_models = [
            m for m in validation.get("models", [])
            if m.get("is_reliable")
        ]

        if not reliable_models:
            return jsonify({
                "error": "Aucun modèle fiable disponible — impossible de prédire l'échantillon",
                "threshold_pct": threshold,
                "validation": validation,
            }), 422

        # Choisir le modèle avec la meilleure précision
        best_model = max(reliable_models, key=lambda m: m.get("accuracy_pct", 0))
        best_key = best_model["key"]

        # 9. Récupérer les prédictions de ce modèle depuis l'ensemble
        ensemble = full_result.get("ensemble", {})
        predictions = ensemble.get("forecast", [])[:len(sample_values)]

        # 10. Comparer réel (échantillon) vs prédit (modèle)
        comparison = []
        total_abs_pct_error = 0
        n_valid = 0
        for i, (label, actual) in enumerate(zip(sample_labels, sample_values)):
            predicted = predictions[i] if i < len(predictions) else None
            if predicted is not None and actual != 0:
                pct_error = ((predicted - actual) / actual) * 100
                abs_pct_error = abs(pct_error)
                total_abs_pct_error += abs_pct_error
                n_valid += 1
                comparison.append({
                    "period": label,
                    "actual": round(float(actual), 2),
                    "predicted": round(float(predicted), 2),
                    "error_pct": round(pct_error, 2),
                    "accuracy_pct": round(100 - abs_pct_error, 2),
                })
            else:
                comparison.append({
                    "period": label,
                    "actual": round(float(actual), 2),
                    "predicted": round(float(predicted), 2) if predicted is not None else None,
                    "error_pct": None,
                    "accuracy_pct": None,
                })

        # Précision globale sur l'échantillon
        sample_mape = total_abs_pct_error / n_valid if n_valid > 0 else None
        sample_accuracy = (100 - sample_mape) if sample_mape is not None else None

        return jsonify({
            "model_used": {
                "key": best_key,
                "name": best_model.get("name", best_key),
                "accuracy_pct": best_model.get("accuracy_pct"),
                "mape": best_model.get("mape"),
                "is_reliable": True,
                "threshold_pct": threshold,
            },
            "sample_size": len(sample_values),
            "comparison": comparison,
            "sample_accuracy_pct": round(sample_accuracy, 2) if sample_accuracy is not None else None,
            "sample_mape": round(sample_mape, 2) if sample_mape is not None else None,
            "granularity": granularity,
        }), 200

    except Exception as e:
        return jsonify({"error": f"Erreur lors de la prédiction : {str(e)}"}), 500
    finally:
        # Supprimer le fichier temporaire
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
