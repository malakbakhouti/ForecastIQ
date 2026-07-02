"""
migrate_v12_manager.py — Migration pour ajouter les champs Manager au modèle Dataset.

Ajoute :
- annotation (TEXT)
- validation_status (VARCHAR(20), défaut 'pending')
- validated_by_id (INTEGER, FK users)
- validated_at (TIMESTAMP)

Usage :
    python migrate_v12_manager.py
"""
from app import create_app
from models import db
from sqlalchemy import text

app = create_app()

MIGRATIONS = [
    "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS annotation TEXT",
    "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) DEFAULT 'pending'",
    "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS validated_by_id INTEGER REFERENCES users(id)",
    "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP",
]

with app.app_context():
    print("Migration v12 — ajout des champs Manager au modèle Dataset...")
    for sql in MIGRATIONS:
        try:
            db.session.execute(text(sql))
            print(f"  ✓ {sql}")
        except Exception as e:
            print(f"  ✗ Erreur : {e}")
            db.session.rollback()
            continue
    db.session.commit()
    print("Migration terminée.")
