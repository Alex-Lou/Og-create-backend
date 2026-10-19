const nodemailer = require('nodemailer');
const { log } = require('../utils/logger');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Sans compte d'envoi valable, le serveur tourne quand même : seuls les e-mails (contact, mot de passe oublié) échouent
transporter.verify(error => {
    if (error) log('warn', 'Envoi des e-mails indisponible', error.message);
});

module.exports = transporter;