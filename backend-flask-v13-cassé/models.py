"""
Modèles SQLAlchemy pour ForecastIQ.

Tables :
- users          : comptes utilisateurs (user / manager / admin)
- datasets       : fichiers CSV/Excel importés par les users
- forecasts     : résultats des prévisions générées
- activity_logs  : journal d'activité (consulté par l'admin)
"""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
import bcrypt

db = SQLAlchemy()


# ---------------------------------------------------------------------------
# USER
# ---------------------------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")  # user | manager | admin

    # Profil
    avatar_url = db.Column(db.String(255), nullable=True)
    preferences = db.Column(db.JSON, nullable=True, default=dict)

    # Sécurité
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)
    last_login_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    # Audit
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    datasets = db.relationship("Dataset", backref="owner", lazy=True, cascade="all, delete-orphan")
    logs = db.relationship("ActivityLog", backref="user", lazy=True)

    # ---- Helpers ----
    def set_password(self, plain: str) -> None:
        """Hash bcrypt du mot de passe avant stockage."""
        salt = bcrypt.gensalt(rounds=12)
        self.password_hash = bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")

    def check_password(self, plain: str) -> bool:
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), self.password_hash.encode("utf-8"))
        except Exception:
            return False

    def is_locked(self) -> bool:
        return self.locked_until is not None and self.locked_until > datetime.utcnow()

    def to_dict(self, with_email: bool = True) -> dict:
        data = {
            "id": self.id,
            "full_name": self.full_name,
            "role": self.role,
            "avatar_url": self.avatar_url,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
        }
        if with_email:
            data["email"] = self.email
        return data


# ---------------------------------------------------------------------------
# DATASET
# ---------------------------------------------------------------------------
class Dataset(db.Model):
    __tablename__ = "datasets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    name = db.Column(db.String(200), nullable=False)        # nom du fichier original
    storage_path = db.Column(db.String(500), nullable=False)  # chemin disque
    file_size = db.Column(db.Integer, nullable=False)
    row_count = db.Column(db.Integer, nullable=True)
    column_count = db.Column(db.Integer, nullable=True)

    # Mapping détecté automatiquement (rempli à l'upload)
    detected_date_column = db.Column(db.String(100), nullable=True)
    detected_value_column = db.Column(db.String(100), nullable=True)
    detected_category_columns = db.Column(db.JSON, nullable=True, default=list)
    date_format = db.Column(db.String(50), nullable=True)

    # Métadonnées d'analyse
    analysis_summary = db.Column(db.JSON, nullable=True)  # KPIs cachés pour affichage rapide

    status = db.Column(db.String(20), default="uploaded")  # uploaded | analyzed | failed
    error_message = db.Column(db.Text, nullable=True)

    # Annotation et validation par le Manager
    annotation = db.Column(db.Text, nullable=True)  # commentaire du manager
    validation_status = db.Column(db.String(20), default="pending")  # pending | validated | to_review | rejected
    validated_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    validated_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    forecasts = db.relationship("Forecast", backref="dataset", lazy=True, cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "file_size": self.file_size,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "detected_date_column": self.detected_date_column,
            "detected_value_column": self.detected_value_column,
            "detected_category_columns": self.detected_category_columns or [],
            "status": self.status,
            "error_message": self.error_message,
            "annotation": self.annotation,
            "validation_status": self.validation_status or "pending",
            "validated_by_id": self.validated_by_id,
            "validated_at": self.validated_at.isoformat() if self.validated_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# FORECAST
# ---------------------------------------------------------------------------
class Forecast(db.Model):
    __tablename__ = "forecasts"

    id = db.Column(db.Integer, primary_key=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey("datasets.id"), nullable=False, index=True)

    algorithm = db.Column(db.String(50), nullable=False)  # 'linear_ols' | 'random_forest' | 'arima' | 'ensemble'
    horizon = db.Column(db.Integer, nullable=False, default=6)  # nb de périodes prédites
    granularity = db.Column(db.String(20), default="monthly")   # monthly | weekly | daily

    # Résultats sérialisés (séries, prévisions, anomalies, KPIs)
    results = db.Column(db.JSON, nullable=False)

    # Métriques de qualité du modèle
    mae = db.Column(db.Float, nullable=True)
    rmse = db.Column(db.Float, nullable=True)
    r2 = db.Column(db.Float, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "algorithm": self.algorithm,
            "horizon": self.horizon,
            "granularity": self.granularity,
            "metrics": {"mae": self.mae, "rmse": self.rmse, "r2": self.r2},
            "results": self.results,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# ACTIVITY LOG (journal d'audit pour l'admin)
# ---------------------------------------------------------------------------
class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)

    action = db.Column(db.String(80), nullable=False)  # login, logout, upload, forecast, role_change, ...
    target_type = db.Column(db.String(40), nullable=True)   # dataset, user, forecast...
    target_id = db.Column(db.Integer, nullable=True)
    details = db.Column(db.JSON, nullable=True)

    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), default="success")  # success | failure

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_email": self.user.email if self.user else None,
            "action": self.action,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Helper pour logger une activité (utilisé partout dans l'app)
# ---------------------------------------------------------------------------
def log_activity(user_id, action, target_type=None, target_id=None,
                 details=None, ip=None, user_agent=None, status="success"):
    """Crée et commit une entrée dans activity_logs."""
    entry = ActivityLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=ip,
        user_agent=user_agent,
        status=status,
    )
    db.session.add(entry)
    db.session.commit()
    return entry
