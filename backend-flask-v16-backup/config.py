"""
Configuration ForecastIQ — variables chargées depuis .env
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()  # charge .env si présent

class Config:
    # ----- Base de données PostgreSQL -----
    # Format: postgresql://user:password@host:port/dbname
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://localhost/forecastiq"  # défaut Mac Homebrew (user = ton user système)
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ----- JWT -----
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production-please")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    JWT_ALGORITHM = "HS256"

    # ----- Admin seed (créé au premier lancement) -----
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@forecastiq.com")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@2026")

    # ----- Serveur -----
    PORT = int(os.getenv("PORT", 3001))
    DEBUG = os.getenv("FLASK_DEBUG", "1") == "1"

    # ----- Upload (pour les étapes suivantes) -----
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB
    ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls"}

    # ----- Sécurité -----
    BCRYPT_ROUNDS = 12  # coût du hash bcrypt
    MAX_LOGIN_ATTEMPTS = 5
    LOCKOUT_MINUTES = 15
