"""
csv_analyzer.py — Analyse automatique d'un fichier CSV/Excel.

Rôle (couche IA, étape "prétraitement" du rapport) :
  1. Charger le fichier (CSV ou Excel) avec pandas
  2. Détecter automatiquement la colonne DATE, la colonne VALEUR,
     et les colonnes CATÉGORIE
  3. Nettoyer les données (valeurs manquantes, doublons, types)
  4. Retourner un résumé exploitable par le frontend

L'utilisateur peut ensuite corriger le mapping proposé (auto + correction).
"""
import os
import warnings
import pandas as pd
import numpy as np

# pandas émet un UserWarning lors du parsing de date sans format imposé ;
# c'est un fallback volontaire, on masque ce bruit.
warnings.filterwarnings("ignore", category=UserWarning, module="pandas")

DATE_FORMATS = [
    "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d",
    "%d/%m/%y", "%m/%d/%y", "%d.%m.%Y", "%Y%m%d",
    "%d %B %Y", "%B %d, %Y", "%d-%b-%Y",
]

DATE_HINTS = ["date", "time", "jour", "day", "month", "mois", "periode", "période", "year", "année"]
VALUE_HINTS = ["sales", "vente", "ventes", "revenue", "montant", "amount", "total",
               "price", "prix", "quantity", "quantité", "qty", "value", "valeur", "chiffre"]


def load_file(path):
    """Charge un CSV ou Excel en DataFrame pandas. Lève ValueError si échec."""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".csv":
        for enc in ["utf-8-sig", "utf-8", "latin-1"]:
            for sep in [",", ";", "\t"]:
                try:
                    df = pd.read_csv(path, encoding=enc, sep=sep)
                    if df.shape[1] >= 2:
                        return df
                except Exception:
                    continue
        raise ValueError("Impossible de lire le CSV (encodage ou séparateur non reconnu)")
    elif ext in (".xlsx", ".xls"):
        try:
            return pd.read_excel(path)
        except Exception as e:
            raise ValueError(f"Impossible de lire le fichier Excel : {e}")
    else:
        raise ValueError(f"Extension non supportée : {ext}")


def _try_parse_dates(series):
    """Tente de parser une série en dates. Retourne (ratio_succès, format)."""
    sample = series.dropna().astype(str).head(200)
    if len(sample) == 0:
        return 0.0, None

    best_ratio, best_fmt = 0.0, None
    for fmt in DATE_FORMATS:
        try:
            parsed = pd.to_datetime(sample, format=fmt, errors="coerce")
            ratio = parsed.notna().mean()
            if ratio > best_ratio:
                best_ratio, best_fmt = ratio, fmt
        except Exception:
            continue

    try:
        parsed = pd.to_datetime(sample, errors="coerce", dayfirst=True)
        ratio = parsed.notna().mean()
        if ratio > best_ratio:
            best_ratio, best_fmt = ratio, "auto"
    except Exception:
        pass

    return best_ratio, best_fmt


def detect_date_column(df):
    """Retourne (colonne, format, score) de la meilleure colonne date."""
    candidates = []
    for col in df.columns:
        ratio, fmt = _try_parse_dates(df[col])
        if ratio >= 0.8:
            score = ratio
            if any(h in str(col).lower() for h in DATE_HINTS):
                score += 0.5
            candidates.append((col, fmt, score, ratio))

    if not candidates:
        return None, None, 0.0
    candidates.sort(key=lambda x: x[2], reverse=True)
    best = candidates[0]
    return best[0], best[1], round(best[3], 3)


def detect_value_column(df, exclude=None):
    """Retourne (colonne, score) de la meilleure colonne numérique à prévoir."""
    exclude = exclude or []
    candidates = []

    for col in df.columns:
        if col in exclude:
            continue
        series = pd.to_numeric(df[col], errors="coerce")
        valid_ratio = series.notna().mean()
        if valid_ratio < 0.8:
            continue

        col_lower = str(col).lower()
        is_id_like = (
            col_lower.endswith("id")
            or col_lower in ("row id", "rowid", "postal code", "code postal")
            or "id" in col_lower.split()
        )
        if is_id_like:
            continue

        score = valid_ratio
        if any(h in col_lower for h in VALUE_HINTS):
            score += 1.0
        if series.std() and series.mean():
            cv = abs(series.std() / series.mean())
            if cv > 0.1:
                score += 0.3
        candidates.append((col, score, valid_ratio))

    if not candidates:
        return None, 0.0
    candidates.sort(key=lambda x: x[1], reverse=True)
    return candidates[0][0], round(candidates[0][2], 3)


def detect_category_columns(df, exclude=None, max_categories=30):
    """Retourne la liste des colonnes catégorielles."""
    exclude = exclude or []
    result = []
    n = len(df)
    if n == 0:
        return result

    for col in df.columns:
        if col in exclude:
            continue
        series = df[col].dropna()
        if len(series) == 0:
            continue
        nunique = series.nunique()
        if 2 <= nunique <= max_categories and nunique / n < 0.5:
            numeric_ratio = pd.to_numeric(series, errors="coerce").notna().mean()
            if numeric_ratio < 0.95:
                result.append({
                    "column": col,
                    "distinct_values": int(nunique),
                    "top_values": [str(v) for v in series.value_counts().head(8).index.tolist()],
                })
    return result


def clean_dataframe(df, date_col, value_col, date_format=None):
    """Nettoie : parse date, convertit valeur, retire invalides + doublons."""
    report = {
        "rows_before": len(df),
        "duplicates_removed": 0,
        "invalid_dates_removed": 0,
        "invalid_values_removed": 0,
        "rows_after": 0,
    }
    df = df.copy()

    before = len(df)
    df = df.drop_duplicates()
    report["duplicates_removed"] = before - len(df)

    if date_format and date_format != "auto":
        df["_date"] = pd.to_datetime(df[date_col], format=date_format, errors="coerce")
    else:
        df["_date"] = pd.to_datetime(df[date_col], errors="coerce", dayfirst=True)
    before = len(df)
    df = df[df["_date"].notna()]
    report["invalid_dates_removed"] = before - len(df)

    df["_value"] = pd.to_numeric(df[value_col], errors="coerce")
    before = len(df)
    df = df[df["_value"].notna()]
    report["invalid_values_removed"] = before - len(df)

    report["rows_after"] = len(df)
    return df, report


def analyze_file(path):
    """Analyse complète d'un fichier uploadé. Retourne le mapping détecté + aperçu."""
    df = load_file(path)

    date_col, date_fmt, date_score = detect_date_column(df)
    value_col, value_score = detect_value_column(df, exclude=[date_col] if date_col else [])
    categories = detect_category_columns(
        df, exclude=[c for c in [date_col, value_col] if c]
    )

    preview = df.head(10).astype(str).to_dict(orient="records")

    return {
        "columns": list(df.columns),
        "row_count": len(df),
        "column_count": df.shape[1],
        "detected": {
            "date_column": date_col,
            "date_format": date_fmt,
            "date_confidence": date_score,
            "value_column": value_col,
            "value_confidence": value_score,
            "category_columns": [c["column"] for c in categories],
        },
        "category_details": categories,
        "preview": preview,
    }
