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
const { SITES, CHAPTER_OF_LEVEL, WATER_KEY } = require('../src/services/world/rules');
const { ZONE_BY_ID } = require('../src/services/worldMap');
const crafts = require('../src/services/crafts');
const db = require('../src/config/db');

// Toute la chaîne : le tutoriel et les sept actes
const ACTS = [...new Set(QUESTS.map(q => q.act))];
// L'Athanor grandit avec l'histoire (services/world.js : ATHANOR)
const ATHANOR = [['eveil-sylve', 4], ['puits-ondin', 3]];
// Le palier I du Ponton se bâtit sans plan pendant le tutoriel (world.tutorialPonton)
const WAIVED = (site, need) => site === 'ponton' && need === 1;
// La lanterne de Rivet, au tutoriel, se fabrique sans savoir-faire (crafts.TUTORIAL_CRAFTS)
const TUTORIAL_CRAFT = (quest, craft) => quest.act === 'T' && craft === 'lanterne';

test.after(() => db.pool.end());

test('jamais d’impasse : toute la chaîne des quêtes, chaque clé dans un chapitre ouvert, chaque recette dans l’Athanor', async () => {
  const b = await recipeBook.load();
  const owned = new Set(recipeBook.BASE_ELEMENTS);
  const done = new Set();
  const chapterOf = name => bookPages.chapterOf(b.meta.get(name)?.family);
  const chapterById = id => bookPages.CHAPTERS.find(c => c.id === id);
  const stars = () => bookPages.starsOf(b, [...owned]);
  const open = id => bookPages.isOpen(chapterById(id), stars(), owned);
  const closest = names => names.filter(n => b.meta.has(n))
    .map(n => [n, bookPages.arianeOf(bookPages.withSlots(b, slots()), [...owned], [n])?.remaining ?? Infinity])
    .sort((x, y) => x[1] - y[1])[0][0];
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
    // (une bête du Bestiaire au choix : la plus proche, comme le ruban)
    if (goal.kind === 'element') write(goal.element || closest(goal.any), why);
    if (goal.kind === 'level') {
      const tier = SITES[goal.site].levels[goal.need - 1];
      const chapter = CHAPTER_OF_LEVEL[goal.need - 1];
      if (!WAIVED(goal.site, goal.need)) {
        write(tier.plan, why);
        assert.ok(open(chapter), `${why} : le palier ${goal.need} demande le chapitre ${chapter}, encore scellé`);
      }
      // (l'eau douce vient avec la clé du Puits : un palier qui en coûte arrive après elle)
      assert.ok(!tier.cost.water || owned.has(WATER_KEY), `${why} : le palier ${goal.need} coûte de l'eau, avant « ${WATER_KEY} »`);
    }
    if (goal.kind === 'craft' && !TUTORIAL_CRAFT(quest, goal.craft)) {
      const c = crafts.CRAFT_BY_ID[goal.craft];
      for (const element of c.elements || []) write(element, why);
      // (son palier ouvert sans l'Épreuve : en cascade, par les découvertes et les chapitres ouverts)
      const chapters = new Set(bookPages.CHAPTERS.filter(ch => open(ch.id)).map(ch => ch.id));
      assert.ok(crafts.tiersOpen(chapters, 0, stars()).has(c.tier), `${why} : la création « ${c.name} » est au palier ${c.tier}, encore fermé (${stars()} découvertes)`);
      assert.ok(!c.cost.water || owned.has(WATER_KEY), `${why} : la création « ${c.name} » coûte de l'eau, avant « ${WATER_KEY} »`);
    }
    if (goal.kind === 'zone') {
      const chapter = ZONE_BY_ID[goal.zone].chapter;
      assert.ok(!chapter || open(chapter), `${why} : le quartier demande le chapitre ${chapter}, encore scellé`);
    }
    done.add(quest.id);
  }
});
