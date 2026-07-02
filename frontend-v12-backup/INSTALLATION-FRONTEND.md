# ForecastIQ — Frontend (Étape 3 : Landing + Auth)

Étape 3 sur 4. Landing page, login, signup, navbar — branchés sur le backend Flask.

## Pages livrées

| Route | Description |
|---|---|
| `/` | Landing page : présentation ForecastIQ, fonctionnalités, 4 acteurs, comment ça marche |
| `/login` | Connexion (JWT) |
| `/signup` | Inscription avec validation du mot de passe en temps réel |
| `/dashboard` | Placeholder temporaire (le vrai dashboard arrive à l'étape 4) |

## Structure du projet

```
frontend/
├── app/
│   ├── layout.js          Layout racine (AuthProvider + Navbar)
│   ├── globals.css        Styles Tailwind
│   ├── page.js            Landing page
│   ├── login/page.js
│   ├── signup/page.js
│   └── dashboard/page.js  (placeholder)
├── components/
│   ├── AuthContext.js     État d'authentification global
│   ├── AuthGuard.js       Protection des pages privées
│   └── Navbar.js          Barre de navigation
├── lib/
│   └── api.js             Client API (toutes les requêtes vers Flask)
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json          Alias @/ vers la racine
└── .env.local.example
```

## Installation

Le frontend est un projet Next.js neuf et propre, séparé de ton ancien
`sales-forecast-pro/frontend`. Place-le à côté du backend :

```
~/Downloads/forecastiq/
├── backend-flask/   (déjà installé, étapes 1-2)
└── frontend/        (ce nouveau dossier)
```

### Étapes

```bash
cd ~/Downloads/forecastiq
# extraire l'archive (le dossier frontend sera créé)
tar -xf ~/Downloads/forecastiq-frontend.tar

cd frontend

# configurer l'URL du backend
cp .env.local.example .env.local

# installer les dépendances
npm install

# lancer
npm run dev
```

Le frontend démarre sur **http://localhost:3000**.

## Important : lancer les deux serveurs

ForecastIQ a besoin des deux serveurs en même temps, dans deux terminaux :

**Terminal 1 — Backend Flask :**
```bash
cd ~/Downloads/forecastiq/backend-flask
source venv/bin/activate
python app.py
# tourne sur http://localhost:3001
```

**Terminal 2 — Frontend Next.js :**
```bash
cd ~/Downloads/forecastiq/frontend
npm run dev
# tourne sur http://localhost:3000
```

Puis ouvre **http://localhost:3000** dans le navigateur.

## Test du flux complet

1. Va sur http://localhost:3000 → tu vois la landing page ForecastIQ
2. Clique "Commencer gratuitement" → page d'inscription
3. Crée un compte (le mot de passe doit avoir 8+ caractères, 1 majuscule, 1 minuscule, 1 chiffre)
4. Tu es redirigé vers le tableau de bord (placeholder pour l'instant)
5. Clique "Déconnexion" → retour au login
6. Reconnecte-toi avec tes identifiants

Tu peux aussi te connecter avec le compte admin :
- Email : `admin@forecastiq.com`
- Mot de passe : `Admin@2026`

## Validé en sandbox

- Build de production : 4 pages compilées sans erreur
- Flux end-to-end : signup → dashboard → logout → login → dashboard
- Validation du mot de passe en temps réel (4 critères)

## Prochaine étape (étape 4)

Le vrai tableau de bord (graphiques Recharts, 5 onglets comme tes screenshots),
la page d'upload avec mapping des colonnes, et la page d'administration.
