const User = require('../models/User');
const Hotel = require('../models/Hotel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const seedAdmin = require('../scripts/seedAdmin');
const { notifyMfaCode } = require('../utils/securityNotifier');
const { normalizeDbName } = require('../utils/tenantConnectionManager');
const { getClientIp, getAllowlistedIps, isAllowlistEnabled, isIpAllowed } = require('../middleware/superAdminIpGuard');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeUsername = (value = '') => String(value).trim().toLowerCase();
const MAX_LOGIN_ATTEMPTS = 5;
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const SUPER_ADMIN_MFA_ENABLED = String(process.env.SUPER_ADMIN_MFA_ENABLED || '').trim().toLowerCase() === 'true';
const SUPER_ADMIN_TOKEN_TTL = String(process.env.SUPER_ADMIN_TOKEN_TTL || '8h').trim();
const DEFAULT_TOKEN_TTL = String(process.env.DEFAULT_TOKEN_TTL || '30d').trim();
const MFA_EXPIRY_MS = 5 * 60 * 1000;
const MFA_MAX_ATTEMPTS = 5;
const pendingMfaChallenges = new Map();

const buildUniqueTenantDbName = async (hotel) => {
    const hotelName = String(hotel?.name || 'hotel').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24) || 'hotel';
    const base = normalizeDbName(`tenant_${hotelName}`) || 'tenant_hotel';
    let candidate = base;
    let counter = 1;

    while (await Hotel.exists({ dbName: candidate, _id: { $ne: hotel._id } })) {
        counter += 1;
        candidate = `${base}_${counter}`;
    }

    return candidate;
};

const generateMfaCode = () => {
    return String(Math.floor(100000 + Math.random() * 900000));
};

const createMfaChallenge = (username, code) => {
    pendingMfaChallenges.set(username, {
        code,
        expiresAt: Date.now() + MFA_EXPIRY_MS,
        attempts: 0
    });
};

const verifyMfaChallenge = (username, providedCode) => {
    const challenge = pendingMfaChallenges.get(username);
    if (!challenge) {
        return { ok: false, reason: 'missing' };
    }

    if (Date.now() > challenge.expiresAt) {
        pendingMfaChallenges.delete(username);
        return { ok: false, reason: 'expired' };
    }

    if (challenge.attempts >= MFA_MAX_ATTEMPTS) {
        pendingMfaChallenges.delete(username);
        return { ok: false, reason: 'attempts_exceeded' };
    }

    if (String(providedCode || '').trim() !== challenge.code) {
        challenge.attempts += 1;
        pendingMfaChallenges.set(username, challenge);
        return { ok: false, reason: 'invalid', remainingAttempts: Math.max(0, MFA_MAX_ATTEMPTS - challenge.attempts) };
    }

    pendingMfaChallenges.delete(username);
    return { ok: true };
};

const resolveSeedCredential = (normalizedUsername, password) => {
    const credentialRows = [
        {
            email: normalizeUsername(process.env.BIREENA_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL),
            password: process.env.BIREENA_SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD,
            role: 'super_admin',
            name: 'Super Admin'
        },
        {
            email: normalizeUsername(process.env.BIREENA_ADMIN_EMAIL || process.env.ADMIN_EMAIL),
            password: process.env.BIREENA_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD,
            role: 'admin',
            name: 'Admin User'
        },
        {
            email: normalizeUsername(process.env.BIREENA_STAFF_EMAIL),
            password: process.env.BIREENA_STAFF_PASSWORD,
            role: 'staff',
            name: 'Staff User'
        }
    ].filter((item) => item.email && item.password);

    return credentialRows.find((item) => item.email === normalizedUsername && item.password === password) || null;
};

