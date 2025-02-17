const express = require('express');
const router = express.Router();
const transporter = require('../config/emailConfig');

router.post('/send', async (req, res) => {
    try {
        const { email, message } = req.body;
        
        // Configuration de l'email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // L'email sera envoyé à votre adresse
            subject: `Nouveau message de ${email}`,
            text: `De: ${email}\n\nMessage:\n${message}`,
            html: `
                <h3>Nouveau message de contact</h3>
                <p><strong>De:</strong> ${email}</p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
            `
        };

        // Envoi de l'email
        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'Message envoyé avec succès' });
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        res.status(500).json({ message: 'Erreur lors de l\'envoi du message' });
    }
});

module.exports = router;