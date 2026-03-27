const axios = require('axios');
const nodemailer = require('nodemailer');

const toBoolean = (value) => String(value || '').trim().toLowerCase() === 'true';

const webhookUrl = String(process.env.SECURITY_ALERT_WEBHOOK_URL || '').trim();
const mailTo = String(process.env.SECURITY_ALERT_EMAIL_TO || '').trim();
const mailFrom = String(process.env.SECURITY_ALERT_EMAIL_FROM || '').trim();

let cachedTransporter = null;

const getMailer = () => {
    if (cachedTransporter) return cachedTransporter;

    const host = String(process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT || 0);
    const user = String(process.env.SMTP_USER || '').trim();
    const pass = String(process.env.SMTP_PASS || '').trim();

    if (!host || !port || !user || !pass) {
        return null;
    }

    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
    });

    return cachedTransporter;
};

const sendWebhook = async (payload) => {
    if (!webhookUrl) return;

    try {
        await axios.post(webhookUrl, payload, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Security webhook notify error:', error.message);
    }
};

const sendEmail = async ({ subject, text, html, to }) => {
    const transporter = getMailer();
    const resolvedTo = String(to || mailTo || '').trim();

    if (!transporter || !mailFrom || !resolvedTo) return;

    try {
        await transporter.sendMail({
            from: mailFrom,
            to: resolvedTo,
            subject,
            text,
            html
        });
    } catch (error) {
        console.error('Security email notify error:', error.message);
    }
};

const notifySecurityAlert = async (payload) => {
    if (!toBoolean(process.env.SECURITY_ALERTS_ENABLED || 'false')) return;

    const safePayload = {
        type: 'security_alert',
        timestamp: new Date().toISOString(),
        ...payload
    };

    await Promise.allSettled([
        sendWebhook(safePayload),
        sendEmail({
            subject: `[Security Alert] ${payload?.title || 'Suspicious activity detected'}`,
            text: JSON.stringify(safePayload, null, 2),
            html: `<pre style="font-family:Consolas,monospace;white-space:pre-wrap;">${JSON.stringify(safePayload, null, 2)}</pre>`
        })
    ]);
};

const notifyMfaCode = async ({ to, username, code, expiresMinutes = 5 }) => {
    const trimmedCode = String(code || '').trim();
    if (!trimmedCode) return;

    const payload = {
        type: 'mfa_challenge',
        timestamp: new Date().toISOString(),
        username,
        maskedTo: to ? String(to).replace(/(^.).+(@.*$)/, '$1***$2') : '',
        expiresMinutes
    };

    await Promise.allSettled([
        sendWebhook(payload),
        sendEmail({
            to,
            subject: 'Your Super Admin MFA Code',
            text: `Your MFA code is ${trimmedCode}. It expires in ${expiresMinutes} minutes.`,
            html: `<div style="font-family:Arial,sans-serif"><p>Your MFA code is:</p><h2 style="letter-spacing:4px">${trimmedCode}</h2><p>This code expires in ${expiresMinutes} minutes.</p></div>`
        })
    ]);
};

module.exports = {
    notifySecurityAlert,
    notifyMfaCode
};
