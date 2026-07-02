"""
ForecastIQ — Backend Flask
Point d'entrée principal.

Lance avec :
    python app.py
ou avec Gunicorn (prod) :
    gunicorn -b 0.0.0.0:3001 app:app
"""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from models import db, User
from auth import auth_bp


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # CORS : autorise le frontend Next.js (port 3000)
    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}},
        supports_credentials=True,
    )

    # Extensions
    db.init_app(app)
    JWTManager(app)

    # Blueprints
    app.register_blueprint(auth_bp)

    # ----- Health check -----
    @app.route("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "service": "ForecastIQ",
            "version": "0.1.0-alpha"
        })

    # ----- Gestion d'erreurs propre -----
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Endpoint introuvable"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Méthode non autorisée"}), 405

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Erreur serveur"}), 500

    # Dossier d'uploads (créé au lancement)
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    return app


# ---------- Création de l'instance globale ----------
app = create_app()


if __name__ == "__main__":
    print("=" * 60)
    print("ForecastIQ — Backend Flask")
    print(f"  DB     : {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"  Port   : {app.config['PORT']}")
    print(f"  Debug  : {app.config['DEBUG']}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=app.config["PORT"], debug=app.config["DEBUG"])