const ensureDefaultHotel = async () => {
    let hotel = await Hotel.findOne({ name: 'Default Hotel' });
    if (hotel) return hotel;

    const now = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(now.getFullYear() + 1);

    hotel = await Hotel.create({
        name: 'Default Hotel',
        address: '123 Default Street, City',
        phone: '9876543210',
        dbName: 'tenant_default_hotel',
        subscription: {
            plan: 'premium',
            startDate: now,
            expiryDate: nextYear,
            isActive: true
        },
        isActive: true
    });

    return hotel;
};

const resolveSeededEmails = () => {
    return [
        process.env.BIREENA_SUPER_ADMIN_EMAIL,
        process.env.SUPER_ADMIN_EMAIL,
        process.env.BIREENA_ADMIN_EMAIL,
        process.env.ADMIN_EMAIL,
        process.env.BIREENA_STAFF_EMAIL
    ]
        .filter(Boolean)
        .map((email) => normalizeUsername(email));
};

const findUserForLogin = async (normalizedUsername) => {
    let user = await User.findOne({ username: normalizedUsername }).populate('hotelId');
    if (!user) {
        user = await User.findOne({ username: { $regex: `^${escapeRegex(normalizedUsername)}$`, $options: 'i' } }).populate('hotelId');
    }
    if (!user) {
        user = await User.findOne({ username: { $regex: `^\\s*${escapeRegex(normalizedUsername)}\\s*$`, $options: 'i' } }).populate('hotelId');
    }
    return user;
};

const verifyPassword = async (candidatePassword, storedPassword) => {
    if (!storedPassword) {
        return { matched: false, needsRehash: false };
    }

    try {
        const bcryptMatch = await bcrypt.compare(candidatePassword, storedPassword);
        if (bcryptMatch) {
            return { matched: true, needsRehash: false };
        }
    } catch (error) {
        // Ignore bcrypt parsing errors and fallback to legacy plain-text comparison.
    }

    // Legacy support: some old records may have plain-text passwords.
    if (candidatePassword === storedPassword) {
        return { matched: true, needsRehash: true };
    }

    return { matched: false, needsRehash: false };
};

const resetLoginSecurityState = async (user) => {
    if (user.loginAttempts > 0 || user.lockUntil) {
        user.loginAttempts = 0;
        user.lockUntil = null;
        await user.save();
    }
};

const registerFailedLoginAttempt = async (user) => {
    const nextAttempts = (user.loginAttempts || 0) + 1;

    if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.loginAttempts = 0;
        user.lockUntil = null;
        user.isActive = false;
        user.suspendedBySystem = true;
        user.suspendedAt = new Date();
        user.suspensionReason = `Account auto-suspended after ${MAX_LOGIN_ATTEMPTS} failed login attempts`;
        await user.save();

        return {
            suspended: true,
            remainingAttempts: 0
        };
    }

    user.loginAttempts = nextAttempts;
    await user.save();

    return {
        suspended: false,
        remainingAttempts: MAX_LOGIN_ATTEMPTS - nextAttempts,
        lockUntil: null
    };
};

const generateToken = (user) => {
    const tokenTtl = user?.role === 'super_admin' ? SUPER_ADMIN_TOKEN_TTL : DEFAULT_TOKEN_TTL;
    return jwt.sign(
        {
            id: user._id,
            role: user.role,
            hotelId: user.hotelId || null,
            dbName: user.dbName || null
        },
        process.env.JWT_SECRET,
        { expiresIn: tokenTtl }
    );
};

