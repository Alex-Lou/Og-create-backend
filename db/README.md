# Base de données (PostgreSQL)

Le schéma et le contenu n'étaient versionnés nulle part : `schema.sql` a été reconstruit à partir des requêtes SQL de `src/`, et `seed.sql` contient des données de démo.

- `schema.sql` : les tables (users, auth_sessions, progress, game_data, timer_questions, achievements_list, customization_items, user_items, explorer_regions, user_regions, game_settings). Vous pouvez le rejouer sans risque, il utilise `IF NOT EXISTS`.
- `seed.sql` : généré, ne pas modifier à la main. 706 éléments répartis en 15 familles et 2 226 recettes (de 2 à 4 ingrédients), tous atteignables depuis Eau, Feu, Terre et Air. Il contient aussi les questions Timer, les succès, les items de personnalisation, les régions Explorer et `max_energy`. Aucun utilisateur n'est créé. Vous pouvez le rejouer : il fait des upserts.
- `content/` : la source du contenu.
  - `elements.py` : les éléments par famille. Ne jamais renommer un élément existant : les sauvegardes, le Timer, l'Explorer et les succès s'appuient sur les noms.
  - `recipes_*.py` : les recettes, un fichier par domaine.
  - `check.py` : le vérificateur (`python3 db/content/check.py`).
- `gen_seed.py` : régénère `seed.sql` depuis `content/` (`python3 db/gen_seed.py`). Il refuse de produire le seed si un élément devient inatteignable, si une recette est en double, ou si une question Timer ou une région Explorer n'est plus faisable.

## Installation

```bash
createdb og_create                       # ou : CREATE DATABASE og_create;
psql -d og_create -f db/schema.sql
psql -d og_create -f db/seed.sql
```

Ajoutez `-h <hôte> -U <utilisateur>` si besoin. Au démarrage, le serveur resynchronise aussi `explorer_regions` depuis `src/public/data/regionChallenges.json` (voir `initRegions.js`).

## Base hébergée (Neon, Supabase…)

```bash
export DATABASE_URL="postgresql://user:motdepasse@hote/base?sslmode=require"
npm run db:setup          # schéma + seed, rejouable (Node, sans psql)
```

## Variables d'environnement

`DATABASE_URL` est prioritaire. À défaut, `src/config/db.js` lit :

- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_LOG_LEVEL` (facultative : `ERROR`, `INFO` ou `DEBUG`)

Celles dont le reste du serveur a besoin :

- `JWT_SECRET` (obligatoire : au moins 32 caractères via l’environnement, 64 dans `.env`)
- `JWT_REFRESH_SECRET` (à définir en production)
- `PORT`
- `NODE_ENV`
- `CORS_ORIGIN`
- `EMAIL_USER`
- `EMAIL_PASSWORD` (formulaire de contact)

Si `JWT_SECRET` (32 caractères min.) est fourni par l'environnement, aucun `.env` n'est nécessaire (cas de Render). Sinon, `src/utils/jwt.js` génère le secret dans `.env` en local, et le serveur refuse de démarrer sans `.env`.
