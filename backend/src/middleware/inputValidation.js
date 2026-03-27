const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s-]{10,15}$/;

const SUSPICIOUS_PATTERNS = [
    /(?:'|%27)\s*(?:or|and)\s+[^\n]*?=/i,
    /\b(?:or|and)\b\s+\d+\s*=\s*\d+/i,
    /\bunion\b\s+\bselect\b/i,
    /\bdrop\s+table\b/i,
    /\binsert\s+into\b/i,
    /\bdelete\s+from\b/i,
    /\bupdate\s+\w+\s+set\b/i,
    /<\s*script\b/i,
    /javascript\s*:/i,
    /on\w+\s*=/i,
    /<\s*\/?\s*iframe\b/i
];

const shouldValidateEmail = (fieldName) => /email/i.test(fieldName);
const shouldValidatePhone = (fieldName) => /(phone|mobile|contact)/i.test(fieldName);
const isPasswordField = (fieldName) => /password/i.test(fieldName);

const hasSuspiciousPayload = (value) => {
    if (typeof value !== 'string') return false;
    const normalized = value.trim();
    if (!normalized) return false;
    return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(normalized));
};

const walkAndValidate = (source, pathPrefix = '') => {
    if (source === null || source === undefined) return null;

    if (typeof source === 'string') {
        if (hasSuspiciousPayload(source)) {
            return {
                field: pathPrefix || 'value',
                reason: 'Potentially malicious payload detected'
            };
        }
        return null;
    }

    if (Array.isArray(source)) {
        for (let index = 0; index < source.length; index += 1) {
            const childError = walkAndValidate(source[index], `${pathPrefix}[${index}]`);
            if (childError) return childError;
        }
        return null;
    }

    if (typeof source === 'object') {
        const entries = Object.entries(source);
        for (const [key, value] of entries) {
            const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;

            if (typeof value === 'string') {
                if (isPasswordField(key) || key === 'image') {
                    continue;
                }

                const trimmed = value.trim();

                if (hasSuspiciousPayload(trimmed)) {
                    return {
                        field: nextPath,
                        reason: 'Potentially malicious payload detected'
                    };
                }

                if (trimmed) {
                    if (shouldValidateEmail(key) && !EMAIL_REGEX.test(trimmed)) {
                        return {
                            field: nextPath,
                            reason: 'Invalid email format'
                        };
                    }

                    if (shouldValidatePhone(key) && !PHONE_REGEX.test(trimmed)) {
                        return {
                            field: nextPath,
                            reason: 'Invalid phone number format'
                        };
                    }
                }

                source[key] = trimmed;
            } else {
                const childError = walkAndValidate(value, nextPath);
                if (childError) return childError;
            }
        }
    }

    return null;
};

const validateRequestInput = (req, res, next) => {
    const sections = [
        { label: 'body', value: req.body },
        { label: 'query', value: req.query },
        { label: 'params', value: req.params }
    ];

    for (const section of sections) {
        const result = walkAndValidate(section.value, section.label);
        if (result) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input detected',
                field: result.field,
                reason: result.reason
            });
        }
    }

    return next();
};

module.exports = {
    validateRequestInput
};
