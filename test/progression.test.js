// Jamais d'impasse (choix de l'auteur, 12 oct. : le Grimoire, clé de l'île) : on rejoue la chaîne des quêtes comme un
// joueur qui suit le ruban, page après page. À chaque étape, la clé demandée (l'élément d'une quête, le plan d'un
// palier, les savoir-faire d'une création) est dans un chapitre ouvert, ou c'est la page-sceau de son chapitre ; chaque
// page écrite tient dans l'Athanor du moment (ses emplacements grandissent avec l'histoire) ; le palier demandé et le
// quartier à acheter ont leur chapitre ouvert. Le livre est celui de la base de test (db:setup).
const test = require('node:test');
const assert = require('node:assert/strict');
const recipeBook = require('../src/services/recipeBook');
const bookPages = require('../src/services/bookPages');
const { QUESTS } = require('../src/services/quests');
const { SITES, CHAPTER_OF_LEVEL } = require('../src/services/world/rules');
const { ZONE_BY_ID } = require('../src/services/worldMap');
const crafts = require('../src/services/crafts');
const db = require('../src/config/db');

// Les actes vérifiés (les autres suivent au lot 4, avec le reste des clés)
const ACTS = ['T', 'I', 'II'];
// L'Athanor grandit avec l'histoire (services/world.js : ATHANOR)
const ATHANOR = [['eveil-sylve', 4], ['puits-ondin', 3]];
// Le palier I du Ponton se bâtit sans plan pendant le tutoriel (world.tutorialPonton)
const WAIVED = (site, need) => site === 'ponton' && need === 1;
// La lanterne de Rivet, au tutoriel, se fabrique sans savoir-faire (crafts.TUTORIAL_CRAFTS)
const TUTORIAL_CRAFT = (quest, craft) => quest.act === 'T' && craft === 'lanterne';

test.after(() => db.pool.end());

test('jamais d’impasse : tutoriel et actes I et II, chaque clé dans un chapitre ouvert, chaque recette dans l’Athanor', async () => {
  const b = await recipeBook.load();
  const owned = new Set(recipeBook.BASE_ELEMENTS);
  const done = new Set();
  const chapterOf = name => bookPages.chapterOf(b.meta.get(name)?.family);
  const chapterById = id => bookPages.CHAPTERS.find(c => c.id === id);
  const stars = () => bookPages.starsOf(b, [...owned]);
  const open = id => bookPages.isOpen(chapterById(id), stars(), owned);
  const slots = () => {
    const story = (ATHANOR.find(([id]) => done.has(id)) || [null, 2])[1];
    return bookPages.slotsFor(bookPages.withSlots(b, story), [...owned]);
  };
  // Écrire une clé en suivant le ruban : chaque page tient dans l'Athanor, la clé est dans un chapitre ouvert (ou c'est
  // le sceau de son chapitre)
  const write = (key, why) => {
    assert.ok(b.meta.has(key), `${why} : « ${key} » n'est pas dans le livre`);
    for (let guard = 0; !owned.has(key) && guard < 60; guard++) {
      const n = slots();
      const ariane = bookPages.arianeOf(bookPages.withSlots(b, n), [...owned], [key]);
      assert.ok(ariane, `${why} : pas de chemin vers « ${key} »`);
      const page = ariane.next;
      const fits = b.entries.some(([parts, result]) => result === page && parts.length <= n && parts.every(p => owned.has(p)));
      assert.ok(fits, `${why} : la page « ${page} » ne tient pas dans un Athanor à ${n} emplacements`);
      if (page === key) {
        const chapter = chapterOf(key);
        assert.ok(open(chapter.id) || chapter.seal === key, `${why} : « ${key} » est au chapitre ${chapter.id}, encore scellé (${stars()} découvertes)`);
      }
      owned.add(page);
    }
    assert.ok(owned.has(key), `${why} : « ${key} » jamais écrit`);
  };
  for (const quest of QUESTS.filter(q => ACTS.includes(q.act))) {
    const { goal } = quest;
    const why = `quête ${quest.id} (acte ${quest.act})`;
    if (goal.kind === 'element') write(goal.element, why);
    if (goal.kind === 'level') {
      const tier = SITES[goal.site].levels[goal.need - 1];
      const chapter = CHAPTER_OF_LEVEL[goal.need - 1];
      if (!WAIVED(goal.site, goal.need)) {
        write(tier.plan, why);
        assert.ok(open(chapter), `${why} : le palier ${goal.need} demande le chapitre ${chapter}, encore scellé`);
      }
    }
    if (goal.kind === 'craft' && !TUTORIAL_CRAFT(quest, goal.craft)) {
      for (const element of crafts.CRAFT_BY_ID[goal.craft].elements || []) write(element, why);
    }
    if (goal.kind === 'zone') {
      const chapter = ZONE_BY_ID[goal.zone].chapter;
      assert.ok(!chapter || open(chapter), `${why} : le quartier demande le chapitre ${chapter}, encore scellé`);
    }
    done.add(quest.id);
  }
});
