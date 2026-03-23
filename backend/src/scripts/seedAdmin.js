const bcrypt = require('bcryptjs');
const User = require('../models/User');

const DEFAULT_TENANT_DB = 'tenant_default_hotel';
const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

/**
 * Seeds a user (admin or staff) into the database
 * - If user does not exist: creates from ENV credentials
 * - If user exists but password changed in ENV: updates the password
 */
const seedUser = async (email, password, role, name, hotelId = null) => {
    if (!email || !password) {
        return;
    }

    const normalizedEmail = normalizeEmail(email);

    try {
        let existingUser = await User.findOne({ username: normalizedEmail });
        if (!existingUser) {
            existingUser = await User.findOne({ username: { $regex: `^\\s*${normalizedEmail.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*$`, $options: 'i' } });
        }

        // Default permissions for Staff to ensure they see something
        let defaultPermissions = [];
        if (role === 'staff') {
            defaultPermissions = ['Dashboard', 'Rooms', 'Reservation', 'Food Order', 'Table View'];
        }

        if (!existingUser) {
            // User does not exist — create from ENV
            const userData = {
                username: normalizedEmail,
                password: password, // Pre-save hook will hash it
                name: name,
                role: role,
                permissions: defaultPermissions, // Assign default permissions
                isActive: true
            };

            if (hotelId) {
                userData.hotelId = hotelId;
                userData.hotelName = 'Default Hotel';
            }

            await User.create(userData);
            console.log(`[${role.toUpperCase()} Seed] User created: ${normalizedEmail}`);
        } else {
            // User exists — verify password match, update role/permissions/hotel
            const passwordMatches = await bcrypt.compare(password, existingUser.password);
            const updateData = {
                isActive: true,
                role: role, // FORCE update role to match strict seed type
                username: normalizedEmail
            };

            if (!passwordMatches) {
                updateData.password = await bcrypt.hash(password, 10);
            }

            if (hotelId) {
                updateData.hotelId = hotelId;
                updateData.hotelName = 'Default Hotel';
            }

            // Only update permissions if they are currently empty for staff
            if (role === 'staff' && (!existingUser.permissions || existingUser.permissions.length === 0)) {
                updateData.permissions = defaultPermissions;
            }

            await User.updateOne(
                { _id: existingUser._id },
                { $set: updateData }
            );
            console.log(`[${role.toUpperCase()} Seed] User verified/updated: ${normalizedEmail}`);
        }
    } catch (error) {
        console.error(`[${role.toUpperCase()} Seed] Error seeding user:`, error.message);
    }
};

/**
 * Ensures the super admin, admin and staff users always exist in the database.
 * Runs automatically on every server start.
 */
const seedAdmin = async () => {
    // Seed Super Admin User
    const superAdminEmail = process.env.BIREENA_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.BIREENA_SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;

    if (superAdminEmail && superAdminPassword) {
        await seedUser(superAdminEmail, superAdminPassword, 'super_admin', 'Super Admin');
    } else {
        console.warn('[Super Admin Seed] SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set in .env — skipping super admin seed.');
    }

    // Seed Hotel
    let hotelId = null;
    const Hotel = require('../models/Hotel');

    // Admin Credentials
    const adminEmail = process.env.BIREENA_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    const adminPassword = process.env.BIREENA_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

    if (adminEmail) {
        try {
            // Check if there is already a hotel called 'Default Hotel'
            let hotel = await Hotel.findOne({ name: 'Default Hotel' });

            if (!hotel) {
                const now = new Date();
                const nextYear = new Date();
                nextYear.setFullYear(now.getFullYear() + 1);

                hotel = await Hotel.create({
                    name: 'Default Hotel',
                    address: '123 Default Street, City',
                    phone: '9876543210',
                    dbName: DEFAULT_TENANT_DB,
                    subscription: {
                        plan: 'premium',
                        startDate: now,
                        expiryDate: nextYear,
                        isActive: true
                    },
                    isActive: true
                });
                console.log('[Hotel Seed] Default Hotel created successfully');
            } else {
                if (!hotel.dbName) {
                    hotel.dbName = DEFAULT_TENANT_DB;
                    await hotel.save();
                    console.log('[Hotel Seed] Default Hotel dbName initialized');
                }
            }
            hotelId = hotel._id;
        } catch (err) {
            console.error('[Hotel Seed] Error ensuring default hotel:', err.message);
        }
    }

    // Seed Admin User
    if (adminEmail && adminPassword) {
        await seedUser(adminEmail, adminPassword, 'admin', 'Admin User', hotelId);
    } else {
        console.warn('[Admin Seed] BIREENA_ADMIN_EMAIL or BIREENA_ADMIN_PASSWORD not set in .env — skipping admin seed.');
    }

    // Seed Staff User
    const staffEmail = process.env.BIREENA_STAFF_EMAIL;
    const staffPassword = process.env.BIREENA_STAFF_PASSWORD;

    if (staffEmail && staffPassword) {
        await seedUser(staffEmail, staffPassword, 'staff', 'Staff User', hotelId);
    } else {
        console.warn('[Staff Seed] BIREENA_STAFF_EMAIL or BIREENA_STAFF_PASSWORD not set in .env — skipping staff seed.');
    }
};

module.exports = seedAdmin;
