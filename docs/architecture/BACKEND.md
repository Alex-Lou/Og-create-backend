# Architecture du serveur de Brumelune

> **Vérifié contre le code : backend 9cc7bfe (2026-10-09)** ; front comparé : b47a53f2.
> Références `fichier:ligne` sur ce commit. « (hypothèse) » : déduction non vérifiée en exécution.

À lire avec : `PASSATION.md` (racine), `db/README.md`, `DATABASE.md` (ce dossier), et côté front `PASSATION.md` § 5
et `ETAT_DES_LIEUX.md`. Ce document ne les répète pas.

## 1. Rôle, pile et versions

- **Rôle** : API JSON du jeu ; le serveur fait autorité (recettes, écus, ressources, île, coffres).
- **Style** : CommonJS, Express 4, SQL écrit à la main (`pg`). Ni ORM, ni outil de migration, ni linter, ni
  champ `engines`.

| Dépendance | Déclarée | Résolue (lockfile v3) |
|---|---|---|
| express | ^4.21.2 | 4.22.3 |
| pg | ^8.13.3 | 8.13.3 (pg-pool 3.7.1) |
| bcrypt | ^6.0.0 | 6.0.0 |
| jsonwebtoken | ^9.0.2 | 9.0.2 |
| express-rate-limit | ^7.5.0 | 7.5.0 |
| helmet / cors | ^8.0.0 / ^2.8.5 | 8.0.0 / 2.8.5 |
| morgan | ^1.10.0 | 1.12.1 |
| nodemailer / dotenv | ^10.0.15 / ^16.4.7 | 10.0.15 / 16.4.7 |
| nodemon (dev) | ^3.0.3 | 3.1.14 |

- **Node 22** en CI (`.github/workflows/ci.yml:32`), Postgres 16 (`ci.yml:13`). **Scripts** : `start`,
  `dev` (nodemon), `db:setup` (`node db/setup.js`), `test` (`node --test test/*.test.js`).

## 2. Structure et couches

| Chemin | Contenu |
|---|---|
| `src/server.js` (38 l.) | démarrage, secret JWT, écoute, balayage des comptes supprimés |
| `src/app.js` (86 l.) | middlewares, montage des routes, 404, erreurs |
| `src/config/` | `db.js` (pool, `query`, `cached`, `transaction`) ; `emailConfig.js` (Gmail) |
| `src/middleware/` | `auth.js`, `rateLimit.js`, `compress.js` |
| `src/routes/` | 10 routeurs + `play/` (5 fichiers) : 91 routes, plus `/api/health` |
| `src/services/` | 43 modules + `world/` (15 modules découpés de `world.js`) |
| `src/utils/` | `jwt.js`, `crypto.js`, `logger.js`, `failure.js`, `achievementCondition.js` |
| `db/` | schéma, seed et générateur (voir DATABASE.md) |
| `scripts/scaleMap.js` | générateur ponctuel de la carte v5 (hors production) |
| `test/` | 30 fichiers `*.test.js` + `helpers.js` |

- **Couches** : routes → services → `config/db`. Aucune route n'écrit de SQL ; seule `routes/play/world.js` charge
  `config/db`, pour `db.cached` (`:41`).
- **Cycles** cassés par `require` différé : `world/people` ↔ `world/produce` ; `world/migrate` → `world/nights`
  (`migrate.js:11`).
- **`server.js`** : `.env` chargé depuis le dossier courant (`:3`) ; `LOG_LEVEL` fixé avant tout logger (`:6`) ;
  `ensureJWTSecret()` (`:8`) ; ligne « Tout roule! :) » attendue par les tests (`:21`) ; `sweepDeleted()` au
  démarrage puis toutes les heures (`:24-28`) ; rejet ou exception non rattrapés → `exit(1)` (`:30-38`).

**Ordre des middlewares (`src/app.js`)**

