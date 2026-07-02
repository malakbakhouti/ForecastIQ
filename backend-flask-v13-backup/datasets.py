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
    """Un user accède aux siens ; manager accède à tout en lecture.
    L'admin ne peut PAS analyser les données (rôle de gestion pure)."""
    if user.role == "manager":
        return True
    if user.role == "user":
        return ds.user_id == user.id
    # admin : accès uniquement pour la supervision (liste), pas pour analyser
    return False


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------
@datasets_bp.route("/upload", methods=["POST"])
@require_role("user")
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
    if ds.user_id != user.id or user.role != "user":
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
    if ds.user_id != user.id or user.role != "user":
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
# MANAGER : Annotation et validation des datasets
# ============================================================
@datasets_bp.route("/<int:dataset_id>/annotation", methods=["PUT"])
@require_role("manager", "admin")
def update_annotation(dataset_id):
    """Le manager (ou admin) annote un dataset avec un commentaire stratégique."""
    user = current_user()
    ds = Dataset.query.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data = request.get_json(silent=True) or {}
    annotation = (data.get("annotation") or "").strip()
    if len(annotation) > 2000:
        return jsonify({"error": "Annotation trop longue (max 2000 caractères)"}), 400

    ds.annotation = annotation if annotation else None
    db.session.commit()

    log_activity(
        user_id=user.id, action="annotate_dataset",
        target_type="dataset", target_id=ds.id,
        details={"annotation_length": len(annotation)},
        ip=request.remote_addr,
    )
    return jsonify({"dataset": ds.to_dict()}), 200


@datasets_bp.route("/<int:dataset_id>/validation", methods=["PUT"])
@require_role("manager", "admin")
def update_validation(dataset_id):
    """Le manager (ou admin) marque le statut de validation du dataset."""
    from datetime import datetime
    user = current_user()
    ds = Dataset.query.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data = request.get_json(silent=True) or {}
    status = data.get("validation_status")
    VALID_STATUSES = ("pending", "validated", "to_review", "rejected")
    if status not in VALID_STATUSES:
        return jsonify({"error": f"Statut invalide. Valeurs : {VALID_STATUSES}"}), 400

    old_status = ds.validation_status
    ds.validation_status = status
    ds.validated_by_id = user.id
    ds.validated_at = datetime.utcnow()
    db.session.commit()

    log_activity(
        user_id=user.id, action="validate_dataset",
        target_type="dataset", target_id=ds.id,
        details={"from": old_status, "to": status},
        ip=request.remote_addr,
    )
    return jsonify({"dataset": ds.to_dict()}), 200
