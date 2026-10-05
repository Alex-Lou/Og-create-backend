# Passation — serveur de Brumelune

Le document complet est dans le dépôt du front : **`Alex-Lou/og-create`, fichier `PASSATION.md`**. Il couvre le jeu,
les règles de travail avec l'auteur, l'architecture, l'historique, la feuille de route et les pièges connus.
**Lisez-le en entier avant toute modification.**

## Ce qu'il faut retenir pour le serveur

- **Le serveur fait autorité sur tout** :
  - chaque action passe par une transaction qui verrouille `world_stock` (`stockOf(userId, conn, true)`) ;
  - chaque action renvoie la vue complète de l'île (`{ …, world }`).
- **Fonctions pures, testées sans base** : catalogues et règles dans `src/services/` (`worldMap`, `crafts`,
  `annexes`, `landmarks`, `finds`, `loot`, `villagers`, `visitors`, `minigames`, `harvest`).
  - `world.js` fait les transactions et la vue. Il est trop gros (≈ 1 700 lignes) et doit être découpé par domaine :
    c'est le lot « santé » de la feuille de route.
- **Base** : `db/schema.sql` est rejouable (`npm run db:setup`, lancé par le build Render). Voir `db/README.md`.
  - **Aucune suppression en base** (table, colonne, données) sans le feu vert explicite de l'auteur.
- **Ordre de fusion** : la PR serveur d'un lot est fusionnée **avant** celle du front.

## Commandes

```bash
service postgresql start          # sessions cloud : Postgres peut s'arrêter au redémarrage
export DATABASE_URL=postgres://origins:origins@localhost:5432/origins_test
export JWT_SECRET=ci-only-access-secret-not-used-in-production-0001   # secret de test, déjà public dans la CI
npm run -s db:setup && npm test   # npm test | grep -E "^# (pass|fail)|^not ok"
REGISTER_RATE_LIMIT=1000 PORT=3000 CORS_ORIGIN=http://localhost:8080 node src/server.js
```

Pour arrêter le serveur local, utiliser son PID, **jamais `pkill -f`** :
`for p in $(pgrep -x node); do if tr '\0' ' ' < /proc/$p/cmdline | grep -q "src/server.js"; then kill $p; fi; done`