| Ligne | Middleware | Portée |
|---|---|---|
| 11 | `trust proxy` = `TRUST_PROXY_HOPS` ou 1 | réglage |
| 14 | morgan (production : statuts ≥ 400 seulement) | tout |
| 18 | helmet (CSP `self`, `unsafe-inline` scripts et styles) | tout |
| 29 | cors (`CORS_ORIGIN` ou `*`, `credentials`, en-tête `X-Map-Key` permis) | tout |
| 41 | `globalLimiter` | tout |
| 44 | anti-CSRF | `/api` |
| 51 | `compressJson` (gzip) | `/api` |
| 52-53 | `express.json` / `urlencoded`, limite `REQUEST_BODY_SIZE_LIMIT` (10 ko) | tout |
| 55-65 | routeurs ; `gameLimiter` en plus sur progress, achievements, coins, game-data | `/api/*` |
| 67 | `GET /api/health` | — |
| 71 | 404 JSON (journalisée par `console.log`) | — |
| 77 | erreurs : `err.status` ou 500 ; détail si `NODE_ENV=development` | — |

## 3. Cycle d'une requête

**Limites** (fabrique `middleware/rateLimit.js:4`, stockage en mémoire). Toutes en `Number(env) || défaut` :
une variable à 0 rend le défaut, pas 0.

| Limite | Fenêtre | Max | Clé | Variable | Réf. |
|---|---|---|---|---|---|
| globale | 15 min | 1000 | IP | `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS` | `app.js:39` |
| `gameLimiter` | 1 min | 200 | IP | `GAME_RATE_LIMIT_MAX_REQUESTS` | `app.js:40` |
| connexion | 15 min | 10 | IP | — | `routes/auth.js:20` |
| connexion par compte | 15 min | 10 | `login:<email minuscule>` | — | `auth.js:22-27` |
| inscription, provisoire, signature | 60 min | 10 | IP | `REGISTER_RATE_LIMIT` | `auth.js:29` |
| refresh | 15 min | 60 | IP | — | `auth.js:30` |
| réglages (`guarded`) | 15 min | 10 | `account:<id>` | — | `routes/account.js:16` |
| lien de nouvelle adresse | 15 min | 10 | IP | — | `account.js:17` |
| mot de passe oublié / reset | 15 min | 5 / 10 | IP | — | `routes/passwordReset.js:15` |
| contact | 60 min | 5 | IP | — | `routes/contact.js:13` |
| erreurs du jeu | 1 min | 10 | IP | — | `routes/clientErrors.js` |
| progress, timer | 1 min | 120 | `req.user.id` | — | `progress.js:9`, `timer.js:9` |
| `addressLimiter` (`/api/play`) | 1 min | 600 | IP | `PLAY_ADDRESS_RATE_LIMIT` | `play/shared.js:26` |
| `playLimiter` | 1 min | 120 | `u:<id>`, sinon `g:<oc_guest ou IP>` | — | `shared.js:19-24` |
| `guestLimiter` | 60 min | 20 | IP | **aucune** | `shared.js:27` |

- Toutes les routes de l'île passent par `playLimiter` (`routes/play/world.js:14`).
- Le 429 global (`tooMany`, `app.js`) renvoie `{ error, message, retryAfter }` : `retryAfter` = minutes restantes de la
  fenêtre (au moins 1), `message` = « Trop de requêtes, réessaie dans N min. » — corrigé (lot jeu, 2026-10-09) ; avant,
  `retryAfter` valait des minutes depuis 1970 et le jeu affichait son texte de secours. Test : `test/limits.test.js`.

**Le reste du parcours**

- **Anti-CSRF** (`app.js:44-47`) : hors GET, HEAD et OPTIONS, l'en-tête `X-Requested-With: origins` est exigé,
  sinon 403. Les cookies sont en plus `SameSite=Strict`.
- **Gzip** (`middleware/compress.js`) : seulement `res.json`, si `Accept-Encoding` contient gzip et si le corps fait
  au moins 1024 octets (`:6`). `gzipSync` niveau 6, synchrone (`:14`), avec `Vary`.
