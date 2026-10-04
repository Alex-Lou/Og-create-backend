// Formulaire « Écrire aux créateurs » : le message part par e-mail vers l'adresse du jeu.
const express = require('express');
const transporter = require('../config/emailConfig');
const { limiter } = require('../middleware/rateLimit');
const { log } = require('../utils/logger');

const router = express.Router();

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const MAX_MESSAGE = 5000;

// Chaque message part par e-mail : quelques envois par adresse IP et par heure suffisent
const contactLimiter = limiter({ minutes: 60, max: 5, message: 'Trop de messages, réessaie plus tard.' });

// Le message de l'expéditeur est affiché tel quel, jamais interprété comme du HTML
const escapeHtml = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

router.post('/send', contactLimiter, async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!EMAIL.test(email) || email.length > 255) {
        return res.status(400).json({ message: 'Adresse e-mail invalide' });
    }
    if (!message || message.length > MAX_MESSAGE) {
        return res.status(400).json({ message: `Le message doit faire entre 1 et ${MAX_MESSAGE} caractères` });
    }

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            replyTo: email,
            subject: 'Origins — nouveau message de contact',
            text: `De : ${email}\n\n${message}`,
            html: `<h3>Nouveau message de contact</h3>
<p><strong>De :</strong> ${escapeHtml(email)}</p>
<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`
        });
        res.status(200).json({ message: 'Message envoyé avec succès' });
    } catch (error) {
        log('error', 'Envoi du message de contact', { errorMessage: error.message });
        res.status(500).json({ message: 'Erreur lors de l\'envoi du message' });
    }
});

module.exports = router;