const registerUser = async (req, res) => {
    try {
        const { username, password, role, name } = req.body;
        const normalizedUsername = normalizeUsername(username);

        if (!normalizedUsername || !password || !name) {
            return res.status(400).json({ message: 'Name, email and password are required' });
        }

        if (!STRONG_PASSWORD_REGEX.test(password)) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
            });
        }

        const userExists = await User.findOne({ username: normalizedUsername });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({ username: normalizedUsername, password, role, name });

        res.status(201).json({
            _id: user._id,
            username: user.username,
            role: user.role,
            name: user.name,
            image: user.image,
            token: generateToken(user),
        });
    } catch (error) {
        console.error('[Auth] Register error:', error.message);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

const loginUser = async (req, res) => {
    try {
        const { username, password, role: intendedRole, mfaCode } = req.body;
        const normalizedUsername = normalizeUsername(username);

        if (!normalizedUsername || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        console.log(`[Auth] Login attempt: ${normalizedUsername} as ${intendedRole}`);

        // Find user in database and include hotel information
        let user = await findUserForLogin(normalizedUsername);

        if (!user && resolveSeededEmails().includes(normalizedUsername)) {
            // Self-heal: ensure seed users exist, then retry lookup once.
            await seedAdmin();
            user = await findUserForLogin(normalizedUsername);
        }

        if (!user) {
            const seedCredential = resolveSeedCredential(normalizedUsername, password);
            if (seedCredential) {
                let hotel = null;
                if (seedCredential.role !== 'super_admin') {
                    hotel = await ensureDefaultHotel();
                }

                const upsert = {
                    username: normalizedUsername,
                    name: seedCredential.name,
                    role: seedCredential.role,
                    isActive: true,
                    password: await bcrypt.hash(password, 10),
                    ...(hotel ? { hotelId: hotel._id, hotelName: hotel.name } : {})
                };

                await User.findOneAndUpdate(
                    { username: normalizedUsername },
                    { $set: upsert },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );

                user = await findUserForLogin(normalizedUsername);
            }
        }

        if (!user) {
            console.log(`[Auth] User not found: ${normalizedUsername}`);
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (!user.isActive && user.suspendedBySystem) {
            return res.status(403).json({
                message: 'Account suspended after multiple failed login attempts. Please contact super admin.',
                suspendedAt: user.suspendedAt,
                suspensionReason: user.suspensionReason || 'Too many failed login attempts'
            });
        }

        if (!user.isActive) {
            return res.status(403).json({ message: 'Account is disabled. Please contact support.' });
        }

        if (user.role === 'super_admin' && isAllowlistEnabled()) {
            const allowlist = getAllowlistedIps();
            const clientIp = getClientIp(req);

            if (allowlist.length === 0) {
                return res.status(500).json({ message: 'Super admin IP allowlist enabled but not configured.' });
            }

            if (!clientIp || !isIpAllowed(clientIp, allowlist)) {
                return res.status(403).json({ message: 'Access denied from this IP address.' });
            }
        }

        // --- ROLE RESTRICTION LOGIC ---
        const isAdminRole = ['admin', 'super_admin', 'superadmin'].includes(user.role);
        
        if (intendedRole === 'admin') {
            if (!isAdminRole) {
                console.log(`[Auth] Role restriction: Staff ${username} tried to login via Admin form`);
                return res.status(403).json({ message: 'Staff login NOT allowed here. Please use the Staff login tab.' });
            }
        } else if (intendedRole === 'staff') {
            if (isAdminRole) {
                console.log(`[Auth] Role restriction: Admin ${username} tried to login via Staff form`);
                return res.status(403).json({ message: 'Admin login NOT allowed here. Please use the Admin login tab.' });
            }
        }
        // ------------------------------

        // Compare password using bcrypt
        let { matched: isMatch, needsRehash } = await verifyPassword(password, user.password);

        if (!isMatch) {
            console.log(`[Auth] Password mismatch for: ${username}`);
            const failedAttemptState = await registerFailedLoginAttempt(user);

            if (failedAttemptState.suspended) {
                return res.status(403).json({
                    message: `Account suspended automatically after ${MAX_LOGIN_ATTEMPTS} wrong attempts. Contact super admin to reactivate.`
                });
            }

            return res.status(401).json({
                message: 'Invalid email or password',
                remainingAttempts: failedAttemptState.remainingAttempts
            });
        }

        await resetLoginSecurityState(user);

        if (needsRehash) {
            user.password = await bcrypt.hash(password, 10);
            await user.save();
            console.log(`[Auth] Password migrated to bcrypt for: ${normalizedUsername}`);
        }

        if (SUPER_ADMIN_MFA_ENABLED && user.role === 'super_admin') {
            const providedMfaCode = String(mfaCode || '').trim();
            if (!providedMfaCode) {
                const code = generateMfaCode();
                createMfaChallenge(normalizedUsername, code);
                await notifyMfaCode({
                    to: user.username,
                    username: user.name || user.username,
                    code,
                    expiresMinutes: Math.floor(MFA_EXPIRY_MS / 60000)
                });

                return res.status(202).json({
                    requiresMfa: true,
                    message: 'MFA code sent. Please provide mfaCode to complete login.'
                });
            }

            const mfaResult = verifyMfaChallenge(normalizedUsername, providedMfaCode);
            if (!mfaResult.ok) {
                const messageByReason = {
                    missing: 'MFA challenge not found. Please login again to request a new code.',
                    expired: 'MFA code expired. Please login again to request a new code.',
                    attempts_exceeded: 'MFA attempts exceeded. Please login again.',
                    invalid: `Invalid MFA code. Remaining attempts: ${mfaResult.remainingAttempts}`
                };

                return res.status(401).json({
                    requiresMfa: true,
                    message: messageByReason[mfaResult.reason] || 'Invalid MFA code'
                });
            }
        }

        // Check subscription for admin and staff (not for super_admin)
        if (user.role !== 'super_admin') {
            if (!user.hotelId) {
                console.log(`[Auth] No hotel assigned to user: ${username}`);
                return res.status(403).json({ message: 'No hotel assigned to your account. Please contact support.' });
            }

            // Fetch hotel details
            const hotel = await Hotel.findById(user.hotelId);

            if (!hotel) {
                console.log(`[Auth] Hotel not found for user: ${username}`);
                return res.status(403).json({ message: 'Hotel not found. Please contact support.' });
            }

            if (!hotel.dbName) {
                hotel.dbName = await buildUniqueTenantDbName(hotel);
                await hotel.save();
                console.log(`[Auth] Auto-initialized tenant dbName for hotel ${hotel._id}: ${hotel.dbName}`);
            }

            // Check if hotel is active
            if (!hotel.isActive) {
                console.log(`[Auth] Hotel suspended for user: ${username}`);
                return res.status(403).json({ message: 'Your hotel account has been suspended. Please contact support.' });
            }

            // Check if subscription is active
            if (!hotel.subscription.isActive) {
                console.log(`[Auth] Subscription inactive for user: ${username}`);
                return res.status(403).json({ message: 'Your subscription is inactive. Please contact support.' });
            }

            // Check if subscription has expired
            if (hotel.isSubscriptionExpired()) {
                console.log(`[Auth] Subscription expired for user: ${username}`);
                return res.status(403).json({ message: 'Your subscription has expired. Please renew to continue.' });
            }

            console.log(`[Auth] Login successful: ${username} (${user.role})`);

            return res.json({
                _id: user._id,
                username: user.username,
                role: user.role,
                name: user.name,
                image: user.image,
                hotelId: hotel._id,
                hotelName: hotel.name,
                dbName: hotel.dbName,
                permissions: user.permissions || [],
                token: generateToken({ ...user.toObject(), hotelId: hotel._id, dbName: hotel.dbName }),
            });
        }

        // For super_admin
        console.log(`[Auth] Login successful: ${username} (${user.role})`);

        res.json({
            _id: user._id,
            username: user.username,
            role: user.role,
            name: user.name,
            image: user.image,
            hotelId: user.hotelId?._id,
            hotelName: user.hotelId?.name,
            dbName: user.hotelId?.dbName || null,
            permissions: user.permissions || [],
            token: generateToken({ ...user.toObject(), hotelId: user.hotelId?._id || null, dbName: user.hotelId?.dbName || null }),
        });
    } catch (error) {
        console.error('[Auth] Login error:', error.message);
        res.status(500).json({ message: 'Server error during login' });
    }
};

module.exports = { registerUser, loginUser };