- **`X-Map-Key`** : si la clé de carte du navigateur correspond, la vue part sans les calques `grid`, `height`,
  `ground`, `region` (`routes/play/world.js:18-33`).
- **Erreurs** : `utils/failure.js` journalise (error) puis répond 500 `{ message, errorDetails }`, le détail en
  `development` seulement. Les routes de jeu répondent « Le serveur de jeu ne répond pas » (`shared.js:29-32`).
- **Journal** (`utils/logger.js`) : debug < info < warn < error ; seuil `LOG_LEVEL`, warn s'il est absent (`:3`).
  Le SQL a son propre réglage, `DB_LOG_LEVEL` (`config/db.js:7`).

## 4. Authentification et joueurs

**Cookies** (`services/authSession.js`)

| Cookie | Contenu | Durée | Chemin | Réf. |
|---|---|---|---|---|
| `oc_access` | JWT HS256 `{ typ: 'access', username, sid }`, `sub` = id, `sid` = famille de session | 15 min | `/api` | `signAccess`, `issue` |
| `oc_refresh` | 32 octets aléatoires ; en base, empreinte SHA-256 seulement | 30 j | `/api/auth` | `:12`, `:68-77` |
| `oc_guest` | jeton invité, haché de même | 30 j | `/api` | `players.js:9-10`, `:47` |

- **Drapeaux** : `httpOnly`, `SameSite=Strict`, `Secure` si `NODE_ENV=production` (`authSession.js:19-27`).
- **Pas d'en-tête `Authorization`** : `middleware/auth.js` lit le cookie ; sinon 401 `TOKEN_EXPIRED`.
- **Deux lectures du jeton d'accès** (lot R4, 2026-10-09) :
  - `verifyAccess` (synchrone, sans base) : signature, expiration, `typ`. Sert seulement à nommer le joueur (clé
    des limites `play/shared.js`, refus de `/auth/provisional` si déjà connecté).
  - `checkAccess` (une requête indexée sur `auth_sessions.family`) : en plus, la session `sid` doit exister, à ce
    compte, non révoquée, non expirée. Utilisé par `authMiddleware` et `players.resolve` : **toute route qui ouvre
    un accès**.
  - Jeton sans `sid` (émis avant la mise à jour) : accepté seulement si son `iat` précède le démarrage du processus ;
    il expire seul en 15 min au plus. Aucune déconnexion forcée au déploiement.
- **Rotation** (`rotate`, `:86-111`), dans une transaction `FOR UPDATE OF s` :
  - session expirée ou inconnue → 401 ;
  - remplacée depuis moins de `AUTH_RACE_SECONDS` (10 s, `:14`) → 409 `REFRESH_RACE` ;
  - remplacée depuis plus longtemps → toute la famille est supprimée, cookies effacés (vol probable) ;
  - sinon `revoked_at` est posé et un nouveau jeton est émis dans la même famille.
- **Révocation** : la déconnexion supprime la famille (`:114-123`) ; mot de passe, pause et suppression appellent
  `revokeAll`. Depuis le lot R4, le jeton d'accès déjà émis tombe **immédiatement** avec sa session (`checkAccess`).
  Une rotation garde la famille : l'ancien jeton d'accès de la même session reste valable jusqu'à son expiration.

**Comptes** (`services/accounts.js`, `routes/auth.js`)

- bcrypt coût 12 (`accounts.js:6`) ; mot de passe de 8 caractères à 72 octets ; comparaison factice si l'adresse
  est inconnue (`:36-43`). Nom affiché : `<début de l'adresse>_<4 chiffres>` (`:23`).
- **Connexion** (`auth.js:97-112`) : `welcomeBack` lève la pause et annule une suppression prévue, puis session,
  puis adoption du carnet invité.
- **Compte provisoire** (`accounts.js:49-64`, `auth.js:62-74`) : `naufrage-<hex>@provisoire.invalid`, mot de passe
  aléatoire inconnu de tous. Signé par `POST /auth/claim` (`claim`, transaction `FOR UPDATE`). Aucun lien de mot de
  passe vers lui (`services/passwordReset.js:17`).
