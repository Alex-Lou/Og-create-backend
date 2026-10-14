// Les mots de Brume et d'Anya hors des quêtes : le Savoir que Brume souffle après le Phare (services/world/anyaBrume.js,
// routes/play/world.js), la Révélation et le Souffle d'Anya (services/world/anyaBrume.js), et ce que dit Brume quand
// toutes les quêtes sont faites (RESTED : services/quests.js). Les répliques des quêtes : texts/quests.js.

const SAVOIR_LOCKED = 'Brume garde son Savoir pour la fin : allume d’abord le Phare.';
const SAVOIR_GIVEN = 'Brume t’a déjà soufflé un Savoir aujourd’hui.';

const ANYA_ASLEEP_HEART = 'Anya dort encore : libère d’abord le cœur de l’île.';
const BREATH_REFUSED = {
    asleep: 'Anya dort encore.',
    away: 'Anya n’est pas là : elle passe à l’aube ou au crépuscule, certains jours.',
    breathed: 'Anya t’a déjà soufflé un Savoir : elle repassera.'
};

const RESTED = 'La brume s’est levée sur toute l’île. Merci, alchimiste : elle est de nouveau vivante.';

module.exports = { SAVOIR_LOCKED, SAVOIR_GIVEN, ANYA_ASLEEP_HEART, BREATH_REFUSED, RESTED };
