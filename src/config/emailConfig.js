const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Vérifier la configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('Erreur de configuration email:', error);
    } else {
        
    }
});

module.exports = transporter;