- **Balayage des provisoires** (`accounts.js:85-95`) : plus de 30 j et aucune session créée depuis 30 j. Déclenché
  seulement par `POST /auth/provisional`, au plus une fois par heure et par processus.
- **Réglages** (`services/accountSettings.js`) : pause = `suspended_at` + `revokeAll` (`:116`) ; suppression =
  `delete_at` à 7 j, après le mot de passe (`:129`) ; effacement par `sweepDeleted` (`:157`, lancé par
  `server.js:24-28`) puis `ON DELETE CASCADE` ; export RGPD (`:164`) de chaque table à `user_id`, sauf
  `auth_sessions`, `password_resets`, `email_changes`.

**Joueurs** (`services/players.js`) **et enveloppes de routes**

- `resolve(req)` (`:28`) : compte `{ kind: 'user', key: 'u:<id>' }`, sinon invité `{ kind: 'guest', key: 'g:<id>' }`
  (avec mise à jour de `last_seen`).
- `createGuest` (`:41-49`) purge d'abord les données abandonnées (DATABASE.md § 6). `adoptGuest` (`:152`) verse les
  éléments de l'invité dans `progress.infinite_elements`, puis supprime l'invité.
- Règles selon l'âge du compte : `VETERAN_BEFORE` 2026-10-06T06:00Z (`:59`), `V6_SINCE` 2026-10-08T12:00Z (`:68`),
  et `islandModeOf` (`:80`), fonction pure : ancien / neuf / recommencé / première nuit inachevée.
- `withPlayer` (`routes/play/shared.js:35`) : sans joueur → 401 `NO_PLAYER`, exception → 500.
  `withAccount` (`:47`) : un invité reçoit 402 `ACCOUNT`. `pay` et `payOnce` (`:52-64`) : 50 écus, compte seulement.

## 5. Carte des services

**Purs** (ni requête, ni `config/db`) :

| Module | Rôle |
|---|---|
| `annexes`, `crafts` | catalogues et bonus des annexes ; créations d'île et leur puzzle |
| `anya` | éveil, traces, visites tirées d'une graine, Bénédiction |
| `avatarChoices` | validation de l'avatar composé |
| `beasts`, `nights` | règles des bêtes de ferme, des nuits de créatures |
| `bookPages` | chapitres, pages, fil d'Ariane, barèmes (lit `JWT_SECRET`, `:37`) |
| `finds`, `landmarks`, `pickups` | gisements de climat, lieux remarquables, grève |
| `hangman` | pendu (état montré, erreurs permises) |
| `harvest`, `minigames`, `levels` | moteurs déterministes et niveaux des jeux à grille (copies du front, § 6) |
| `islandData`, `islandOuter`, `islandV5` | calques figés des cartes v3, v4, v5 |
| `worldMap`, `worldMapV2`, `worldMapV4` | carte v5 (144 × 144) ; anciennes cartes pour la migration |
| `loot`, `quests` | coffres (rareté, lot) ; chaîne des quêtes de Brume |
| `naming`, `signs` | règles des noms ; styles d'enseigne |
| `villagers`, `visitors`, `worldShop` | habitants ; visiteurs ; boutique des ateliers |
| `world/rules` | constantes, `SITES`, effets, production, charges |

**Avec base** :

