"""
Blueprint d'authentification.

Routes :
- POST /api/auth/register        : créer un compte (rôle 'user' par défaut)
- POST /api/auth/login           : se connecter, retourne JWT
- GET  /api/auth/me              : infos de l'utilisateur connecté
- POST /api/auth/logout          : log l'activité (le JWT est invalidé côté client)
- POST /api/auth/change-password : changer son mot de passe
"""
import re
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token
from sqlalchemy.exc import IntegrityError

from models import db, User, log_activity
from decorators import require_auth, current_user

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# ---------- Validation ----------
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")

def validate_email(email: str) -> bool:
    return isinstance(email, str) and bool(EMAIL_RE.match(email))

def validate_password(pwd: str) -> tuple[bool, str]:
    """Au moins 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre."""
    if not isinstance(pwd, str) or len(pwd) < 8:
        return False, "Le mot de passe doit faire au moins 8 caractères"
    if not re.search(r"[A-Z]", pwd):
        return False, "Le mot de passe doit contenir au moins une majuscule"
    if not re.search(r"[a-z]", pwd):
        return False, "Le mot de passe doit contenir au moins une minuscule"
    if not re.search(r"\d", pwd):
        return False, "Le mot de passe doit contenir au moins un chiffre"
    return True, ""


# ---------- Helpers ----------
def get_client_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"

def issue_token(user: User) -> str:
    """Génère un JWT contenant le rôle dans les claims."""
    return create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "email": user.email}
    )


# ---------- Routes ----------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()

    if not validate_email(email):
        return jsonify({"error": "Email invalide"}), 400
    ok, msg = validate_password(password)
    if not ok:
        return jsonify({"error": msg}), 400
    if not full_name or len(full_name) < 2:
        return jsonify({"error": "Nom complet requis (≥ 2 caractères)"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Cet email est déjà utilisé"}), 409

    user = User(email=email, full_name=full_name, role="user")
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Cet email est déjà utilisé"}), 409

    log_activity(
        user_id=user.id, action="register",
        ip=get_client_ip(),
        user_agent=request.headers.get("User-Agent", "")[:255],
    )

    token = issue_token(user)
    return jsonify({"token": token, "user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email et mot de passe requis"}), 400

    user = User.query.filter_by(email=email).first()

    # Toujours renvoyer un message générique pour ne pas révéler si l'email existe
    generic_error = jsonify({"error": "Identifiants invalides"}), 401

    if user is None:
        return generic_error

    if not user.is_active:
        return jsonify({"error": "Compte désactivé"}), 403

    if user.is_locked():
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        return jsonify({
            "error": f"Compte temporairement verrouillé. Réessayez dans {remaining} minutes.",
            "locked_until": user.locked_until.isoformat()
        }), 423

    if not user.check_password(password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= current_app.config["MAX_LOGIN_ATTEMPTS"]:
            user.locked_until = datetime.utcnow() + timedelta(
                minutes=current_app.config["LOCKOUT_MINUTES"]
            )
            user.failed_login_attempts = 0
        db.session.commit()
        log_activity(
            user_id=user.id, action="login", status="failure",
            ip=get_client_ip(), user_agent=request.headers.get("User-Agent", "")[:255]
        )
        return generic_error

    # Succès
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()
    db.session.commit()

    log_activity(
        user_id=user.id, action="login",
        ip=get_client_ip(),
        user_agent=request.headers.get("User-Agent", "")[:255],
    )

    token = issue_token(user)
    return jsonify({"token": token, "user": user.to_dict()}), 200


@auth_bp.route("/me", methods=["GET"])
@require_auth
def me():
    user = current_user()
    return jsonify({"user": user.to_dict()}), 200


@auth_bp.route("/logout", methods=["POST"])
@require_auth
def logout():
    """Côté serveur on log l'événement. Le client doit supprimer son token."""
    user = current_user()
    log_activity(user_id=user.id, action="logout", ip=get_client_ip())
    return jsonify({"message": "Déconnecté"}), 200


@auth_bp.route("/change-password", methods=["POST"])
@require_auth
def change_password():
    data = request.get_json(silent=True) or {}
    old = data.get("old_password") or ""
    new = data.get("new_password") or ""

    user = current_user()
    if not user.check_password(old):
        return jsonify({"error": "Mot de passe actuel incorrect"}), 400
    ok, msg = validate_password(new)
    if not ok:
        return jsonify({"error": msg}), 400

    user.set_password(new)
    db.session.commit()
    log_activity(user_id=user.id, action="change_password", ip=get_client_ip())
    return jsonify({"message": "Mot de passe modifié"}), 200
