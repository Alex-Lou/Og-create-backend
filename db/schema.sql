-- =====================================================================
-- Origins Creation - schéma PostgreSQL reconstruit depuis le code (src/**)
-- Idempotent : peut être rejoué sans erreur (CREATE ... IF NOT EXISTS).
--
-- Conventions déduites du code :
--   * colonnes passées via JSON.stringify(...)  -> JSONB
--   * colonnes passées comme tableau JS brut    -> TEXT[]
--     (progress.discovered_categories, explorer_regions.required_elements /
--      unlocked_elements, user_regions.required_elements)
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
-- Refresh tokens (routes/auth.js, routes/contactRoutes.js)
-- Pas de UNIQUE sur token : deux JWT signés dans la même seconde avec le
-- même payload sont identiques.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token   ON refresh_tokens (token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);

-- ---------------------------------------------------------------------
-- Progression (services/progressService.js, services/achievementService.js,
-- routes/progressCoins.js, routes/timerServiceBack.js, routes/explorer.js,
-- routes/customization.js)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS progress (
    id                     SERIAL PRIMARY KEY,
    user_id                INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- éléments découverts par mode de jeu : tableaux JSON de noms
    infinite_elements      JSONB   NOT NULL DEFAULT '["Eau","Feu","Terre","Air"]'::jsonb,
    timer_elements         JSONB   NOT NULL DEFAULT '[]'::jsonb,
    explorer_elements      JSONB   NOT NULL DEFAULT '[]'::jsonb,

    discovered_categories  TEXT[]  NOT NULL DEFAULT ARRAY['Elements Fondamentaux']::TEXT[],
    -- { "<nom achievement>": { "unlocked": bool, "unlockedAt": iso|null } }
    achievements           JSONB   NOT NULL DEFAULT '{}'::jsonb,
    -- { "<catégorie>": pourcentage }
    category_progress      JSONB   NOT NULL DEFAULT '{"Elements Fondamentaux":100}'::jsonb,
    coins                  INTEGER NOT NULL DEFAULT 0,
    -- { completedQuestions:{niveau:{catégorie:[ids]}}, unlockedCategories:{niveau:[catégories]}, bestScores:{Facile,Moyen,Difficile} }
    timer_progress         JSONB   NOT NULL DEFAULT '{"completedQuestions":{},"unlockedCategories":{},"bestScores":{"Facile":0,"Moyen":0,"Difficile":0}}'::jsonb,

    -- mode Explorer
    explorer_energy        INTEGER     NOT NULL DEFAULT 10,
    last_energy_update     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    max_energy             INTEGER     NOT NULL DEFAULT 20,

    -- { "selectedFrame": "basicCadre.png", "selectedAvatar": "coin.png" } (NULL => valeurs par défaut côté route)
    user_customization     JSONB,

    last_saved             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Données de jeu (routes/gameDataController.js)
-- La route fusionne { ...elements, ...rules, ...metadata } : chaque colonne
-- contient donc un OBJET dont les clés deviennent des clés de premier niveau
-- de la réponse, p.ex. elements = {"elements": {"<Catégorie>": {"<Nom>": "<emoji>"}}}
-- et rules = {"rules": {"A+B": "Résultat"}}.
-- Recherche : LOWER(REPLACE(name,' ','_')) = nom normalisé ([^a-z0-9] -> _),
-- donc name doit être en ASCII minuscule (pas d'accents).
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
-- Questions du mode Timer (routes/gameDataController.js, routes/timerServiceBack.js)
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

CREATE TABLE IF NOT EXISTS user_items (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id       INTEGER NOT NULL REFERENCES customization_items(id) ON DELETE CASCADE,
    purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_items UNIQUE (user_id, item_id)
);

-- ---------------------------------------------------------------------
-- Mode Explorer (initRegions.js, routes/explorer.js)
-- Les ids sont fournis explicitement par regionChallenges.json.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS explorer_regions (
    id                 INTEGER PRIMARY KEY,
    name               VARCHAR(150) NOT NULL,
    description        TEXT         NOT NULL DEFAULT '',
    image_path         VARCHAR(255),
    is_default         BOOLEAN      NOT NULL DEFAULT FALSE,
    required_level     INTEGER      NOT NULL DEFAULT 1,
    parent_region_id   INTEGER      REFERENCES explorer_regions(id) ON DELETE SET NULL,
    required_elements  TEXT[]       NOT NULL DEFAULT '{}',
    unlocked_elements  TEXT[]       NOT NULL DEFAULT '{}',
    position_x         INTEGER      NOT NULL DEFAULT 50,
    position_y         INTEGER      NOT NULL DEFAULT 50,
    is_boss            BOOLEAN      NOT NULL DEFAULT FALSE,
    energy_cost        INTEGER      NOT NULL DEFAULT 2,
    energy_reward      INTEGER      NOT NULL DEFAULT 5,
    map_id             INTEGER      NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_explorer_regions_parent ON explorer_regions (parent_region_id);
CREATE INDEX IF NOT EXISTS idx_explorer_regions_map    ON explorer_regions (map_id);

CREATE TABLE IF NOT EXISTS user_regions (
    id                 SERIAL PRIMARY KEY,
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    region_id          INTEGER NOT NULL REFERENCES explorer_regions(id) ON DELETE CASCADE,
    visited            BOOLEAN NOT NULL DEFAULT FALSE,
    completed          BOOLEAN NOT NULL DEFAULT FALSE,
    progress           INTEGER NOT NULL DEFAULT 0,
    -- éléments découverts par l'utilisateur dans cette région
    required_elements  TEXT[]  NOT NULL DEFAULT '{}',
    is_boss            BOOLEAN NOT NULL DEFAULT FALSE,
    boss_defeated      BOOLEAN NOT NULL DEFAULT FALSE,
    last_visited       TIMESTAMPTZ,
    CONSTRAINT uq_user_regions UNIQUE (user_id, region_id)
);

-- ---------------------------------------------------------------------
-- Paramètres globaux (routes/explorer.js : setting_name = 'max_energy')
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_settings (
    id            SERIAL PRIMARY KEY,
    setting_name  VARCHAR(100) NOT NULL UNIQUE,
    value         TEXT         NOT NULL,
    description   TEXT
);