| Module | Rôle |
|---|---|
| `accounts`, `accountSettings`, `authSession`, `passwordReset` | comptes, réglages, sessions, mot de passe oublié |
| `players` | qui joue, carnet de l'Infini, partie d'Épreuve, adoption |
| `recipeBook` | livre lu une fois dans `game_data`, gardé en mémoire (`:9`, `:45`) |
| `bookTries`, `bookLetters` | essais ratés par page ; pendu (transaction sur la ligne) |
| `trial`, `timerQuestions`, `timerProgress`, `progress` | Épreuve jugée ; questions (mémoire 5 min) ; progression |
| `achievementService`, `customization` | succès (mémoire 5 min, recalcul `FOR UPDATE`) ; Cabinet |
| `ledger` | grand livre : `credit` idempotent, `debit`, `debitOnce` |
| `world` (952 l.) | API de l'île : vue, quêtes, chantiers, Récolte, mini-jeux, boutique, noms, recommencer |
| `world/reads`, `world/migrate` | lectures, dont `stockOf` (`:91`) ; cartes v1 → v5 et règlement des nuits |
| `world/chests`, `people`, `produce` | coffres ; habitants et visiteurs ; production |
| `world/lands`, `creations`, `annexPlots` | expéditions et gisements ; créations ; annexes posées |
| `world/anyaBrume`, `nights`, `beasts` | Anya et Brume ; nuits ; bêtes |
| `world/camp`, `paths`, `stars` | mixtes : règles pures + lectures par la connexion reçue |

**Transactions et verrous**

- `db.transaction(fn)` (`config/db.js:74-91`) : `BEGIN` … `COMMIT`. `ROLLBACK` sur exception, ou si `fn` renvoie
  `db.rollback(valeur)` (`:71`) : la valeur est alors rendue telle quelle.
- **Motif de l'île** : `stockOf(userId, conn, true)` en tête de transaction (`SELECT … world_stock … FOR UPDATE`,
  ligne créée si absente, `world/reads.js:91-103`). Il sérialise les actions d'un joueur.
- **37 appels verrouillés** : `world.js` 11, `creations` 5, `people` 5, `lands` 4, `beasts` 3, `annexPlots`,
  `anyaBrume` et `chests` 2 chacun, `migrate`, `nights` et `produce` 1 chacun.
- **Exceptions** : `restartIsland` verrouille `users` (`world.js:221`) ; `skipPrologue` (`:197`) et `chooseAvatar`
  (`:869`) écrivent sans transaction. `GET /play/world` ouvre deux transactions verrouillées (`migrate`,
  `refundDecorations`).
- **`db.cached(fn)`** (`config/db.js:25-48`) : mémoire de lecture pour un calcul (AsyncLocalStorage). Seuls les
  `SELECT` sans `FOR UPDATE`/`FOR SHARE` sont mémorisés ; toute autre requête vide la mémoire ; chaque lecteur
  reçoit une copie (`structuredClone`) ; `conn.query` n'y passe jamais. Sert à la vue de l'île
  (`routes/play/world.js:41-43`).
- **Pool** : `pg.Pool` sans réglage (`config/db.js:11`), donc la taille par défaut de pg (hypothèse : 10).

## 6. Règles partagées avec le front

Comparaison par `diff` après normalisation : commentaires, indentation et lignes `require`/`import`/`export` retirés.

| Serveur | Front | État au 2026-10-09 |
|---|---|---|
| `services/harvest.js` | `src/game/harvest.js` | **identiques** |
| `services/levels.js` | `src/game/levels.js` | **identiques** |
| `services/minigames.js` | `src/game/minigames.js` | **identiques** |
| `services/naming.js` | `src/utils/names.js` | **identiques** |
| `utils/achievementCondition.js` | `src/utils/achievementChecker.js` | **identiques** (le front ajoute `findNewlyUnlocked`) |
| `services/signs.js` | `src/world/nameSigns.js` | mêmes 6 identifiants de style ; prix et règles côté serveur seulement |
| `services/anya.js` | `src/game/anya.js` | **différents par nature** : le front porte textes et scènes |

Toucher un moteur, c'est toucher les deux côtés et les deux suites de tests (`ETAT_DES_LIEUX.md` § 1).

## 7. Configuration (`grep process.env`)

