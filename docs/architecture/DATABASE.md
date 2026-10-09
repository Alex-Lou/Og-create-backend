# Base de données de Brumelune (PostgreSQL)

> **Vérifié contre le code : backend 9cc7bfe (2026-10-09)**. Références `fichier:ligne` sur ce commit ;
> `schema.sql:N` = `db/schema.sql`. « (hypothèse) » : déduction non vérifiée. Aucune base n'a été interrogée :
> tout vient du schéma, du seed et du code.

Installation et variables : `db/README.md` (non répété ici). Architecture du serveur : `BACKEND.md`.

## 1. Gestion du schéma

| Fichier | Rôle |
|---|---|
| `db/schema.sql` (539 l.) | schéma complet, rejouable : `CREATE … IF NOT EXISTS`, `ALTER … ADD COLUMN IF NOT EXISTS`, `DROP … IF EXISTS`, un bloc `DO` pour la contrainte `chk_progress_coins` (`:534-539`) |
| `db/seed.sql` (364 l.) | contenu du jeu, **généré** : une transaction (`BEGIN` … `COMMIT`), upserts `ON CONFLICT … DO UPDATE` ; aucun utilisateur |
| `db/gen_seed.py` + `db/content/*.py` | source du contenu : `elements.py`, 19 `recipes_*.py`, `riddles.py`, vérificateur `check.py` |
| `db/setup.js` | `npm run db:setup` : applique `schema.sql` puis `seed.sql`, chacun en une requête simple (`setup.js:9`, `:29`) |

- **Pas d'outil de migration**, pas de table de versions. Le schéma évolue en ajoutant au fichier :
  - colonne : `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` (ex. `users.suspended_at`, `:25` ; `book_letters.revealed`, `:531`) ;
  - table : `CREATE TABLE IF NOT EXISTS` ;
  - contrainte sur l'existant : `NOT VALID` dans un bloc `DO` (`:533-539`).
- **Ce que les données des joueurs ont de versionné** :
  - la carte, par `world_stock.map_version`, avec une migration paresseuse par joueur (`world/migrate.js:17`) ;
  - les règles, par la date de création du compte (`players.js:59`, `:68`).
- **Règle de l'auteur** (`PASSATION.md`, `ETAT_DES_LIEUX.md` § 1) : aucune migration destructive, aucune suppression
  sans feu vert ; **un joueur existant ne recule jamais**.
- **Ce qui détruit malgré tout** :
  - `schema.sql` garde des `DROP` historiques, sans effet une fois appliqués : `refresh_tokens` (`:40`), anciennes
    tables Explorer (`:213-215`), colonnes de `progress` (`:218-225`) et de `play_runs` (`:92-93`) ;
  - « Recommencer l'île » efface des données par conception (§ 6).

## 2. Les tables (43)

Toutes les FK `user_id` pointent vers `users(id)` avec **`ON DELETE CASCADE`**. Sauf mention, la PK commence par
`user_id` et sert d'index pour les lectures par joueur.

### Comptes et sessions

| Table (`schema.sql`) | Rôle | PK | Colonnes et contraintes notables |
|---|---|---|---|
| `world_site_places` (2026-10-09) | place d'un bâtiment déplacé par le joueur | `(user_id, site)` | `x`, `y` (coin de la grande emprise 3 × 3), `moved_at` ; FK `users` ON DELETE CASCADE ; effacée par « Recommencer l'île » ; sans ligne : la carte, ou l'île à la plage (`world_items` « ile:plage ») — `services/world/places.js` |
| `users` (`:15-26`) | comptes | `id` SERIAL | `email` VARCHAR(255) **UNIQUE** (sensible à la casse) ; `username` UNIQUE ; `password_hash` ; `created_at` (fixe les règles du joueur) ; `suspended_at`, `delete_at` |
| `email_changes` (`:30-35`) | nouvelle adresse en attente (1 h) | `user_id` | `new_email` ; `token_hash` CHAR(64) UNIQUE ; `expires_at` |
| `auth_sessions` (`:47-57`) | jetons de rafraîchissement (empreintes) | `id` BIGSERIAL | `family` UUID ; `token_hash` UNIQUE ; `expires_at`, `revoked_at`, `created_at` ; index `family` et `user_id` |
| `password_resets` (`:99-106`) | lien de mot de passe oublié (30 min) | `id` | `token_hash` UNIQUE ; index `user_id` |
| `guest_players` (`:63-69`) | carnet d'un invité | `id` | `token_hash` UNIQUE ; `elements` JSONB ; `last_seen`, indexé |

