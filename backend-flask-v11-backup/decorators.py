"""
Décorateurs d'autorisation basés sur le rôle JWT.

Usage :
    @auth_bp.route("/me")
    @require_auth
    def me():
        return jsonify(current_user().to_dict())

    @admin_bp.route("/users")
    @require_role("admin")
    def list_users():
        ...

    @manager_bp.route("/dashboards")
    @require_role("manager", "admin")
    def list_dashboards():
        ...
"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity
from models import User


def current_user():
    """Récupère l'utilisateur courant à partir du JWT déjà vérifié."""
    user_id = get_jwt_identity()
    if user_id is None:
        return None
    return User.query.get(int(user_id))


def require_auth(fn):
    """JWT valide requis, peu importe le rôle."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception as e:
            return jsonify({"error": "Token manquant ou invalide", "detail": str(e)}), 401
        user = current_user()
        if user is None or not user.is_active:
            return jsonify({"error": "Compte introuvable ou désactivé"}), 401
        return fn(*args, **kwargs)
    return wrapper


def require_role(*allowed_roles):
    """JWT valide + rôle dans la liste autorisée."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
            except Exception as e:
                return jsonify({"error": "Token manquant ou invalide", "detail": str(e)}), 401
            claims = get_jwt()
            role = claims.get("role")
            user = current_user()
            if user is None or not user.is_active:
                return jsonify({"error": "Compte introuvable ou désactivé"}), 401
            if role not in allowed_roles:
                return jsonify({
                    "error": "Accès refusé",
                    "required_role": list(allowed_roles),
                    "your_role": role
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
