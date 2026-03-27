const crypto = require('crypto');

const PREFIX = 'enc:gcm:';

const getRawKey = () => {
    const envKey = String(process.env.DATA_ENCRYPTION_KEY || '').trim();
    if (envKey) {
        return envKey;
    }

    // Fallback keeps app running when dedicated key is not configured.
    const jwtSecret = String(process.env.JWT_SECRET || '').trim();
    return jwtSecret;
};

const deriveKey = () => {
    const rawKey = getRawKey();
    if (!rawKey) {
        return null;
    }

    // Supports both plain strings and hex-looking keys.
    const material = /^[0-9a-fA-F]{64}$/.test(rawKey)
        ? Buffer.from(rawKey, 'hex')
        : Buffer.from(rawKey, 'utf8');

    return crypto.createHash('sha256').update(material).digest();
};

const isEncrypted = (value) => {
    return typeof value === 'string' && value.startsWith(PREFIX);
};

const encryptText = (plainText) => {
    if (plainText === null || plainText === undefined) {
        return plainText;
    }

    const input = String(plainText);
    if (!input || isEncrypted(input)) {
        return input;
    }

    const key = deriveKey();
    if (!key) {
        return input;
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(input, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
    return `${PREFIX}${payload}`;
};

const decryptText = (cipherText) => {
    if (cipherText === null || cipherText === undefined) {
        return cipherText;
    }

    const input = String(cipherText);
    if (!isEncrypted(input)) {
        return input;
    }

    const key = deriveKey();
    if (!key) {
        return input;
    }

    try {
        const payload = Buffer.from(input.slice(PREFIX.length), 'base64');
        const iv = payload.subarray(0, 12);
        const tag = payload.subarray(12, 28);
        const encrypted = payload.subarray(28);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (error) {
        // If decryption fails (e.g., key rotation), return original value to avoid runtime crashes.
        return input;
    }
};

module.exports = {
    encryptText,
    decryptText,
    isEncrypted
};