### Progression et économie

| Table | Rôle | PK | Colonnes et contraintes notables |
|---|---|---|---|
| `progress` (`:112-129`) | une ligne par compte | `id` | `user_id` UNIQUE FK ; `infinite_elements`, `achievements`, `timer_progress`, `user_customization` JSONB ; `coins` avec `CHECK (coins >= 0) NOT VALID` (`:537`) ; `world_collected_at`, héritée (`:257`) |
| `coin_ledger` (`:232-241`) | grand livre des écus | `id` BIGSERIAL | `amount` (signé), `reason` VARCHAR(40), `ref` VARCHAR(100) ; **UNIQUE (user_id, reason, ref)** ; index (user_id, created_at) |
| `user_items` (`:202-208`) | pièces du Cabinet achetées | `id` | FK `item_id` → `customization_items` CASCADE ; UNIQUE (user_id, item_id) |
| `play_runs` (`:75-93`) | partie d'Épreuve en cours | (`owner`, `mode`) | **sans FK** ; `owner` = `'u:<id>'` ou `'g:<id>'` ; `mode` CHECK `('timer','explorer')` ; `context` (id de question, texte) ; `inventory`, `solved_ids` JSONB ; `free_jokers`, `level`, `category`, `deadline`, `paused_at`, `solved` |

### Contenu (rempli par le seed, lu par le serveur)

