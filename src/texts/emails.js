// Les courriels envoyés au joueur : le lien qui confirme une nouvelle adresse (services/accountSettings.js) et celui
// qui choisit un nouveau mot de passe (services/passwordReset.js). Chacun : son objet (subject) et son texte (text :
// la durée du lien en minutes, l'adresse du jeu, le jeton).

const EMAIL_CHANGE = {
    subject: 'Brumelune — confirme ta nouvelle adresse',
    text: (minutes, url, token) => `Bonjour,\n\nPour que cette adresse devienne celle de ton compte Brumelune, ouvre ce lien (valable ${minutes} minutes, une seule fois) :\n${url}/?email=${token}\n\nSi tu n'as rien demandé, ignore ce message : rien ne change.`
};

const PASSWORD_RESET = {
    subject: 'Brumelune — nouveau mot de passe',
    text: (minutes, url, token) => `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable ${minutes} minutes, une seule fois) :\n${url}/?reset=${token}\n\nSi tu n'as rien demandé, ignore ce message : ton mot de passe ne change pas.`
};

module.exports = { EMAIL_CHANGE, PASSWORD_RESET };
