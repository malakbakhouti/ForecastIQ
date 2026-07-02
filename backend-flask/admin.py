"""
admin.py — Blueprint d'administration (réservé au rôle 'admin').

Routes :
- GET    /api/admin/users              : liste de tous les utilisateurs
- PUT    /api/admin/users/<id>/role    : changer le rôle d'un utilisateur
- PUT    /api/admin/users/<id>/status  : activer / désactiver un compte
- DELETE /api/admin/users/<id>         : supprimer un utilisateur
- GET    /api/admin/logs               : journal d'activité (paginé)
- GET    /api/admin/stats              : statistiques système
"""
from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError

from models import db, User, Dataset, Forecast, ActivityLog, log_activity
from decorators import require_role, current_user
from auth import validate_email, validate_password

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

VALID_ROLES = ("user", "manager", "admin")


@admin_bp.route("/users", methods=["GET"])
@require_role("admin")
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify({"users": [u.to_dict() for u in users]}), 200


@admin_bp.route("/users", methods=["POST"])
@require_role("admin")
def create_user():
    """L'admin crée un compte directement (avec n'importe quel rôle)."""
    me = current_user()
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    role = data.get("role") or "user"

    if not validate_email(email):
        return jsonify({"error": "Email invalide"}), 400
    ok, msg = validate_password(password)
    if not ok:
        return jsonify({"error": msg}), 400
    if not full_name or len(full_name) < 2:
        return jsonify({"error": "Nom complet requis (≥ 2 caractères)"}), 400
    if role not in VALID_ROLES:
        return jsonify({"error": f"Rôle invalide. Valeurs : {VALID_ROLES}"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Cet email est déjà utilisé"}), 409

    user = User(email=email, full_name=full_name, role=role, is_active=True)
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Cet email est déjà utilisé"}), 409

    log_activity(
        user_id=me.id, action="create_user",
        target_type="user", target_id=user.id,
        details={"email": email, "role": role},
        ip=request.remote_addr,
    )
    return jsonify({"user": user.to_dict()}), 201


@admin_bp.route("/users/<int:user_id>", methods=["PUT"])
@require_role("admin")
def update_user(user_id):
    """Modifier un utilisateur (nom, email, rôle, mot de passe)."""
    me = current_user()
    target = User.query.get(user_id)
    if target is None:
        return jsonify({"error": "Utilisateur introuvable"}), 404

    data = request.get_json(silent=True) or {}
    changes = {}

    # Nom complet
    if "full_name" in data:
        new_name = (data.get("full_name") or "").strip()
        if not new_name or len(new_name) < 2:
            return jsonify({"error": "Nom complet requis (≥ 2 caractères)"}), 400
        if new_name != target.full_name:
            changes["full_name"] = {"from": target.full_name, "to": new_name}
            target.full_name = new_name

    # Email
    if "email" in data:
        new_email = (data.get("email") or "").strip().lower()
        if not validate_email(new_email):
            return jsonify({"error": "Email invalide"}), 400
        if new_email != target.email:
            # Vérifier l'unicité
            existing = User.query.filter_by(email=new_email).first()
            if existing and existing.id != target.id:
                return jsonify({"error": "Cet email est déjà utilisé"}), 409
            changes["email"] = {"from": target.email, "to": new_email}
            target.email = new_email

    # Rôle
    if "role" in data:
        new_role = data.get("role")
        if new_role not in VALID_ROLES:
            return jsonify({"error": f"Rôle invalide. Valeurs : {VALID_ROLES}"}), 400
        if target.id == me.id and new_role != "admin":
            return jsonify({"error": "Vous ne pouvez pas modifier votre propre rôle"}), 400
        if new_role != target.role:
            changes["role"] = {"from": target.role, "to": new_role}
            target.role = new_role

    # Mot de passe (optionnel — uniquement si fourni)
    if "password" in data and data.get("password"):
        new_password = data.get("password")
        ok, msg = validate_password(new_password)
        if not ok:
            return jsonify({"error": msg}), 400
        target.set_password(new_password)
        changes["password"] = {"reset": True}

    if not changes:
        return jsonify({"user": target.to_dict(), "message": "Aucun changement"}), 200

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Erreur d'intégrité"}), 409

    log_activity(
        user_id=me.id, action="update_user",
        target_type="user", target_id=target.id,
        details={"changes": changes, "email": target.email},
        ip=request.remote_addr,
    )
    return jsonify({"user": target.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>/role", methods=["PUT"])
@require_role("admin")
def change_role(user_id):
    me = current_user()
    data = request.get_json(silent=True) or {}
    new_role = data.get("role")

    if new_role not in VALID_ROLES:
        return jsonify({"error": f"Rôle invalide. Valeurs : {VALID_ROLES}"}), 400

    target = User.query.get(user_id)
    if target is None:
        return jsonify({"error": "Utilisateur introuvable"}), 404

    if target.id == me.id and new_role != "admin":
        return jsonify({"error": "Vous ne pouvez pas modifier votre propre rôle"}), 400

    old_role = target.role
    target.role = new_role
    db.session.commit()

    log_activity(
        user_id=me.id, action="role_change",
        target_type="user", target_id=target.id,
        details={"from": old_role, "to": new_role, "email": target.email},
        ip=request.remote_addr,
    )
    return jsonify({"user": target.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>/status", methods=["PUT"])
@require_role("admin")
def change_status(user_id):
    me = current_user()
    data = request.get_json(silent=True) or {}
    is_active = data.get("is_active")

    if not isinstance(is_active, bool):
        return jsonify({"error": "is_active doit être true ou false"}), 400

    target = User.query.get(user_id)
    if target is None:
        return jsonify({"error": "Utilisateur introuvable"}), 404
    if target.id == me.id and not is_active:
        return jsonify({"error": "Vous ne pouvez pas désactiver votre propre compte"}), 400

    target.is_active = is_active
    db.session.commit()

    log_activity(
        user_id=me.id, action="status_change",
        target_type="user", target_id=target.id,
        details={"is_active": is_active, "email": target.email},
        ip=request.remote_addr,
    )
    return jsonify({"user": target.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@require_role("admin")
def delete_user(user_id):
    me = current_user()
    target = User.query.get(user_id)
    if target is None:
        return jsonify({"error": "Utilisateur introuvable"}), 404
    if target.id == me.id:
        return jsonify({"error": "Vous ne pouvez pas supprimer votre propre compte"}), 400

    email = target.email
    db.session.delete(target)
    db.session.commit()

    log_activity(
        user_id=me.id, action="delete_user",
        target_type="user", target_id=user_id,
        details={"email": email}, ip=request.remote_addr,
    )
    return jsonify({"message": "Utilisateur supprimé"}), 200


@admin_bp.route("/logs", methods=["GET"])
@require_role("admin")
def list_logs():
    limit = min(int(request.args.get("limit", 50)), 200)
    offset = int(request.args.get("offset", 0))

    query = ActivityLog.query.order_by(ActivityLog.created_at.desc())
    total = query.count()
    logs = query.offset(offset).limit(limit).all()

    return jsonify({
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [log.to_dict() for log in logs],
    }), 200


@admin_bp.route("/stats", methods=["GET"])
@require_role("admin")
def system_stats():
    return jsonify({
        "users": {
            "total": User.query.count(),
            "active": User.query.filter_by(is_active=True).count(),
            "by_role": {
                role: User.query.filter_by(role=role).count()
                for role in VALID_ROLES
            },
        },
        "datasets": Dataset.query.count(),
        "forecasts": Forecast.query.count(),
        "activity_logs": ActivityLog.query.count(),
    }), 200
