// Les textes du serveur rangés à part (src/texts/) : chaque quête a son titre et ce qu'en dit Brume, chaque ancienne
// quête à coffre son titre
const test = require('node:test');
const assert = require('node:assert/strict');
const quests = require('../src/services/quests');
const { QUEST_TEXTS } = require('../src/texts/quests');

const real = text => typeof text === 'string' && text.trim().length > 3;

test('chaque quête a son titre et sa réplique de Brume ; aucun texte orphelin', () => {
    for (const quest of quests.QUESTS) assert.ok(real(quest.label) && real(quest.say), quest.id);
    assert.deepEqual(Object.keys(QUEST_TEXTS).sort(), quests.QUESTS.map(q => q.id).sort());
});

test('chaque quête à coffre, nouvelle ou ancienne, a son titre', () => {
    for (const chest of quests.QUEST_CHESTS) assert.ok(real(chest.label), chest.id);
});
