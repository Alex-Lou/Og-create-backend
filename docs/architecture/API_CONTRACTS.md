# Contrats d'API — Brumelune

Vérifié contre le code : backend 9cc7bfe, front b47a53f2 (2026-10-09)

Le serveur (`Og-create-backend`) possède le contrat. Le front (`frontend`) le consomme.
Toute affirmation renvoie à `fichier:ligne`. Une déduction non vérifiée porte la mention « (hypothèse) ».

**Abréviations des références**

| Abrév. | Chemin |
|---|---|
| `app` | backend `src/app.js` |
| `R/` | backend `src/routes/` |
| `P/` | backend `src/routes/play/` |
| `S/` | backend `src/services/` |
| `W` | backend `src/routes/play/world.js` |
| `http` | front `src/services/http.js` |
| `PS` | front `src/services/playService.js` |
| `App/` | front `src/components/App/App/` |
| `WV/` | front `src/components/World/WorldView/` |

---

## 1. Conventions générales

| Sujet | Règle | Réf. |
|---|---|---|
| Préfixe | Toutes les routes sous `/api` | `app:55-67` |
| Origine | Même origine : le front appelle `/api` (relais Vite en local, Nginx en prod) | front `src/config.js:4`, `vite.config.mjs:35` |
| Base front | `VUE_APP_API_URL` ou `/api` | front `src/config.js:4` |
| Délai client | 20 s par requête | `http:12` |
| `Content-Type` | `application/json` envoyé par défaut sur toute requête | `http:11` |
| Anti-CSRF | Hors GET/HEAD/OPTIONS : `X-Requested-With: origins` exigé, sinon 403 `{ message: 'Requête refusée' }` | `app:44-47` |
| En-tête front | `X-Requested-With: origins` posé sur toutes les requêtes | `http:7,11` |
| Autorisation | Aucun en-tête `Authorization` lu : session par cookie seulement | `src/middleware/auth.js:1-2` |
| Corps max | `REQUEST_BODY_SIZE_LIMIT`, 10 ko par défaut, JSON strict + urlencoded | `app:49,52-53` |
| Gzip | Réponse `res.json` gzip si `Accept-Encoding: gzip` et ≥ 1024 octets ; `Vary: Accept-Encoding` | `src/middleware/compress.js:6-19`, `app:51` |
| CORS origine | `CORS_ORIGIN`, sinon `*` ; `credentials: true` | `app:29-35` |
| CORS méthodes | GET, POST, PUT, DELETE, OPTIONS (seuls GET et POST sont routés) | `app:31` |
| CORS en-têtes | `Content-Type`, `X-Requested-With`, `X-Map-Key` | `app:32` |
| Proxy | `trust proxy` = `TRUST_PROXY_HOPS` ou 1 (IP réelle pour les limites) | `app:11` |
| Route inconnue | 404 `{ message: 'Route non trouvée', path }` | `app:71-74` |
| Cache SW | Le service worker ne touche pas `/api` (préfixes statiques seulement) | front `public/sw.js:8,36,58` |

### Cookies

| Cookie | Contenu | Path | Durée | Attributs | Réf. |
|---|---|---|---|---|---|
| `oc_access` | JWT HS256 `{ typ:'access', username, sid, sub }` (`sid` = famille de session, lot R4) | `/api` | 15 min, et tant que sa session existe | httpOnly, SameSite=Strict, Secure en prod | `S/authSession.js` (`signAccess`, `checkAccess`) |
| `oc_refresh` | Jeton opaque 64 hex, changé à chaque usage, empreinte SHA-256 en base | `/api/auth` | 30 j | idem | `S/authSession.js:12,17,69-76,86-111` |
| `oc_guest` | Jeton opaque 64 hex (carnet invité) | `/api` | 30 j | idem | `S/players.js:9-20,45-47` |

- `oc_guest` est effacé à la connexion et à l'inscription (le carnet rejoint le compte) : `S/players.js:152-167`, `R/auth.js:33-40`.
- `oc_refresh` n'est envoyé que sur `/api/auth/*`. Sur `/api/account/*`, `revoke()` ne le voit donc pas. Il efface seulement les cookies (`S/authSession.js:114-123`). La base est déjà purgée par `revokeAll` (`S/accountSettings.js:116-142`).
- Deux onglets qui rafraîchissent en même temps : l'ancien jeton reste toléré `AUTH_RACE_SECONDS` (10 s par défaut) et renvoie 409 `REFRESH_RACE`. Au-delà, sa réutilisation supprime toute la famille de sessions (401) : `S/authSession.js:14,99-107`.

### Mécanisme `X-Map-Key` (calques de la carte)

| Côté | Comportement | Réf. |
|---|---|---|
| Serveur, émission | `map.key = MAP_VERSION:<quartiers voilés>:<clé des chemins>` dans la vue de l'île | `S/world.js:388`, `S/world/rules.js:27`, `S/world/paths.js:81` |
| Serveur, lecture | Seulement sous `/api/play/world*` : `req.get('X-Map-Key')` ; si égal à `map.key`, retire `grid`, `height`, `ground`, `region` de la vue (seule `{ map }` ou dans `{ world }`) | `W:16-33` |
| Front, envoi | En-tête posé sur **toutes** les requêtes dès qu'une clé est en mémoire | `http:45-48` |
| Front, réception | Garde les calques si `map.ground` est présent ; sinon les remet si la clé est la même | `http:37-44,64-71` |

---

## 2. Niveaux d'accès

| Niveau | Garde | Refus | Réf. |
|---|---|---|---|
| public | aucune | — | — |
| session | `authMiddleware` (cookie `oc_access` valide **et** session ouverte : `checkAccess`) | 401 `{ message:'Session expirée ou absente', code:'TOKEN_EXPIRED' }` | `src/middleware/auth.js` |
| joueur | `withPlayer` : compte, sinon carnet invité (`oc_guest`) | 401 `{ message:'Aucune partie', code:'NO_PLAYER' }` ; exception → 500 `{ message:'Le serveur de jeu ne répond pas, réessaie.' }` | `P/shared.js:29-43`, `S/players.js:28-38` |
| compte | `withAccount` = joueur + `kind === 'user'` | invité : 402 `{ message:'Ton île t’attend…', code:'ACCOUNT' }` ; sans joueur : 401 `NO_PLAYER` | `P/shared.js:46-49` |

