"""
Initialise la base de données :
  1. Crée toutes les tables (users, datasets, forecasts, activity_logs)
  2. Crée l'admin par défaut s'il n'existe pas

Usage :
    python init_db.py
"""
from app import create_app
from models import db, User


def init_database():
    app = create_app()
    with app.app_context():
        print("Création des tables...")
        db.create_all()
        print("  ✓ tables: users, datasets, forecasts, activity_logs")

        # Admin par défaut
        admin_email = app.config["ADMIN_EMAIL"]
        admin_pwd = app.config["ADMIN_PASSWORD"]

        existing = User.query.filter_by(email=admin_email).first()
        if existing:
            print(f"  ℹ admin déjà présent : {admin_email} (id={existing.id})")
        else:
            admin = User(
                email=admin_email,
                full_name="Administrateur ForecastIQ",
                role="admin",
                is_active=True,
            )
            admin.set_password(admin_pwd)
            db.session.add(admin)
            db.session.commit()
            print(f"  ✓ admin créé : {admin_email} / {admin_pwd}")

        # Stats
        total = User.query.count()
        print(f"\n{total} utilisateur(s) en base.")
        for u in User.query.all():
            print(f"  - [{u.role:8}] {u.email}  ({u.full_name})")


if __name__ == "__main__":
    init_database()