| Variable | Défaut | Rôle | Réf. |
|---|---|---|---|
| `DATABASE_URL` | — | connexion, prioritaire (SSL réglé dans l'URL) | `config/db.js:11`, `db/setup.js:12` |
| `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` | défauts pg | connexion sans URL | `config/db.js:14-18` |
| `DB_LOG_LEVEL` | `ERROR` | journal SQL (`INFO`, `DEBUG`) | `config/db.js:7` |
| `JWT_SECRET` | aucun (≥ 32 car.) | JWT ; **clé HMAC des identifiants de pages** | `utils/jwt.js:17`, `authSession.js:47,59`, `bookPages.js:37` |
| `PORT` | 3000 | écoute | `server.js:11` |
| `NODE_ENV` | — | `production` : Secure, morgan réduit, log warn ; `development` : détail des erreurs | `app.js:13,82`, `authSession.js:22`, `players.js:16`, `failure.js:6` |
| `LOG_LEVEL` | warn (prod), info | seuil du journal | `server.js:6`, `logger.js:3`, `app.js:79` |
| `CORS_ORIGIN` | `*` | origine CORS | `app.js:30` |
| `TRUST_PROXY_HOPS` | 1 | proxys de confiance (IP des limites) | `app.js:11` |
| `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS` | 15, 1000 | limite globale | `app.js:39` |
| `GAME_RATE_LIMIT_MAX_REQUESTS` | 200 | limite « jeu » | `app.js:40` |
| `REQUEST_BODY_SIZE_LIMIT` | `10kb` | taille des corps | `app.js:49` |
| `REGISTER_RATE_LIMIT` | 10 | créations de compte par heure et IP | `routes/auth.js:29` |
| `PLAY_ADDRESS_RATE_LIMIT` | 600 | `/api/play` par minute et IP | `play/shared.js:26` |
| `AUTH_RACE_SECONDS` | 10 (0 permis : `??`) | refresh concurrents tolérés | `authSession.js:14` |
| `EMAIL_USER`, `EMAIL_PASSWORD` | — | Gmail : contact, mot de passe oublié, nouvelle adresse | `config/emailConfig.js:6-7` |
| `APP_URL` | `https://og-create.onrender.com` | base des liens des mails | `passwordReset.js:12`, `accountSettings.js:16` |
| `MAIL_TIMEOUT_MS` | 12000 | délai du mail de nouvelle adresse seulement | `accountSettings.js:14` |
| `ISLAND_RESTART_ONCE` | absent | `1` : recommencer une seule fois ; sinon à volonté (anti double toucher 10 s) | `world.js:225-226` |
| `TEST_PORT` | port libre | tests | `test/helpers.js:30` |

## 8. Tests

- **Lancement** : `npm test` (`node --test test/*.test.js`), un processus par fichier, en parallèle.
- **Volume** : 33 fichiers, 235 tests. 16 fichiers démarrent le vrai serveur sur une base ; 17 sont purs
  (`jwt.test.js` au lot R1 ; `emails.test.js`, `emailsDoubles.test.js` au lot R3).
- **Référence (2026-10-09)** : 216 / 216 avant les lots ; 235 / 235 après R1, R4, R3 et R2, sur un Postgres 16
  temporaire et isolé.
- **`whileHeld`** (`test/helpers.js`) : rafraîchit `pg_stat_activity` à chaque tour (`pg_stat_clear_snapshot()`),
  sinon une connexion ouverte après la première lecture restait invisible et le test se bloquait ; en cas d'échec, la
  transaction est annulée avant d'attendre la requête (plus d'interblocage). Corrigé au lot R3.
- **Variables** : `DATABASE_URL` (ou `DB_*`), `JWT_SECRET` (secret de test public de la CI) ; base passée par
  `npm run db:setup`.
- **`test/helpers.js`** :
  - `startServer` (`:29-50`) : port libre, avec `NODE_ENV=test`, `AUTH_RACE_SECONDS=0`,
    `REGISTER_RATE_LIMIT=200`, `PLAY_ADDRESS_RATE_LIMIT=5000` (`:36`) ;
  - `api()` : boîte à cookies et en-tête anti-CSRF ;
  - `newPlayer()` (`:105-117`) : antidate `created_at` et écrit directement en base ;
  - `whileHeld()` (`:122-143`) : rejoue une course à coup sûr.