Refus « compte » sans `code` :
- aides payantes (`pay`, `payOnce`) : 402 `{ message:'Les aides payantes demandent un compte.' }` ; solde insuffisant : 400 (`P/shared.js:52-64`) ;
- `letter/retry` : 402 (`P/book.js:83`).

Note : sous `/play`, un cookie d'accès expiré **ou dont la session est fermée** (déconnexion, mot de passe changé,
pause, suppression) donne 401 `NO_PLAYER` et non `TOKEN_EXPIRED`, car `resolve` retombe sur l'invité
(`S/players.js:28-38`). Réaction du front inchangée : 401 avec indice de session → un `POST /auth/refresh` → échec →
session oubliée et rechargement (`http.js:73-90`).

---

## 3. Erreurs

### 3.1 Formes des corps

| Forme | Où | Réf. |
|---|---|---|
| `{ message }` | Cas général (validation, refus métier `{ status, message }` des services) | ex. `W:68`, `R/account.js:18` |
| `{ message, code }` | `TOKEN_EXPIRED`, `NO_PLAYER`, `ACCOUNT`, `NO_RUN`, `REFRESH_RACE` | `src/middleware/auth.js:10`, `P/shared.js:38,46`, `P/index.js:56`, `P/trial.js:27`, `S/authSession.js:102` |
| `{ message, errorDetails }` | 500 via `failure()` ; `errorDetails` vaut `error.message` en `development`, sinon `null` | `src/utils/failure.js:4-7` |
| `{ message }` 500 | Jeu (`fail`), contact, refresh, logout, reset | `P/shared.js:29-32`, `R/contact.js:42`, `R/auth.js:122,142` |
| `{ message, error }` | Gestionnaire global : `err.status` ou 500 ; `error` = message en dev, `{}` sinon | `app:77-84` |
| `{ error, retryAfter }` | 429 des limites globale et « jeu » | `app:38` |
| Champs en plus | `letter` 409 `{ message, page, hangman }` ; `purchase` 400 `{ message, required }` | `P/book.js:71`, `S/customization.js:55` |

### 3.2 Codes HTTP

| Code | Sens dans l'API |
|---|---|
| 200 | Succès |
| 201 | Compte créé (`register`, `provisional`) — `R/auth.js:54,70` |
| 400 | Validation, solde insuffisant, partie refusée ; JSON mal formé (body-parser, via `app:80`) (hypothèse sur le statut exact) |
| 401 | Pas de session, pas de joueur, identifiants faux, refresh expiré ou révoqué |
| 402 | Compte requis (île, aides payantes, rejouer le pendu) |
| 403 | Anti-CSRF ; mauvais mot de passe ; compte provisoire (`SIGN_FIRST`) ; condition de jeu non remplie |
| 404 | Route ou objet inconnu ; page hors de portée |
| 409 | Conflit : déjà fait, course, `NO_RUN`, `REFRESH_RACE`, compte déjà signé |
| 413 | Corps > limite (body-parser) (hypothèse : non exécuté) |
| 429 | Limite de requêtes |
| 500 | Erreur serveur |
| 503 | Mail de changement d'adresse non parti — `S/accountSettings.js:94` |

### 3.3 Limites de requêtes

Toutes passent par `limiter()` (`src/middleware/rateLimit.js:4-14`) : en-têtes `RateLimit-*` (draft-6) et `Retry-After` ; store mémoire, propre à chaque processus.
Corps du 429 : `{ message }` si l'option `message` est donnée, sinon le `handler` de `app:38`.

| Limite | Portée | Fenêtre / max | Clé | Réf. |
|---|---|---|---|---|
| globale | tout | 15 min / 1000 (env) | IP | `app:39,41` |
| jeu | `/progress`, `/achievements`, `/coins`, `/game-data` | 1 min / 200 (env) | IP | `app:40,58-64` |
| connexion | `/auth/login` | 15 min / 10, deux fois | IP, puis `login:<email>` | `R/auth.js:20-27,97` |
| inscription | `/auth/register`, `/provisional`, `/claim` | 60 min / 10 (`REGISTER_RATE_LIMIT`) | IP | `R/auth.js:29` |
| refresh | `/auth/refresh` | 15 min / 60 | IP | `R/auth.js:30` |
| oubli / reset | `/auth/forgot-password`, `/reset-password` | 15 min / 5 et 10 | IP | `R/passwordReset.js:15` |
| compte | `password`, `email`, `delete`, `export` | 15 min / 10 | compte | `R/account.js:16` |
| lien | `/account/email/confirm` | 15 min / 10 | IP | `R/account.js:17` |
| progress, timer | tout le routeur | 1 min / 120 | compte | `R/progress.js:9`, `R/timer.js:9` |
| contact | `/contact/send` | 60 min / 5 | IP | `R/contact.js:13` |
| play adresse | tout `/play` | 1 min / 600 (`PLAY_ADDRESS_RATE_LIMIT`) | IP | `P/index.js:12`, `P/shared.js:26` |
| play joueur | `state`, `combine`, `book`, `ink`, `letter*`, `run`, `joker`, `timer/finish`, `/world*` | 1 min / 120 | `u:<id>` ou `g:<cookie invité ou IP>` | `P/shared.js:19-24`, `W:14` |
| invité | `/play/guest` | 60 min / 20 | IP | `P/shared.js:27` |

### 3.4 Réaction du front

| Cas | Comportement | Réf. |
|---|---|---|
| GET sans réponse (sauf annulé) ou 502/503/504 | Rejoué après 1, 2, 4, 8, puis 15 s, dans un budget de 90 s | `http:19-32,75` |
| POST en échec réseau | Jamais rejoué | `http:17-18,75` |
| 401 hors `/auth/`, avec indice de session | Un seul `POST /auth/refresh`, partagé entre les requêtes, puis la requête est rejouée une fois (`_retry`) | `http:52-62,78-82` |
| Refresh en 409 | `GET /auth/me` ; la réponse sert d'indice de session | `http:57-58` |
| Refresh en échec | `clearSession()`, puis `window.location.reload()` | `http:83-87` |
| 401 sans session (invité) | Renvoyé à l'appelant | `http:77-78` |
| `code: 'NO_PLAYER'` | `asPlayer` : `POST /play/guest` (une seule création à la fois), puis un seul nouvel essai | `PS:6-22` |
| Île en 401 ou 402 | L'île passe en mode invitation (`guest = true`) | `WV/WorldView.vue:819-823` |
| Message affiché | `error.response.data.message`, sinon un texte de secours | front `src/utils/errors.js:2-4` |
| 429 | Aucun traitement dédié ; les 429 `{ error }` donnent le texte de secours | `app:38`, front `src/utils/errors.js:3` |