| Table | Rôle | PK | Colonnes et contraintes notables |
|---|---|---|---|
| `game_data` (`:136-145`) | éléments, recettes, énigmes | `id` | `name` UNIQUE ; `elements`, `rules`, `metadata` JSONB ; `active` |
| `timer_questions` (`:155-167`) | questions de l'Épreuve | `id` | UNIQUE (level, category, question_text) ; index (level, category) ; `valid_answers`, `initial_elements`, `elements_emojis` JSONB |
| `achievements_list` (`:175-182`) | catalogue des succès | `id` | `name` UNIQUE ; `condition`, texte lu par `achievementCondition.js` (jamais évalué comme code) |
| `customization_items` (`:189-200`) | pièces du Cabinet | `id` | `type` CHECK `('frame','avatar')` ; `image_path` UNIQUE (clé d'upsert) ; `price` CHECK ≥ 0 ; `achievement`, nom d'un succès, **sans FK** |

### L'île (préfixe `world_`, 28 tables, toutes FK `user_id` CASCADE)

| Table | Rôle | PK | Notes |
|---|---|---|---|
| `world_stock` (`:260-284`) | réserve et parties de Récolte : **la ligne verrouillée** | `user_id` | `stone`, `wood`, `water`, `food` CHECK ≥ 0 ; `charges` CHECK ≥ 0, `charges_at` ; `collected_at` ; `map_version` (défaut 1, actuelle 5) ; `carry` JSONB |
| `world_buildings` (`:270-276`) | bâtiments bâtis | (user, `site`) | `level` CHECK > 0 |
| `world_zones` (`:285-290`) | quartiers à soi | (user, `zone`) | le Cœur est implicite (`world/reads.js:110-113`) |
| `world_items` (`:292-297`, `:333`) | **table à tout faire** : achats, butins, marqueurs | (user, `item`) | `item` VARCHAR(30) ; `source` VARCHAR(10), défaut `'boutique'` ; voir § 3 |
| `world_skins` (`:298-303`) | skin porté par bâtiment | (user, `site`) | — |
| `world_runs` (`:304-312`) | parties de Récolte | `id` BIGSERIAL | `seed` ; `config` JSONB ; `finished_at` ; index (user, created_at) |
| `world_games` (`:364-370`) | réserve de parties par mini-jeu | (user, `game`) | `plays` CHECK ≥ 0, `plays_at` |
| `world_game_runs` (`:371-380`) | parties de mini-jeu | `id` | `level` = niveau × 10 + palier (`world.js:678`) ; index (user, created_at) |
| `world_quests` (`:314-319`) | quêtes de Brume réclamées | (user, `quest`) | — |
| `world_chests` (`:323-331`) | coffres ouverts, une fois par source | (user, `source`) | `source` : `recolte:`, `jour:`, `bouteille:`, `chapitre:`, `quete:`, `lieu:` ; `rarity` ; `prize` JSONB ; `streak` |
| `world_annexes` (`:336-343`, `:436-437`) | annexes posées | (user, `x`, `y`) | x, y CHECK ≥ 0 ; `flip` ; `look` CHECK ≥ 0 |
| `world_crafts` (`:423-438`) | créations d'île | `id` | x, y NULL = en réserve ; index `user_id` ; **UNIQUE partiel (user, x, y) WHERE x IS NOT NULL** ; `flip` |
| `world_craft_runs` (`:440-448`) | assemblages en cours | `id` | `seed`, `finished_at` ; index (user, created_at) |
| `world_tiles` (`:248-256`) | décorations de l'ancienne règle (héritée) | (user, x, y) | UNIQUE (user, element) ; gardée pour les remboursements (`world.js:745`) |
| `world_sign_names` / `world_sign_styles` / `world_signs` (`:346-361`) | enseignes : nom unique, styles achetés, style par bâtiment | user / (user, style) / (user, site) | `name` VARCHAR(14) |
| `world_names` (`:382-387`) | noms choisis | (user, `target`) | `target` : `site:<id>`, `zone:<id>`, `joueur` ; `name` VARCHAR(22) |
| `world_avatars` (`:390-397`) | avatar du joueur | `user_id` | `look` (`avatar-01`…`12` ou `perso`) ; `choices` JSONB |
| `world_friends` (`:400-407`) | amitié des habitants | (user, `villager`) | `points` CHECK ≥ 0 ; `talked_on`, `gifted_on` DATE ; sert aussi à Anya et Brume (`anya.js:4`, `world/anyaBrume.js:61-92`) |
| `world_needs` (`:502-508`) | besoins comblés | (user, villager, need) | `filled_at` |
| `world_visitors` (`:409-421`) | visiteurs | `id` | `request` JSONB ; `leaves_at`, `satisfied_at`, `settled_at` ; index (user, arrived_at) |
| `world_expeditions` (`:451-457`) | expéditions, une par quartier | (user, `zone`) | `ends_at` |
| `world_landmarks` (`:460-465`) | lieux remarquables découverts | (user, `landmark`) | — |
| `world_finds` (`:467-472`) | réserve de trouvailles | (user, `find`) | `amount` CHECK ≥ 0 |
| `world_deposits` (`:474-479`) | gisements ramassés | (user, `deposit`) | `gathered_at` |
| `world_nights` (`:484-490`) | nuits de créatures | `user_id` | `seen_until` ; `blights`, `repelled` JSONB |
| `world_beasts` (`:493-499`) | bêtes de ferme | (user, `beast`) | `fed_at`, `collected_at` |

### Le Livre

| Table | Rôle | PK | Notes |
|---|---|---|---|
| `book_tries` (`:511-517`) | mélanges ratés par page (compte) | (user, `page_id`, `combo`) | `combo` = ingrédients triés, joints par `+` |
| `book_letters` (`:521-531`) | pendu par page | (`owner`, `page_id`) | **sans FK** ; `owner` = `'u:<id>'` ou `'g:<id>'` ; `letters` VARCHAR(26) ; `misses` CHECK ≥ 0 ; `failed_at` ; `revealed` SMALLINT[] |

`page_id` est un HMAC du nom de l'élément, avec `JWT_SECRET` pour clé (`bookPages.js:37-42`).

## 3. Relations et propriété

```
users ─┬─< auth_sessions, password_resets, email_changes (1:1)
       ├── progress (1:1)         ├─< coin_ledger
       ├─< user_items >── customization_items
       ├─< book_tries             └─< world_* (28 tables, CASCADE)
       └ … 'u:<id>' (texte, sans FK) … play_runs, book_letters
guest_players … 'g:<id>' (texte, sans FK) … play_runs, book_letters
achievements_list.name … (texte) … customization_items.achievement, progress.achievements (clés)
game_data, timer_questions : isolées (lues en mémoire par le serveur)
```

**Deux modèles de propriété**

- `user_id` INTEGER avec FK CASCADE : effacer un compte efface ses lignes.
- `owner` TEXT, `'u:<id>'` ou `'g:<id>'` (`players.js:28-38`), **sans FK** : `play_runs`, `book_letters`. Ces lignes
  survivent à l'effacement d'un compte (§ 8).

**`world_items`** sert de registre de drapeaux (une ligne par fait acquis) :

| Motif de `item` | `source` | Écrit par |
|---|---|---|
| id d'article (`worldShop`) | `boutique` (défaut) ; seule une ligne `boutique` peut être annulée (`world.js:808`) | `world.js:773` |
| article tiré d'un coffre (teinte, pièce rare ; `tenue:`, `teinture:` lus par `avatarChoices.js:101`) | `butin` | `world/chests.js:62` |
| `ile:sentiers` (île neuve) ; `ile:recommencee` | `ile` | `world/reads.js:100`, `world.js:236-240` |
| `prologue:passe` ; `tutoriel:plage-v1` | `tutoriel` | `world.js:201`, `world/migrate.js:28` |
| `chemin:<x>:<y>` | `offert` ou `chemin` | `world.js:267` |
| `etoile:<jeu>:<niveau>:<rang>` | `etoile` | `world/stars.js:30` |

## 4. Colonnes JSONB et leur forme

| Colonne | Forme attendue | Lu / écrit par |
|---|---|---|
| `guest_players.elements`, `progress.infinite_elements` | `["Eau","Feu",…]`, noms ; ajout atomique `\|\| to_jsonb(nom)` si absent | `players.js:108-128` |
| `progress.achievements` | `{ "<nom>": { unlocked, unlockedAt } }` | `achievementService.js:38-60` |
| `progress.timer_progress` | `{ completedQuestions: { niveau: { chapitre: [ids] } }, unlockedCategories: { niveau: [chapitres] } }` ; `bestScores` n'est plus lu (records tirés de `coin_ledger`). Depuis le lot R2, une question n'y entre que payée par le serveur (`coin_ledger`, `timer-question`, `ref` = id) | `timerProgress.js` |
| `progress.user_customization` | `{ selectedFrame, selectedAvatar }` ; NULL vaut les pièces par défaut | `customization.js:4`, `:35` |
| `play_runs.inventory` / `solved_ids` | `[noms]` / `[ids de question]` | `players.js:131-149`, `trial.js` |
| `game_data.elements` | `{ elements: { Famille: { Nom: "svg:…" } } }` ; la ligne `elements_data` a une **liste** : ignorée | `recipeBook.js:18-29` |
| `game_data.rules` | `{ rules: { "A+B": "Résultat" } }` | `recipeBook.js:30-32` |
| `game_data.metadata` | `{ description, version }` ; ligne `riddles` : `{ riddles: { Nom: texte } }` ; ligne `formulas` : `{ specific, generic }`, non lue | `recipeBook.js:34-39` |
| `timer_questions.valid_answers` | `["Nom", …]` | `trial.js:28-35` |
| `timer_questions.initial_elements` | `{ validationMode: any\|multiple\|all, requiredCount?, required: [], additional: [] }` | `trial.js:22-35`, `timerQuestions.js:17-28` |
| `timer_questions.elements_emojis` | `{ Nom: emoji }` ; **lu nulle part** dans `src/` | — |
| `world_stock.carry` | `{ coins, stone, wood, water, food }`, fractions restantes | `world/rules.js:288-301`, `world/produce.js:55` |
| `world_runs.config` | `{ kinds, maxMoves, boosts, lvl }`, plus `played` à la fin | `world.js:635`, `:648` |
| `world_chests.prize` | `{ kind: 'coins', amount }`, `{ kind: 'stock', stock: { ressource: n } }` ou `{ kind: 'tint'\|'rare', item, site, name }` | `loot.js:74-92`, `world/chests.js:54-62` |
| `world_visitors.request` | `{ kind: 'livrer', resource, amount, reward }` ou `{ kind: 'recolter', count, reward }` | `visitors.js:43-51` |
| `world_avatars.choices` | choix validés, plus `accessoires: { place: { id, couleurs } }` | `avatarChoices.js:112-141` |
| `world_nights.blights` / `repelled` | `[{ site, since, until, by }]` / `{ night, ids }` | `schema.sql:480-483`, `world/nights.js:69-145` |

## 5. Volumes du contenu (seed actuel)

Compté par lecture de `db/seed.sql`, sans base. Les chiffres concordent avec l'en-tête du seed (`seed.sql:3-4`) et
avec `db/README.md`.

| Contenu | Volume |
|---|---|
| Éléments | **827**, en **15 familles** (dont Créations Humaines 223, Vie et Créatures 84, Matériaux 60) |
| Recettes | **2 986** : 1 955 à 2 ingrédients, 656 à 3, 375 à 4 ; sans doublon entre lignes |
| Énigmes de pages | 823 (ligne `riddles`) |
| Lignes `game_data` | 7 : 4 lignes de familles + `elements_data` + `formulas` + `riddles` |
| Questions de l'Épreuve | **96** : 31 Facile, 32 Moyen, 33 Difficile |
| Succès | **50** |
| Pièces du Cabinet | **17** : 8 cadres, 9 emblèmes ; 2 par défaut, 4 méritées par un succès |

- **Clés d'upsert** : `game_data.name`, `(level, category, question_text)`, `achievements_list.name`,
  `customization_items.image_path`.
- Renommer l'une de ces clés crée une nouvelle ligne. Le seed ne supprime jamais rien.

## 6. Cycle de vie des données

| Quoi | Quand | Ce qui est effacé | Réf. |
|---|---|---|---|
| Invités abandonnés | à chaque `POST /play/guest` qui crée un invité (paresseux) | `guest_players` sans visite depuis 30 j ; **toutes** les `play_runs` vieilles de 2 j (comptes compris) ; `book_letters` d'invités vieilles de 30 j | `players.js:41-44` |
| Invité adopté | connexion, inscription, compte provisoire | l'invité, ses `play_runs` et `book_letters` ; ses éléments rejoignent `progress` | `players.js:152-167` |
| Suppression de compte | `delete_at` = demande + 7 j ; balayage au démarrage puis toutes les heures | `DELETE FROM users` → CASCADE | `accountSettings.js:129-141`, `:157-161` ; `server.js:24-28` |
| Annulation | connexion pendant la grâce (`welcomeBack`) | `suspended_at` et `delete_at` remis à NULL | `accountSettings.js:146-154` |
| Comptes provisoires | sur `POST /auth/provisional`, au plus 1 fois par heure et par processus | plus de 30 j et aucune session créée depuis 30 j → CASCADE | `accounts.js:85-95` |
| Sessions | déconnexion, réutilisation, `revokeAll` | la famille, ou toutes les sessions du compte ; **rien ne purge les sessions expirées** | `authSession.js:104`, `:118`, `:127` |
| Liens | nouvelle demande, ou usage | `password_resets` du compte ; `email_changes` consommé | `services/passwordReset.js:22`, `:41` ; `accountSettings.js:104` |
| Fin d'Épreuve | `POST /play/timer/finish` | la ligne `play_runs` | `trial.js:97-100` |

**« Recommencer l'île »** (`world.js:212-243`), une transaction qui verrouille `users` :

- **efface** les 22 tables de `ISLAND_TABLES` :
  - parties : `world_game_runs`, `world_games`, `world_craft_runs`, `world_runs` ;
  - constructions : `world_crafts`, `world_annexes`, `world_tiles`, `world_buildings` ;
  - progression : `world_quests`, `world_zones`, `world_expeditions`, `world_landmarks`, `world_finds`,
    `world_deposits`, `world_nights` ;
  - habitants : `world_beasts`, `world_visitors`, `world_needs`, `world_friends` ;
  - noms : `world_signs`, `world_sign_names`, `world_names` (y compris le nom du joueur, `target = 'joueur'`) ;
- **efface aussi** :
  - les coffres `quete:`, `lieu:` et `recolte:` ;
  - les `world_items` `prologue:passe`, `tutoriel:plage-v1`, `chemin:%` et `etoile:%` ;
- **recrée** `world_stock` : réserve vide, 3 parties, carte actuelle ;
- **ajoute** `ile:sentiers` et `ile:recommencee` ;
- **garde** :
  - `progress` (Grimoire, écus) et `coin_ledger` ;
  - les achats et butins de `world_items`, `world_skins`, `world_sign_styles`, `world_avatars` ;
  - les coffres `jour:`, `bouteille:` et `chapitre:` ;
  - `book_*`.
- Fréquence : à volonté, avec un refus si la précédente date de moins de 10 s ; `ISLAND_RESTART_ONCE=1` limite à une
  fois (`:222-226`).

**Grand livre idempotent** (`services/ledger.js`)

- Un gain porte `(reason, ref)` : `INSERT … ON CONFLICT DO NOTHING`, puis crédit seulement si la ligne est neuve
  (`:8-20`).
- Un débit simple a `ref` NULL : les NULL ne se heurtent jamais à l'unicité, chaque débit s'inscrit (`:24-33`).
- `debitOnce` (`:38-49`) verrouille `progress` et ne débite qu'une fois par `(reason, ref)`. Exemple : l'Encre d'une
  page.
- **Source de vérité** : le solde `progress.coins`. `coin_ledger` en est le journal ; rien en base n'impose que la
  somme du journal égale le solde.

## 7. Performance

**Index explicites**

- `auth_sessions` : (family) et (user_id) ;
- `guest_players` : (last_seen) ;
- `password_resets` : (user_id) ;
- `timer_questions` : (level, category) ;
- `coin_ledger` : (user_id, created_at) ;
- `world_runs`, `world_game_runs`, `world_craft_runs`, `world_visitors` : (user_id, date) ;
- `world_crafts` : (user_id), plus l'unique partiel de case.

S'y ajoutent les index implicites des PK et des UNIQUE. Toutes les tables de l'île ont une PK qui commence par
`user_id`.

**Requêtes sans index adapté** (hypothèse : coût faible tant que les tables restent petites)

- `LOWER(email)` (inscription, connexion, signature, nouvelle adresse, mot de passe oublié) : pas d'index
  fonctionnel, donc lecture complète de `users` à chaque connexion. Index non unique `LOWER(email)` à décider.
- `delete_at` (balayage horaire) et `play_runs.updated_at` : pas d'index.

**Vue de l'île**

- `GET /play/world` passe par `db.cached` (`routes/play/world.js:41-43`) et lance ses lectures indépendantes ensemble
  (`world.js:278-282`).
- Aucun commentaire du code ne donne le nombre de requêtes. `ETAT_DES_LIEUX.md` § 4 (PR serveur #127) annonce 50
  requêtes au lieu de 79 : non vérifié ici.

**Mémoires en processus** : livre des recettes (sans expiration), succès et questions (5 min). Voir `BACKEND.md` § 9.

**Rejouer le schéma** à chaque `db:setup` fait passer des dizaines d'`ALTER TABLE`, même sans changement. Chacun prend
un verrou exclusif bref sur sa table : un déploiement pendant le jeu peut attendre ou faire attendre (hypothèse).

## 8. Écarts et risques

**Adresses e-mail et casse**

- `users.email` est UNIQUE mais sensible à la casse (`schema.sql:17`).
- Depuis le lot R3 (2026-10-09), **toutes** les comparaisons applicatives utilisent `LOWER()` : `register`, `login`,
  `claim`, `requestEmailChange`, `confirmEmailChange`, `passwordReset.request`. Une nouvelle variante de casse ne peut
  plus être créée par l'application.
- Restent possibles :
  - des doublons de casse **créés avant** le lot R3 (non vérifié en production : lecture interdite). `login` essaie
    d'abord l'adresse exacte, sinon chaque variante, du plus ancien au plus récent ;
  - deux inscriptions **simultanées** de variantes différentes (`A@x.fr` / `a@x.fr`) : la contrainte, sensible à la
    casse, ne les départage pas. Seul un index unique sur `LOWER(email)` le fermerait : migration à décider
    (échouerait si des doublons existent déjà ; les compter d'abord, en lecture seule) ;
  - le mot de passe oublié prend la première ligne trouvée parmi d'éventuelles variantes
    (`services/passwordReset.js:15-19`).
- `username` VARCHAR(100) : le nom tiré coupe le début de l'adresse à 95 caractères (`accounts.js`, lot R3) ; avant,
  une partie locale de plus de 95 caractères donnait 500.

**Défauts et colonnes périmés**

- `play_runs.mode` CHECK accepte encore `'explorer'` (mode retiré) ; seul `'timer'` est écrit.
- `progress.timer_progress` a pour défaut `bestScores: { Facile: 0, … }`, que le code ne lit plus. Le champ disparaît
  à la première écriture (`timerProgress.js`, `merge`).
- `progress.world_collected_at` n'est lue qu'une fois, à la création de `world_stock` (`world/reads.js:98`).
- `world_tiles` est gardée pour les remboursements.
- `achievements_list.unlocked` vaut toujours FALSE dans le seed ; il est remplacé par l'état du joueur.
- `timer_questions.elements_emojis` n'est jamais lu.
- Les lignes `game_data` `elements_data` et `formulas` ne sont pas lues par `src/`. Le commentaire du seed
  (`seed.sql:11-14`, `gen_seed.py:329`, `:338`) parle de `server.js` qui intercepterait des routes, et de
  `POST /api/game-data/combine` : ni l'un ni l'autre n'existe (`routes/gameData.js` ne sert que les questions).
  C'est un écart avec la documentation générée.

**Orphelins et croissance**

- `play_runs` et `book_letters` en `'u:<id>'` n'ont pas de FK. Elles survivent à l'effacement du compte : les
  pendus pour toujours, les parties jusqu'au prochain nettoyage (2 j, déclenché par un nouvel invité).
- L'export RGPD (`accountSettings.js:164-178`) ne prend que les tables à `user_id` : `book_letters` et `play_runs`
  n'y sont pas.
- Tables sans purge : `auth_sessions` (une ligne par refresh, environ toutes les 15 min de jeu ; expirées et révoquées
  gardées), `world_runs`, `world_game_runs`, `world_craft_runs`, `coin_ledger`.
- Le nettoyage des invités ne tourne que si de nouveaux invités arrivent.

**Intégrité**

- `chk_progress_coins` est `NOT VALID` : les lignes d'avant la contrainte n'ont jamais été vérifiées.
- `customization_items.achievement` pointe vers un nom de succès sans FK : renommer un succès casse la pièce méritée.
- `ledger.credit` inscrit le gain, puis fait `UPDATE progress` ; si la ligne `progress` n'existe pas encore, le gain
  est marqué versé sans créditer le solde.
  - Hypothèse : en pratique, `progress` est créée par `players.elements` ou `progress.save` avant tout gain. Ce n'est
    pas garanti par le schéma.
- `JWT_SECRET` est la clé des `page_id` : le changer rend orphelins `book_tries`, `book_letters` et les références
  `encre` de `coin_ledger` (déduit, `bookPages.js:37`).

**Écarts avec la documentation existante (base)**

- `PASSATION.md` (serveur) : « Aucune suppression en base » est la règle. Le schéma contient pourtant des `DROP`
  historiques, et « Recommencer l'île » supprime par conception (§ 1, § 6).
- `db/README.md` : « `IF NOT EXISTS` et `IF EXISTS` partout ». C'est exact, plus un bloc `DO` conditionnel. Pas
  d'écart.
- `db/README.md` : les volumes (827, 15, 2 986) concordent.

## 9. Non examiné

- L'état réel de la base de production : lignes, tailles, index réellement présents, contraintes validées. Aucune
  connexion, par consigne.
- Le contenu de `db/content/*.py` (qualité, atteignabilité) : seuls le seed et `gen_seed.py` ont été lus.
- Les requêtes exactes de chaque service de l'île : seuls les écritures JSONB, les verrous et les effacements ont
  été relus.
- `world/migrate.js` au-delà de son en-tête et des décalages de cases (`:50-51`, `:76`).
- Les plans d'exécution (`EXPLAIN`) : aucun mesuré.