- **Pièges** :
  - **les tests écrivent dans la base visée** (comptes, `UPDATE` directs). Jamais la base de production, jamais le
    Postgres de ce VPS ;
  - `guestLimiter` (20 invités par heure et IP) n'a pas de variable, et `play.test.js` en crée déjà exactement 20 :
    un 21e invité dans ce fichier reçoit 429 ;
  - la connexion (10 / 15 min) et le contact (5 / h) n'ont pas de variable non plus ;
  - un fichier = un serveur = ses propres compteurs : un 429 dépend du fichier.

## 9. Dette technique et points d'attention

**Secret JWT au démarrage** (`utils/jwt.js`, appelé à `server.js:8`, après dotenv à `server.js:3`) — **corrigé
(lot R1, 2026-10-09)**

- Règle unique : 32 caractères au moins (`MIN_LENGTH`), que le secret vienne de l'environnement ou du `.env`.
- Environnement valable → rien à faire. Sinon `.env` requis (sinon échec franc au démarrage) : son secret est repris
  s'il est valable, sinon un nouveau (128 hex) y est écrit. Dans les deux cas `process.env.JWT_SECRET` est renseigné
  pour le processus en cours.
- Avant le correctif : le secret généré n'était écrit que dans le fichier, les connexions échouaient jusqu'au
  redémarrage (reproduit : `register` en 500 ; après correctif : 201). Tests : `test/jwt.test.js` (7 cas).

**Le même secret fait les identifiants de pages** (`bookPages.js:37-42`). Le changer change tous les `page_id` :
`book_tries`, `book_letters` et les références `encre` de `coin_ledger` ne correspondraient plus à rien (déduit du
code). À traiter comme une migration de données.

**Plus gros fichiers** (`wc -l`) : `test/play.test.js` 2525 ; `services/world.js` 952 ; `db/content/riddles.py`
856 ; `db/schema.sql` 539 ; `routes/play/world.js` 516 ; `islandV5.js` 448 ; `world/people.js` 381 ;
`gen_seed.py` 369 ; `islandOuter.js` 311 ; `world/rules.js` 310 ; `bookPages.js` et `quests.js` 304.
`src/` : 10 411 lignes JS en 85 fichiers, dont 923 de cartes figées.

**État en mémoire**, qui empêche plusieurs instances derrière un répartiteur :

- compteurs de toutes les limites (MemoryStore) : avec N instances, chaque limite est multipliée par N ;
- livre des recettes chargé une fois (`recipeBook.js:9`) : un nouveau seed n'est vu qu'**après redémarrage** ;
- mémoires de 5 min des succès et des questions (`achievementService.js:6`, `timerQuestions.js:5`) ;
- `sweptAt` (`accounts.js:86`) et minuteur `sweepDeleted` : travail fait en double, sans gravité ;
- `SPOTS` (`annexPlots.js:25`) et `patterns` (`naming.js:6`) : simples mémoires de calcul.

**Autres points vérifiés**

- `CORS_ORIGIN` absent → `*` avec `credentials` : le navigateur refuse les cookies cross-origin. Sans effet si le
  front relaie `/api` sur son domaine, comme le dit `app.js:9-10` (hypothèse sur le déploiement).
- `TRUST_PROXY_HOPS` vaut 1 alors que `app.js:9-10` décrit deux sauts (hébergeur + relais du site). Trop bas,
  `req.ip` devient celle du relais et tous les joueurs partagent les limites par IP, dont 20 invités par heure
  (hypothèse).
