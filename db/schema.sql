-- =====================================================================
-- Origins Creation - schéma PostgreSQL reconstruit depuis le code (src/**)
-- Idempotent : peut être rejoué sans erreur (CREATE ... IF NOT EXISTS).
--
-- Conventions déduites du code :
--   * colonnes passées via JSON.stringify(...)  -> JSONB
--   * progress est une ligne par utilisateur (user_id UNIQUE) ; plusieurs
--     routes y font des INSERT partiels, d'où des DEFAULT sur toutes les
--     colonnes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Comptes utilisateurs (routes/auth.js)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    username       VARCHAR(100) NOT NULL UNIQUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Ancienne table des jetons de rafraîchissement, remplacée par auth_sessions
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS refresh_tokens;

-- ---------------------------------------------------------------------
-- Sessions (services/authSession.js) : empreinte SHA-256 du jeton de
-- rafraîchissement, changé à chaque usage. Une famille = une connexion ;
-- un jeton remplacé qui revient fait révoquer toute la famille.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_sessions (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family      UUID         NOT NULL,
    token_hash  CHAR(64)     NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_family ON auth_sessions (family);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user   ON auth_sessions (user_id);

-- ---------------------------------------------------------------------
-- Carnet d'un joueur sans compte (services/players.js) : cookie oc_guest, dont
-- seule l'empreinte SHA-256 est gardée. Effacé après 30 jours sans jouer.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guest_players (
    id          SERIAL PRIMARY KEY,
    token_hash  CHAR(64)    NOT NULL UNIQUE,
    elements    JSONB       NOT NULL DEFAULT '["Eau","Feu","Terre","Air"]'::jsonb,
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guest_players_last_seen ON guest_players (last_seen);

-- ---------------------------------------------------------------------
-- Partie en cours de l'Épreuve (services/trial.js) : les
-- éléments en main, une par joueur et par mode. owner = 'u:<id>' | 'g:<id>'.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS play_runs (
    owner        TEXT        NOT NULL,
    mode         TEXT        NOT NULL CHECK (mode IN ('timer', 'explorer')),
    context      TEXT        NOT NULL,
    inventory    JSONB       NOT NULL,
    free_jokers  INTEGER     NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner, mode)
);
-- Épreuve (services/trial.js) : chrono, réussites et score tenus par le serveur
ALTER TABLE play_runs ADD COLUMN IF NOT EXISTS level      TEXT;
ALTER TABLE play_runs ADD COLUMN IF NOT EXISTS category   TEXT;
ALTER TABLE play_runs ADD COLUMN IF NOT EXISTS deadline   TIMESTAMPTZ;
ALTER TABLE play_runs ADD COLUMN IF NOT EXISTS paused_at  TIMESTAMPTZ;
ALTER TABLE play_runs ADD COLUMN IF NOT EXISTS solved     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE play_runs ADD COLUMN IF NOT EXISTS solved_ids JSONB   NOT NULL DEFAULT '[]'::jsonb;
-- Ancienne Expédition (retirée) : ses colonnes sont supprimées
ALTER TABLE play_runs DROP COLUMN IF EXISTS boss_hp;
ALTER TABLE play_runs DROP COLUMN IF EXISTS player_hp;

-- ---------------------------------------------------------------------
-- Mot de passe oublié (routes/passwordReset.js) : empreinte SHA-256 du
-- jeton envoyé par e-mail, un seul lien actif par compte, 30 minutes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  CHAR(64)    NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets (user_id);

-- ---------------------------------------------------------------------
-- Progression (services/progress.js, players.js, ledger.js, timerProgress.js,
-- achievementService.js, customization.js)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS progress (
    id                     SERIAL PRIMARY KEY,
    user_id                INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- éléments découverts : tableau JSON de noms
    infinite_elements      JSONB   NOT NULL DEFAULT '["Eau","Feu","Terre","Air"]'::jsonb,
    -- { "<nom achievement>": { "unlocked": bool, "unlockedAt": iso|null } }
    achievements           JSONB   NOT NULL DEFAULT '{}'::jsonb,
    coins                  INTEGER NOT NULL DEFAULT 0,
    -- { completedQuestions:{niveau:{catégorie:[ids]}}, unlockedCategories:{niveau:[catégories]} }
    -- (son ancien champ bestScores n'est plus lu : les records viennent de coin_ledger, 'timer-record')
    timer_progress         JSONB   NOT NULL DEFAULT '{"completedQuestions":{},"unlockedCategories":{},"bestScores":{"Facile":0,"Moyen":0,"Difficile":0}}'::jsonb,

    -- { "selectedFrame": "basicCadre.png", "selectedAvatar": "coin.png" } (NULL => valeurs par défaut côté route)
    user_customization     JSONB,

    last_saved             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Données de jeu, lues une fois par le Livre des recettes (services/recipeBook.js) :
-- elements = {"elements": {"<Famille>": {"<Nom>": "<emoji>"}}}, rules = {"rules": {"A+B": "Résultat"}}.
-- Elles ne quittent jamais le serveur.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_data (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    elements    JSONB,
    rules       JSONB,
    metadata    JSONB,
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Questions de l'Épreuve (services/timerQuestions.js, services/trial.js)
--   level            : 'Facile' | 'Moyen' | 'Difficile'
--   valid_answers    : ["Nom", ...]
--   initial_elements : {"validationMode":"any"|"multiple"|"all","requiredCount":n?,
--                       "required":[...],"additional":[...],"recipes":{"Résultat":"A+B"}?}
--   elements_emojis  : {"Nom":"emoji"}
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timer_questions (
    id                SERIAL PRIMARY KEY,
    level             VARCHAR(20)  NOT NULL,
    timer             INTEGER      NOT NULL DEFAULT 300,
    category          VARCHAR(100) NOT NULL,
    question_text     TEXT         NOT NULL,
    valid_answers     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    points            INTEGER      NOT NULL DEFAULT 10,
    initial_elements  JSONB        NOT NULL DEFAULT '{"validationMode":"any","required":[],"additional":[]}'::jsonb,
    elements_emojis   JSONB        NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uq_timer_questions UNIQUE (level, category, question_text)
);
CREATE INDEX IF NOT EXISTS idx_timer_questions_level_category ON timer_questions (level, category);

-- ---------------------------------------------------------------------
-- Catalogue des succès (services/achievementService.js)
--   condition : expression JS évaluée côté front/back, p.ex.
--     this.discoveredElements.includes('Vie')
--     this.discoveredElements.length >= 10
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achievements_list (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(150) NOT NULL UNIQUE,
    description  TEXT,
    unlocked     BOOLEAN NOT NULL DEFAULT FALSE,
    condition    TEXT    NOT NULL,
    image        VARCHAR(255)
);

-- ---------------------------------------------------------------------
-- Boutique de personnalisation (routes/customization.js)
--   type       : 'frame' | 'avatar'
--   image_path : nom de fichier dans front src/assets/Svgs/
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customization_items (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    type        VARCHAR(20)  NOT NULL CHECK (type IN ('frame', 'avatar')),
    image_path  VARCHAR(255) NOT NULL UNIQUE,
    price       INTEGER      NOT NULL DEFAULT 0 CHECK (price >= 0),
    is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- Pièce méritée : nom du succès qui la débloque (NULL = s'achète en écus)
ALTER TABLE customization_items ADD COLUMN IF NOT EXISTS achievement VARCHAR(150);

CREATE TABLE IF NOT EXISTS user_items (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id       INTEGER NOT NULL REFERENCES customization_items(id) ON DELETE CASCADE,
    purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_items UNIQUE (user_id, item_id)
);

-- ---------------------------------------------------------------------
-- Ancien mode Explorer et ancienne Expédition (retirés) : tables et colonnes supprimées
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS user_regions;
DROP TABLE IF EXISTS explorer_regions;
DROP TABLE IF EXISTS game_settings;
-- Garde-fou de l'ancien solde d'énergie, remplacé plus bas par chk_progress_coins
ALTER TABLE progress DROP CONSTRAINT IF EXISTS chk_progress_non_negative;
ALTER TABLE progress
    DROP COLUMN IF EXISTS timer_elements,
    DROP COLUMN IF EXISTS explorer_elements,
    DROP COLUMN IF EXISTS discovered_categories,
    DROP COLUMN IF EXISTS category_progress,
    DROP COLUMN IF EXISTS explorer_energy,
    DROP COLUMN IF EXISTS last_energy_update,
    DROP COLUMN IF EXISTS max_energy;

-- ---------------------------------------------------------------------
-- Grand livre des écus (src/services/ledger.js) : seul le serveur fait
-- varier progress.coins ; chaque mouvement est inscrit ici. Un gain porte
-- une référence (question, région, record) : unique, il n'est versé qu'une fois.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coin_ledger (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount      INTEGER      NOT NULL,
    reason      VARCHAR(40)  NOT NULL,
    ref         VARCHAR(100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_coin_ledger_claim UNIQUE (user_id, reason, ref)
);
CREATE INDEX IF NOT EXISTS idx_coin_ledger_user ON coin_ledger (user_id, created_at);

-- ---------------------------------------------------------------------
-- Le Monde (services/world.js) : objets posés sur l'île du joueur.
-- Un élément n'est posé qu'une fois ; une case ne porte qu'un objet.
-- world_collected_at : dernière récolte des écus produits par l'île.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS world_tiles (
    user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    x          SMALLINT     NOT NULL CHECK (x >= 0),
    y          SMALLINT     NOT NULL CHECK (y >= 0),
    element    VARCHAR(100) NOT NULL,
    placed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, x, y),
    CONSTRAINT uq_world_tiles_element UNIQUE (user_id, element)
);
ALTER TABLE progress ADD COLUMN IF NOT EXISTS world_collected_at TIMESTAMPTZ;

-- Le Monde v2 : stock de ressources et parties de Récolte, chantiers construits, parties jouées
CREATE TABLE IF NOT EXISTS world_stock (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    stone INTEGER NOT NULL DEFAULT 0 CHECK (stone >= 0),
    wood INTEGER NOT NULL DEFAULT 0 CHECK (wood >= 0),
    water INTEGER NOT NULL DEFAULT 0 CHECK (water >= 0),
    food INTEGER NOT NULL DEFAULT 0 CHECK (food >= 0),
    charges SMALLINT NOT NULL DEFAULT 3 CHECK (charges >= 0),
    charges_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    collected_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS world_buildings (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site VARCHAR(20) NOT NULL,
    level SMALLINT NOT NULL CHECK (level > 0),
    built_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, site)
);
CREATE TABLE IF NOT EXISTS world_runs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seed INTEGER NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_world_runs_user ON world_runs (user_id, created_at);

-- Le Livre : mélanges ratés sur une page à portée (l'encre de la page devient offerte après quelques essais différents)
CREATE TABLE IF NOT EXISTS book_tries (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page_id VARCHAR(32) NOT NULL,
    combo VARCHAR(255) NOT NULL,
    tried_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, page_id, combo)
);

-- Garde-fou : pas de solde négatif (NOT VALID : contrôle les écritures futures sans bloquer sur l'existant)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_progress_coins') THEN
    ALTER TABLE progress ADD CONSTRAINT chk_progress_coins CHECK (coins >= 0) NOT VALID;
  END IF;
END $$;