`asPlayer` enveloppe `state`, `combine`, `run`, `book`, `ink`, `letter`, `retry`, `joker` et `finishTimer`. Il n'enveloppe pas les appels `/world*` (`PS:26-263`).

---

## 4. Catalogue des routes

92 routes (alias `timer_questions` compté avec `timer-questions`). Colonnes : accès, corps → réponse, erreurs notables, appel front.

### 4.1 Santé

| Route | Accès | Réponse | Front | Réf. |
|---|---|---|---|---|
| `GET /health` | public | `{ status:'OK', environment, timestamp }` | non appelé par le front ; `healthCheckPath` (front `render.yaml:35`), `deploy/ovh/deploy.sh:42` | `app:67-69` |

### 4.2 Authentification (`R/auth.js`, `R/passwordReset.js`)

| Route | Accès | Corps → réponse | Erreurs | Front |
|---|---|---|---|---|
| `POST /auth/register` (`:42`) | public | `{ email, password }`. Email : `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Mot de passe : chaîne d'une ligne, ≥ 8 caractères, ≤ 72 octets (`S/accounts.js:15-20`). → 201 `{ message, userId, username }` + cookies | 400 (champs, format, mot de passe, email ou username pris), 429, 500 | `SeuilModal.vue:69`, `PrologueName.vue:76` via `authService.js:18` |
| `POST /auth/provisional` (`:62`) | public | — → 201 `{ userId, username, provisional:true }` + cookies | 409 si déjà connecté ; 429 | non appelé par le front |
| `POST /auth/claim` (`:77`) | session | `{ email, password }` : même format, ≤ 255, pas `@provisoire.invalid` → `{ message, userId, username, provisional:false }` + nouvelle session | 400, 404, 409 (déjà signé) (`S/accounts.js:68-81`) | non appelé par le front |
| `POST /auth/login` (`:97`) | public | `{ email, password }` → `{ userId, username, back? }` ; `back` ∈ `suspendu`, `suppression` (`S/accountSettings.js:146-154`) | 400, 401 `Authentification échouée`, 429 | `SeuilModal.vue:68`, `PrologueName.vue:73` |
| `POST /auth/refresh` (`:115`) | cookie refresh | — → `{ userId, username }` + cookies tournés | 401 (absente, expirée, révoquée), 409 `REFRESH_RACE`, 429, 500 | `http:56` |
| `GET /auth/me` (`:127`) | session | `{ userId, username, provisional }` | 401 `TOKEN_EXPIRED` | `http:57` (après un 409 seulement) |
| `POST /auth/logout` (`:136`) | public | — → `{ message }` ; famille de sessions supprimée, cookies effacés | 500 | `App/account.js:109` via `authService.js:39` |
| `POST /auth/forgot-password` (`R/passwordReset.js:17`) | public | `{ email }` (chaîne coupée, ≤ 255) → toujours `{ message }` générique | 400, 429 | `SeuilModal.vue:67` |
| `POST /auth/reset-password` (`R/passwordReset.js:29`) | public | `{ token: 64 hex, password }` → `{ message }` | 400 `Lien invalide ou expiré` ou mot de passe, 429, 500 | `ResetPasswordModal.vue:51` |

### 4.3 Compte (`R/account.js`, service `S/accountSettings.js`)

| Route | Accès | Corps → réponse | Erreurs | Front (`AccountModal.vue` sauf mention) |
|---|---|---|---|---|
| `GET /account` (`:20`) | session | → `{ name, look, email, username, createdAt, provisional, pendingEmail }` (`email` null si provisoire) | 404 | `:189` |
| `POST /account/password` (`:31`) | session, limite compte | `{ current, password }` → `{ message }` ; toutes les sessions fermées, une neuve posée | 400, 403 (mauvais mot de passe ou `SIGN_FIRST`), 404 | `:259` |
| `POST /account/email` (`:42`) | session, limite compte | `{ password, email }` (coupé, ≤ 255, regex) → `{ message, pendingEmail }` ; lien valable 60 min | 400, 403, 409 (prise), 503 (mail) | `:247` |
| `POST /account/email/confirm` (`:54`) | public, limite IP | `{ token: 64 hex }` → `{ message, email }` | 400, 409 | `App/account.js:70` |
| `POST /account/suspend` (`:66`) | session | — → `{ message }` ; sessions fermées | 403 `SIGN_FIRST`, 404 | `:281` |
| `POST /account/delete` (`:78`) | session, limite compte | `{ password }` → `{ message, deleteAt }` (dans 7 j) | 403, 404 | `:285` |
| `GET /account/export` (`:90`) | session, limite compte | → pièce jointe JSON `{ exportedAt, account, data }` (sans `password_hash` ni tables secrètes) | 404 | `:266` |

### 4.4 Progression, Épreuve, données de jeu

| Route | Accès | Corps → réponse | Erreurs | Front |
|---|---|---|---|---|
| `GET /progress/load` (`R/progress.js:11`) | session | → `{ discoveredElements, coins, timerProgress, lastSaved }` (`S/progress.js:7-16`) | 401, 429, 500 | `App/account.js:87` |
| `POST /progress/save` (`R/progress.js:19`) | session | `{ timerProgress? }` (objet fusionné) → `{ message, lastSaved }` ; le reste est ignoré (`S/progress.js:19-23`) | 500 | non appelé par le front |
| `GET /timer/load-progress` (`R/timer.js:11`) | session | → `{ completedQuestions, unlockedCategories, bestScores }` (`S/timerProgress.js:28-31`) | 401, 429 | `TimerQuestions.vue:239` via `trialService.js:23` |
| `POST /timer/update-timer-progress` (`R/timer.js:19`) | session | `{ timerProgress: objet }`. Fusion de `completedQuestions` et de `unlockedCategories[Facile/Moyen/Difficile]` ; tout autre champ est ignoré (`S/timerProgress.js:9-17`). → `{ message, timerProgress: {…, bestScores} }` | 400 si l'objet manque | `TimerQuestions.vue:337`, `App/trial.js:142` |
| `GET /game-data/timer-questions` (`R/gameData.js:9`) | public | → `{ levels: { <niveau>: { timer, categories: { <chap>: { questions: [{ id, text, points, initialElements:{ validationMode, requiredCount, required, additional } }] } } } } }`, sans les réponses (`S/timerQuestions.js:9-31`) | 500 | `TimerQuestions.vue:243` via `trialService.js:13` |
| `GET /game-data/timer_questions` | public | alias du précédent | — | non appelé par le front |

### 4.5 Écus, succès, Cabinet

| Route | Accès | Corps → réponse | Erreurs | Front |
|---|---|---|---|---|
| `GET /coins/balance` (`R/coins.js:10`) | session | → `{ coins }` | 500 | non appelé par le front |
| `GET /achievements` (`R/achievements.js:9`) | public | → `[{ id, name, description, unlocked, condition, image }]` (cache 5 min) | **404 si la liste est vide**, 500 | `App/achievements.js:24` via `achievementsService.js:15` |
| `GET /achievements/user` (`:30`) | session | → `{ <nom>: { …succès, unlocked, unlockedAt } }` | 401 | idem `achievementsService.js:16` |
| `POST /achievements/update` (`:20`) | session | `{ achievements: { <nom>: { unlockedAt } } }` (non vide). Le serveur recalcule ; il ne garde que la date, si elle est passée (`S/achievementService.js:38-60`). → `{ message, achievements, newlyUnlocked, timestamp }` | 400 | `App/achievements.js:43` |
| `GET /customization/items` (`R/customization.js:10`) | session | → lignes `customization_items` (`SELECT *`) | 500 | `CustomizeModal.vue:239` |
| `GET /customization/unlocked` (`:18`) | session | → pièces possédées : par défaut, achetées ou méritées | 500 | `CustomizeModal.vue:240` |
| `GET /customization/selections` (`:26`) | session | → `{ selectedFrame, selectedAvatar }` (valeurs par défaut sinon) | 500 | `App/account.js:88` |
| `POST /customization/selections` (`:34`) | session | `{ selectedFrame, selectedAvatar }` : `image_path` possédés → `{ message, selectedFrame, selectedAvatar }` | 400, 403 | `CustomizeModal.vue:288` |
| `POST /customization/purchase` (`:46`) | session | `{ itemId }` → `{ message, item, remainingCoins }` (débit et grand livre dans une transaction) | 400 (déjà possédé, `required`), 403 (pièce méritée), 404 | `CustomizeModal.vue:272` |

### 4.6 Contact

| Route | Accès | Corps → réponse | Erreurs | Front |
|---|---|---|---|---|
| `POST /contact/send` (`R/contact.js:18`) | public, 5/h/IP | `{ email, message }` : email coupé, `/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/`, ≤ 255 ; message coupé, 1 à 5000 caractères → `{ message }` ; HTML échappé dans le mail | 400, 429, 500 | `Settings/ContactModal/ContactModal.vue:66` (appel `http` direct) |

### 4.7 Jeu : cœur (`P/index.js`)

| Route | Accès | Corps → réponse | Erreurs | Front |
|---|---|---|---|---|
| `POST /play/guest` (`:16`) | public, 20/h/IP | — → `{ kind }`. Pose `oc_guest` s'il n'y a ni joueur ni carnet ; purge les carnets de plus de 30 j | 429, 500 | `PS:9` (`asPlayer`) |
| `GET /play/state` (`:26`) | joueur | → `{ kind, elements, known:{ nom:{ emoji, family, riddle? } }, families:{ famille: total }, unexplored:{ nom: n } }` | 401 `NO_PLAYER` | `App/carnet.js:37` |
| `POST /play/combine` (`:48`) | joueur | `{ mode: 'infinite'\|'timer', ingredients: 2 à 4 chaînes /^[^\u0000-\u001f]{1,60}$/, page?: /^[A-Za-z0-9_-]{1,32}$/ }`. → `{ result:null, aim? }` ou `{ result, emoji, family, riddle?, isNew, aim?, trial?, unexplored? }`. `aim` = `{ page, right, of, misses, need, freeInk }`. `trial` = `{ found, required, solved?, points?, late?, credited?, coins? }` (`S/trial.js:71-95`) | 400, 403 (ingrédient absent), 409 `NO_RUN` | `Craft/CraftZone/CraftZone.vue:238` |

### 4.8 Le Livre (`P/book.js`)

| Route | Accès | Corps → réponse | Erreurs | Front |
|---|---|---|---|---|
| `GET /play/book` (`:16`) | joueur | → `{ stars, chapters:[{ id, name, verse, families, need, open, total, found, far, sealed, pages }], ariane }` (`S/bookPages.js:220-224`) | 401 | `Book/BookView/BookView.vue:382` |
| `POST /play/ink` (`:31`) | joueur (payant : compte) | `{ page }` (PAGE) → `{ page, ingredient, coins, free }`. Gratuit après N essais ratés ou sur la page guidée ; payé une seule fois par page (50) | 400, 402, 404 (hors de portée) | `BookView.vue:535` |
| `POST /play/letter` (`:60`) | joueur | `{ page, position: entier, letter: A-Z }` (mis en majuscule) → `{ page, verdict:'hit'\|'elsewhere'\|'miss', hangman, inscribed? }`. `inscribed` = `{ result, emoji, family, isNew, unexplored }` | 400 (lettre, case), 404, 409 (case remplie ; partie perdue `{ message, page, hangman }`) | `Book/BookView/hangman.js:44` |
| `POST /play/letter/retry` (`:82`) | joueur → compte | `{ page }` → `{ page, coins, hangman }` | 402 (invité), 409 (partie non perdue), 400 (écus) (`S/bookLetters.js:44-56`) | `hangman.js:68` |

### 4.9 L'Épreuve en jeu (`P/trial.js`)

| Route | Accès | Corps → réponse | Erreurs | Front |
|---|---|---|---|---|
| `POST /play/run` (`:12`) | joueur | `{ mode:'timer', questionId: entier > 0, launch?: true }` → `{ elements, known, freeJokers, required }` | 400, 404 | `App/trial.js:103` |
| `POST /play/joker` (`:23`) | joueur | `{ kind: 'step'\|'ingredient'\|'time' }`. → `{ freeJokers, coins?, ingredients? \| ingredient? }`. `time` ajoute 30 s. Payant (50) une fois les jokers offerts épuisés | 400, 409 `NO_RUN`, 409 (aucune étape), 402/400 (paiement) | `App/trial.js:114` |
| `POST /play/timer/finish` (`:53`) | joueur | — → `{ score, credited, coins? }`. Bonus de record = score × 5 (`S/trial.js:11,97-109`) | 500 | `App/trial.js:132` |

### 4.10 Le Monde (`W`) — compte requis partout

Toutes les routes passent par `withAccount` (401 `NO_PLAYER`, 402 `ACCOUNT`) et par la limite joueur (`W:14`).
« vue » : la vue complète de l'île renvoyée seule. « +world » : la réponse contient `world` = la vue. Les refus métier sont `{ status, message }` (liste des codes : services `S/world.js`, `S/world/*.js`).
Coordonnées : entiers de 0 à 143 (`W:202`, `S/worldMap.js:8`).

**Clés de la vue** (`S/world.js:381-528`) :
`size`, `map{ key, grid, height, ground, region, coreLeft, zones }`, `landmarks`, `finds`, `deposits`, `pickups`, `expedition`, `sites`, `stock`, `charges`, `harvest`, `rates`, `capHours`, `pending`, `pendingStock`, `roads`, `crafts`, `villagers`, `houses`, `friendship`, `visitor`, `needs`, `stages`, `games`, `signs`, `annexes`, `camp`, `people`, `player`, `avatar`, `brume`, `brumeSavoir`, `chests`, `heliane`, `anya`, `nights`, `beasts`.
`GET /world` y ajoute `refund{ count, coins, balance }` une seule fois (`W:52`, `S/world.js:745-757`).

| Route (POST sauf mention) | `W` | Corps (validation de la route) | Réponse | Erreurs | Front |
|---|---|---|---|---|---|
| `GET /world` | 58 | — | vue (+ `refund`) | 401, 402 | `WV/WorldView.vue:793` |
| `/world/craft/start` | 71 | `craft` /^[a-z]{1,20}$/ | `{ run:{ id, craft, shape, pieces, turned }, coins? }` (sans world) | 400, 403, 404 | `WV/workshop.js:81` |
| `/world/craft/finish` | 79 | `run` entier > 0 ; `layout` tableau ≤ 40 | `{ made, craft, coins?, world }` | 400, 404, 409 | `WV/workshop.js:100` |
| `/world/craft/place` | 86 | `craft`, `x`, `y`, `flip` booléen (false par défaut) | `{ coins?, world }` | 400, 404, 409 | `WV/workshop.js:178` |
| `/world/craft/turn` | 94 | `x`, `y`, `flip` booléen obligatoire | `{ coins?, world }` | 400, 404 | `WV/workshop.js:233` |
| `/world/craft/move` | 99 | `x`, `y`, `toX`, `toY` | `{ coins?, world }` | 400, 404, 409 | `WV/workshop.js:206` |
| `/world/craft/store` | 104 | `x`, `y` | `{ coins?, world }` | 400, 404, 409 | `WV/workshop.js:270` |
| `/world/paths` | 111 | `lay`, `erase` : tableaux de `[x, y]` entiers, 80 au plus chacun (`S/world/paths.js:125-130`) | `{ laid, erased, world }` | 400, 409 | `WV/roads.js:283` |
| `/world/collect` | 119 | — | `{ gained, stock, coins, world }` | — | `WV/sites.js:161` |
| `/world/item` | 125 | `item` /^[a-z-]{1,30}$/ | `{ bought, coins, world }` | 400, 403, 404, 409 | `WV/sites.js:191` |
| `/world/item/undo` | 134 | `item` | `{ undone, coins, world }` | 400, 404, 409 | `WV/sites.js:222` |
| `/world/skin` | 143 | `site` /^[a-z]{1,20}$/ ; `skin` /^[a-z-]{0,30}$/ (vide = d'origine) | vue | 400, 403, 404 | `WV/sites.js:265` |
| `/world/name` | 153 | `kind` `site`\|`zone` ; `id` /^[a-z0-9-]{1,20}$/ ; `name` chaîne (vide = remise ; 2 à 22, `S/naming.js:5-16`) | vue | 400, 403, 404 | `WV/sites.js:146` |
| `/world/people` | 163 | `name` chaîne (2 à 22) | vue | 400 | front `src/world/view/draw/brume.js:144` |
| `/world/player` | 171 | `name` chaîne (2 à 22) | vue | 400 | `App/story.js:448`, `AccountModal.vue:223` |
| `/world/avatar` | 180 | `look` /^avatar-(0[1-9]\|1[0-2])$/ ou `choices` objet (`S/avatarChoices.js`) ; validé par le service (`S/world.js:868-881`) | vue | 400 | `App/story.js:248`, `AccountModal.vue:234` |
| `/world/sign/name` | 187 | `name` (2 à 14, `S/signs.js:20`) | vue | 400 | `WV/chests.js:128` |
| `/world/sign` | 192 | `site`, `style` /^[a-z]{1,20}$/ | `{ coins, world }` | 400, 403, 404 | `WV/chests.js:115` |
| `/world/annex` | 211 | `annex` /^[a-z]{1,20}$/, `x`, `y`, `flip?` booléen, `look?` entier 0-9 ou null | `{ built, coins, world }` | 400, 403, 404, 409 | `WV/annexes.js:119` |
| `/world/annex/move` | 222 | `x`, `y`, `toX`, `toY` | vue | 400, 404, 409 | `WV/annexes.js:148` |
| `/world/annex/pose` | 231 | `x`, `y` + `flip` et/ou `look` | vue | 400, 404 | `WV/annexes.js:178` |
| `/world/zone` | 241 | `zone` /^[a-z]{1,20}$/ | `{ bought, coins, world }` | 400, 403, 404, 409 | `WV/explore.js:83` |
| `/world/expedition` | 251 | `zone` | `{ expedition:{ zone, endsAt }, coins?, world }` | 400, 403, 404, 409 | `WV/explore.js:108` |
| `/world/nights/start` | 260 | — | `{ world }` | — | `WV/nights.js:85` |
| `/world/nights/repel` | 266 | `id` /^\d{4}-\d{2}-\d{2}:\d$/ | `{ id, world }` | 400, 404, 409 | `WV/nights.js:97` |
| `/world/repair` | 275 | `site` | `{ site, cost, coins?, world }` | 400, 404, 409 | `WV/nights.js:108` |
| `/world/landmark` | 284 | `id` /^[a-z]{1,20}$/ | `{ landmark, fresh, world }` | 400, 403, 404 | `WV/explore.js:157` |
| `/world/deposit` | 293 | `id` /^[a-z]{1,16}-\d$/ | `{ find, amount, world }` | 400, 403, 404, 409 | `WV/explore.js:204` |
| `/world/pickup` | 302 | `id` /^greve-[a-z]{1,12}-\d$/ | `{ kind, gives, world }` | 400, 403, 404, 409 | `WV/explore.js:196` |
| `/world/build` | 311 | `site` | `{ built, coins?, world }` | 400, 403, 404, 409 | `WV/sites.js:108` |
| `/world/harvest/start` | 324 | `level?` entier 1-30 ou null | `{ id, seed, kinds, maxMoves, boosts, level, goal }` (sans world) | 400, 403, 409 | `WV/games.js:49` |
| `/world/harvest/finish` | 332 | `run` entier > 0 ; `moves` tableau (≤ `maxMoves`, `S/harvest.js:114`) | `{ gains, earned, coins, chest, level, world }` ; partie consommée même refusée | 400, 404 | `WV/games.js:61` |
| `/world/game/start` | 341 | `game` /^[a-z]{1,20}$/, `level?` 1-30 | `{ run:{ id, game, seed, level, short, limit, stage?, goal? }, world }` | 400, 403, 404, 409 | `WV/games.js:92` |
| `/world/game/finish` | 349 | `run` ; `input` tableau | `{ earned, raw, detail, coins, level, world }` | 400, 404 | `WV/games.js:107` |
| `/world/anya/reveal` | 363 | — | `{ anya, world }` | 403, 409 | `App/story.js:366` |
| `/world/villager/talk` | 377 | `villager` /^[a-z0-9]{1,20}$/ ; `known?`, `heard?` : listes de PAGE (400 dernières, `W:369`) | `{ gained, points, hearts, rewards, coins, savoir, world }` ; `brume` ou `anya` : `{ savoir, world }` | 400, 403, 404, 409 | `WV/folk.js:308,325,342` |
| `/world/villager/gift` | 413 | `villager` ; `resource` /^[a-z]{1,10}$/ | `{ gained, points, hearts, rewards, coins, world }` | 400, 403, 404, 409 | `WV/folk.js:366` |
| `/world/villager/need` | 424 | `villager` ; `need` /^[a-z]{1,10}$/ | `{ filled, coins?, world }` | 400, 403, 404, 409 | `WV/folk.js:398,434` |
| `/world/villagers/needs` | 430 | — | `{ filled, coins?, world }` | 400, 403, 409 | `WV/folk.js:486` |
| `/world/beast/feed` | 434 | `beast` /^[a-z-]{1,20}$/ | `{ beast, collected, coins?, world }` | 400, 403, 404, 409 | `WV/folk.js:434,452` |
| `/world/beasts/collect` | 442 | — | `{ food, world }` | — | `WV/folk.js:468` |
| `/world/beasts/cage` | 447 | — | `{ hens, world }` | 403, 409 | `WV/folk.js:136` |
| `/world/visitor` | 453 | `id` entier sûr > 0 | `{ reward, coins, world }` | 400, 403, 404, 409 | `WV/folk.js:186` |
| `/world/visitor/settle` | 461 | `id` | `{ settled, coins?, world }` | 400, 403, 404, 409 | `WV/folk.js:204` |
| `/world/chest` | 470 | `source` /^(jour\|bouteille\|chapitre:[IVX]{1,4}\|quete:[a-z0-9-]{1,30}\|lieu:[a-z]{1,20})$/ | `{ chest, coins, world }` | 400, 403, 404, 409 | `WV/chests.js:46` |
| `/world/chests/all` | 479 | — | `{ chests, coins, world }` | 409 | `WV/chests.js:67` |
| `GET /world/brume` | 486 | — | `{ quest, done, total, acts, rested, people, anya, tutorial, skipped }` (`S/world.js:181-185`, `S/quests.js:278`) | 401, 402 | `App/story.js:323`, `App/account.js:79`, `App/achievements.js:51` |
| `/world/prologue/skip` | 492 | — | `{ skipped:true }` | 409 (première nuit non faite) | `App/story.js:409` |
| `/world/restart` | 499 | `confirm === 'RECOMMENCER'` | `{ restarted:true }` | 400, 409 | `AccountModal.vue:277` |
| `/world/quest` | 507 | `id` /^[a-z0-9-]{1,30}$/ | `{ gained, coins, world }` | 400, 403, 409 | front `src/world/view/draw/brume.js:170` |

---

## 5. Cohérence du contrat (comparaison des deux dépôts)

### 5.1 Couverture

- **Appelé par le front mais absent du serveur** : aucun. Le front appelle 87 routes (86 chaînes `http.get/post`, dont `/auth/${endpoint}` pour login et register). Toutes existent côté serveur ; les deux listes ont été comparées mécaniquement.
- **Exposé mais inutilisé par le front** :
  - `POST /auth/provisional` (`R/auth.js:62`) et `POST /auth/claim` (`:77`) ;
  - `GET /coins/balance` (`R/coins.js:10`) ;
  - `POST /progress/save` (`R/progress.js:19`) ;
  - l'alias `GET /game-data/timer_questions` (`R/gameData.js:9`) ;
  - `GET /health` (déploiement seulement).
- `GET /auth/me` ne sert qu'après un 409 au refresh (`http:57`) ; `provisional` n'y est pas lu.

### 5.2 Écarts de champs et de comportement

| # | Écart | Front | Serveur | Effet |
|---|---|---|---|---|
| E1 | Le front envoie `{ bestScores: { [niveau]: score } }` à `update-timer-progress` | `App/trial.js:142` | `merge` ne garde que `completedQuestions` et `unlockedCategories` (`S/timerProgress.js:9-17`). Les records viennent de `coin_ledger` (`:20-26`) | Écriture sans effet : ligne verrouillée, `last_saved` touché. La réponse remplace bien l'état local |
| E2 | Corps 429 des limites globale et « jeu » : `{ error, retryAfter }`, sans `message` | `src/utils/errors.js:3` lit `message` | `app:38` | Le joueur voit le texte de secours, pas « Trop de requêtes » |
| E3 | `retryAfter` faux : `req.rateLimit.resetTime` est une `Date` (express-rate-limit 7.5.0), donc `Date/1000/60` donne des minutes depuis 1970, pas un délai | — | `app:38` | Valeur inutilisable (le front ne la lit pas). L'en-tête `Retry-After`, lui, est juste |
| E4 | `/world/restart` documenté « une fois par compte » | `PS:110` | Illimité sauf `ISLAND_RESTART_ONCE=1` ; 409 seulement pour un double toucher de moins de 10 s (`S/world.js:222-226`) | Commentaires de la route (`W:498`) et du front trompeurs |
| E5 | Le commentaire de `world()` annonce `rate` | `PS:55` | La vue envoie `rates` (`S/world.js:432`) | Le code lit bien `state.rates` (`WV/WorldView.vue:152`) : écart de commentaire seulement |
| E6 | Le commentaire de `brume()` annonce `{ quest, done, total, rested }` | `PS:172` | Envoie aussi `acts`, `people`, `anya`, `tutorial`, `skipped` (`S/world.js:185`, `S/quests.js:278`) | Ces champs sont bien lus (`App/account.js:80-82`, `App/story.js:324`) : commentaire incomplet |
| E7 | `GET /achievements` répond 404 si la liste est vide | `achievementsService.js:14-17` (`Promise.all`) | `R/achievements.js:12` | Le Codex échoue en entier au lieu d'afficher une liste vide (base vide seulement) |
| E8 | Constantes recopiées dans le front : prix de l'encre et du joker (50), temps du joker (30 s), bonus de record invité (× 5) | `BookView.vue:189`, `src/utils/hints.js:5,7`, `App/trial.js:140` | `P/shared.js:13`, `P/trial.js:9`, `S/trial.js:11` | Identiques aujourd'hui ; à changer des deux côtés |

### 5.3 Flux principaux vérifiés sans écart

| Flux | Envoyé ↔ attendu | Lu ↔ renvoyé |
|---|---|---|
| Auth | `{ email, password }` (`authService.js:18`) ↔ `R/auth.js:43,98` | `userId`, `username`, `back` (`authService.js:19-21`, `session.js:14-15`) ↔ `R/auth.js:108`, `S/authSession.js:77` |
| Refresh | — | `{ userId, username }` ↔ `R/auth.js:119`, `/auth/me` `:129` |
| `play/state` | — | `elements`, `known`, `families`, `unexplored` (`App/carnet.js:37-60`) ↔ `P/index.js:28-34` |
| `play/combine` | `{ mode, ingredients, page? }` (`PS:32`) ↔ `P/index.js:49` | `result`, `emoji`, `family`, `isNew`, `aim`, `unexplored`, `trial` (`App/carnet.js:100-105`, `CraftZone.vue:246-253`) ↔ `P/index.js:64-71` |
| Verdict de l'Épreuve | — | `found`, `late`, `solved`, `coins` (`App/App.vue:541-544`) ↔ `S/trial.js:82-95` |
| `play/run`, `joker`, `finish` | `{ mode, questionId, launch }`, `{ kind }` ↔ `P/trial.js:13-24` | `freeJokers`, `known`, `coins`, `ingredients`/`ingredient`, `score` ↔ `P/trial.js:19,36-49,54` |
| `timer` | `{ timerProgress:{ completedQuestions, unlockedCategories } }` (`TimerQuestions.vue:337`) ↔ `R/timer.js:20` | `.timerProgress` (`trialService.js:31`) ↔ `R/timer.js:23` |
| `play/world` | Corps du tableau 4.10 ↔ validations `W` | `world`, `coins`, `refund{ count, coins, balance }` (`WV/WorldView.vue:831-833`) ↔ `S/world.js:757` ; calques `X-Map-Key` (`http:39-44` ↔ `W:19-25`) |
| Compte | `{ current, password }`, `{ password, email }`, `{ token }` ↔ `R/account.js:33,43-46,55` | `pendingEmail`, `deleteAt`, `message` (`AccountModal.vue:249,286`) ↔ `R/account.js:48,83` |
| Cabinet | `{ itemId }`, `{ selectedFrame, selectedAvatar }` ↔ `R/customization.js:35,47` | `remainingCoins` (`CustomizeModal.vue:273`) ↔ `S/customization.js:58` |

---

## 6. Versions et compatibilité

### 6.1 Règles de déploiement

| Règle | Réf. |
|---|---|
| Pas de version dans l'URL ni d'en-tête de version d'API | `app:55-65` |
| Fusion et déploiement : **serveur d'abord, puis front juste derrière** (« un ancien front casse souvent face à une nouvelle API ») | front `PASSATION.md:62`, backend `PASSATION.md:18`, front `ETAT_DES_LIEUX.md:389-390` |
| Le front suppose des champs servis par le serveur (`level`, `short`, `limit`, `stages`, `roads`) | front `ETAT_DES_LIEUX.md:389-390` |
| Pendant l'écart, le serveur doit rester lisible par l'ancien front : ajouter des champs, ne pas en renommer ni en retirer, garder les alias (ex. `timer_questions`, `R/gameData.js:8-9`) (hypothèse : règle déduite, non écrite) | — |
| Nouvelle version du front détectée par `/version.json` (fichier statique, hors API) | front `src/utils/newVersion.js:1-12` |
| Changer `MAP_VERSION` change `map.key` : les calques gardés par le front sont alors renvoyés | `S/world/rules.js:27`, `S/world.js:388` |
| Nouvelle source de coffre : à ajouter aussi à la regex de `/world/chest` | front `PASSATION.md:647-648`, `W:472` |

### 6.2 Générations de comptes (effets sur les réponses)

| Repère | Valeur | Réf. |
|---|---|---|
| `VETERAN_BEFORE` | 2026-10-06T06:00:00Z (compte « d'avant la bible ») | `S/players.js:59` |
| `V6_SINCE` | 2026-10-08T12:00:00Z (île v6 : tutoriel) | `S/players.js:68` |
| `RESTARTED` | marque `ile:recommencee` : l'île suit les règles d'un compte neuf | `S/players.js:76` |
| `islandModeOf` | `veteran` = né avant `VETERAN_BEFORE`, île non recommencée, première nuit faite. `fresh` = né après `V6_SINCE`, ou île recommencée, ou première nuit non faite | `S/players.js:80-88` |
| Invité | jamais vétéran | `S/players.js:64` |

| Effet visible dans l'API | Condition | Réf. |
|---|---|---|
| Chapitre II du Grimoire ouvert d'emblée (`/play/book`, chapitres de `/world/zone`, `/build`, `/chest`) | `isVeteran` (date du compte seule) | `S/bookPages.js:34`, `P/book.js:24`, `W:36` |
| `brume.tutorial` = `!veteran` (vue et `GET /world/brume`) | île vétérane | `S/world.js:195,508` |
| Quartier à plan : `price:0`, `plan`, `planOwned` ; achat refusé sans le plan | île non vétérane | `S/world.js:402,555` |
| Feu du Foyer allumé d'office (`levels.foyer = 1`) | île non `fresh` | `S/world/reads.js:78-86` |
| Habitants présents ou affamés (Ponton, Foyer, prologue) | `veteran` / `fresh` | `S/world/people.js:43-44,68,74` |
| Sol et chemins de l'île neuve ; préfixe `n`/`v` de la clé des chemins (donc de `map.key`) | marque de chemins | `S/world/paths.js:59-81` |
| `prologue/skip` refusé (409) | première nuit non faite | `S/world.js:197-200` |

---

## 7. Vigilance : sécurité et validation

| # | Constat | Réf. | Gravité |
|---|---|---|---|
| V1 | La progression de l'Épreuve vient du client : `completedQuestions` et `unlockedCategories` sont fusionnés sans contrôle de clés ni de valeurs. `/play/run` ne vérifie pas que le chapitre est ouvert. Le verrou des chapitres n'existe donc que dans le navigateur. Les points restent versés une fois par question (`timer-question`, ref = id) | `S/timerProgress.js:9-17`, `P/trial.js:12-20`, `S/trial.js:91-93` | moyenne |
| V2 | `launch: true` sur `/play/run` remet `free_jokers` à 2 à chaque appel. En relançant, on obtient des jokers offerts sans limite, au prix de la remise à zéro du score de la partie (hypothèse sur l'intérêt réel) | `S/trial.js:42-43,55` | faible |
| V3 | `register` ne refuse pas les adresses `@provisoire.invalid`, que seul `claim` refuse. Un tel compte est vu comme provisoire : email masqué, réglages refusés, effacement après 30 j sans session | `R/auth.js:44-45` vs `:80`, `S/accounts.js:52-53,87-95` | moyenne |
| V4 | `register` : ni longueur max ni type pour l'email. Un email > 255 caractères bute sur le `VARCHAR(255)` (500). Un tableau passe la regex par coercition, puis `usernameFor` échoue (500) | `R/auth.js:43-45`, `S/accounts.js:23`, `db/schema.sql:17` | faible |
| V5 | Unicité de l'email : exacte pour `register` et `login`, insensible à la casse pour `claim` et le changement d'adresse. Deux comptes `A@x.fr` et `a@x.fr` peuvent coexister | `S/accounts.js:28,39,74`, `S/accountSettings.js:73,107` | faible |
| V6 | `/auth/provisional` est public et non utilisé par le front : création de comptes à 10/h/IP | `R/auth.js:62` | faible |
| V7 | CORS : `*` par défaut avec `credentials: true` si `CORS_ORIGIN` manque. Atténué par SameSite=Strict et l'en-tête anti-CSRF. Valeur de prod non examinée (exemple : `https://brumelune.eu`, front `deploy/ovh/api.env.example:14`) | `app:30,33` | faible |
| V8 | `trust proxy` vaut 1 par défaut : sans relais réel devant Node, `X-Forwarded-For` serait forgeable et les limites par IP contournables (hypothèse : prod derrière Nginx, front `deploy/ovh/nginx/brumelune.eu.conf:61-70`) | `app:11` | faible |
| V9 | Limites en mémoire, par processus : remises à zéro au redémarrage, non partagées entre instances | `src/middleware/rateLimit.js:5-13` | info |
| V10 | `/health` expose `NODE_ENV` ; `/achievements` (public) expose les `condition` de chaque succès | `app:68`, `S/achievementService.js:13` | info |
| V11 | Un `oc_access` expiré avec un `oc_guest` encore présent fait jouer en invité sans 401 : mélanges inscrits au carnet invité, île en 402. Cas rare, car `oc_guest` est effacé à la connexion (hypothèse) | `S/players.js:28-38,156` | faible |
| V12 | `POST /customization/selections` répond succès même sans ligne `progress` (UPDATE de 0 ligne) ; `itemId` n'est pas typé (erreur SQL → 500, hypothèse) | `S/customization.js:35`, `R/customization.js:47-48` | info |
| V13 | Faits rassurants : écus, carnet, recettes, scores, coffres et parties sont décidés côté serveur. Les achats sont protégés contre le double clic (`ON CONFLICT`, `FOR UPDATE`). Les parties (Récolte, mini-jeux, créations) sont rejouées côté serveur. Les tableaux du client sont bornés (`layout` ≤ 40, chemins ≤ 80, `known/heard` ≤ 400, coups ≤ `maxMoves`) | `S/ledger.js:8-49`, `W:81,369`, `S/world/paths.js:128`, `S/harvest.js:114` | — |

---

## Non examiné

- Le détail interne de chaque sous-objet de la vue de l'île (`sites[]`, `villagers[]`, `crafts`, `chests`, `nights`, `beasts`…) : seules les clés de premier niveau sont listées.
- Toutes les branches de refus des services du Monde : seuls les codes de statut sont relevés, pas chaque message.
- Les règles de rejeu (`S/harvest.js`, `S/minigames.js`, `S/crafts.js`, `S/avatarChoices.js`), dont les bornes de taille de `input` (mini-jeux), lues seulement en partie.
- Le comportement réel à l'exécution : aucun serveur lancé, aucune base consultée. Les statuts 400 et 413 de body-parser sont déduits, pas observés.
- La configuration réelle de production (variables d'environnement, Nginx déployé, `CORS_ORIGIN`, `TRUST_PROXY_HOPS`) : seuls les exemples du dépôt front ont été lus.
- Le schéma complet de la base (`db/`), hors `users.email`.
- Les tests des deux dépôts.
- Les composants du front qui n'appellent pas l'API, et l'usage de chaque champ de la vue par le moteur `src/world/`.
- L'historique git : la vérification porte sur l'état aux commits indiqués, pas sur les changements récents.