- `POST /auth/register` et `/auth/login` — **corrigés (lot R3, 2026-10-09)** :
  - adresse : texte, ≤ 255, forme `a@b.c` (`isEmail` de `routes/auth.js`, même règle que `routes/account.js`) ;
    `@provisoire.invalid` refusée à l'inscription ; login refuse un `email` non textuel (400, plus de 500) ;
  - course sur la même adresse : 23505 → 400 « Email ou username déjà utilisé » (comme `/claim`) ;
  - casse : inscription et connexion par `LOWER()` comme le reste ; doublons anciens gérés (DATABASE.md § 8) ;
  - nom tiré borné à 95 + 5 caractères (`username` VARCHAR(100)) : une longue adresse ne donne plus 500.
  - Reste : nom tiré déjà pris (1 chance sur 9000 par préfixe) → message « Email ou username déjà utilisé »
    trompeur ; pas d'index sur `LOWER(email)`.
- Mot de passe oublié : `sendMail` attendu sans délai maximal (`services/passwordReset.js:27`). La durée de la
  réponse diffère selon que le compte existe (hypothèse : fuite par la durée).
- `timer_progress` — **corrigé (lot R2, 2026-10-09)** : l'annonce du navigateur est filtrée par
  `chaptersOf` (questions payées au joueur dans `coin_ledger`, `timer-question`, et nombre de questions par chapitre) ;
  fusion question par question (un envoi partiel n'efface plus rien) ; un chapitre ne se scelle que complet ; une
  valeur non itérable ne fait plus 500. Les entrées gardées d'avant la règle restent telles quelles.
- `config/emailConfig.js` appelle `transporter.verify()` au chargement : sans identifiants, une erreur est
  journalisée à chaque démarrage.
- La 404 et la bannière de démarrage écrivent par `console.log`, hors du logger.

## 10. Écarts avec la documentation existante

| Document | Affirmation | Code (9cc7bfe) |
|---|---|---|
| `PASSATION.md` (serveur) | `world.js` « ≈ 1 700 lignes », « doit être découpé » | 952 lignes, déjà découpé en `services/world/` (15 fichiers) |
| `PASSATION.md` (serveur), front § 5 | « chaque action renvoie la vue complète » | sauf `/world/harvest/start` (la partie seule), `/world/prologue/skip`, `/world/restart`, `GET /world/brume` |
| idem | « chaque action … verrouille `world_stock` » | presque toutes ; exceptions au § 5 |
| front `PASSATION.md` § 1 | « 6 300 lignes côté serveur » | 10 411 lignes dans `src/` |
| front `PASSATION.md` § 5 | `world.js` « ≈ 650 lignes » | 952 |
| front `PASSATION.md` § 5 | `worldMap.js` 96 × 96 ; migration v1 → v4 | 144 × 144 (`worldMap.js:1`), `MAP_VERSION = 5` (`world/rules.js:27`), v1 → v5 (`migrate.js:1`) ; le 144 est déjà corrigé par `ETAT_DES_LIEUX.md` § 8 |
| `db/README.md` | `JWT_SECRET` : « 64 dans `.env` » | Corrigé au lot R1 : 32 partout, secret généré utilisé tout de suite (§ 9) |
| `db/README.md` | `EMAIL_PASSWORD` : « formulaire de contact » | sert aussi au mot de passe oublié et à la nouvelle adresse |
| commentaires `world.js:205`, `players.js:73` | recommencer l'île « une fois par compte » | à volonté sauf `ISLAND_RESTART_ONCE=1` (`world.js:222-226`) ; `ETAT_DES_LIEUX.md` § 4 dit juste |
| `ETAT_DES_LIEUX.md` | « 215 tests côté serveur » | 216 (chiffre daté) |

## 11. Non examiné

- Le détail des règles de l'île (production, nuits, quêtes) : seuls les motifs de transaction ont été vérifiés.
- L'exécution : aucun serveur lancé, aucune base touchée. Le 216 / 216 vient du lead.
- Le déploiement réel (VPS, variables effectives) : `/etc/brumelune` et `/srv` non lus ; les mentions de Render et
  de Neon dans le code et les docs n'ont pas été vérifiées.
- `scripts/scaleMap.js` et `db/content/check.py` : en-têtes seulement.
- La comparaison `worldShop.js` / `tints.js` et `rareSprites.js` du front.
- La sécurité des dépendances (`npm audit` non lancé : il demande le réseau).
