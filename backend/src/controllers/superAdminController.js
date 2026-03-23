const Hotel = require('../models/Hotel');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');
const { getTenantConnection, normalizeDbName } = require('../utils/tenantConnectionManager');

const slugifyForDb = (value) => {
    return String(value || 'hotel')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24) || 'hotel';
};

const generateTenantDbName = async (hotelName) => {
    const base = normalizeDbName(`tenant_${slugifyForDb(hotelName)}`) || 'tenant_hotel';
    let candidate = base;
    let counter = 1;

    while (await Hotel.exists({ dbName: candidate })) {
        counter += 1;
        candidate = `${base}_${counter}`;
    }

    return candidate;
};

// @desc    Get dashboard statistics
// @route   GET /api/super-admin/dashboard
// @access  Private (Super Admin only)
const getDashboardStats = async (req, res) => {
    try {
        const totalHotels = await Hotel.countDocuments();
        const activeHotels = await Hotel.countDocuments({ 
            isActive: true, 
            'subscription.isActive': true 
        });
        const suspendedHotels = await Hotel.countDocuments({ 
            $or: [
                { isActive: false },
                { 'subscription.isActive': false }
            ]
        });
        
        // Get hotels expiring within 7 days
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        const now = new Date();
        
        const expiringSoon = await Hotel.countDocuments({
            'subscription.expiryDate': {
                $gte: now,
                $lte: sevenDaysFromNow
            },
            'subscription.isActive': true
        });

        res.status(200).json({
            totalHotels,
            activeHotels,
            suspended: suspendedHotels,
            expiringSoon
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ 
            message: 'Error fetching dashboard statistics', 
            error: error.message 
        });
    }
};

// @desc    Get all hotels with filters
// @route   GET /api/super-admin/hotels
// @access  Private (Super Admin only)
const getAllHotels = async (req, res) => {
    try {
        const { search, status } = req.query;
        
        let query = {};
        
        // Search filter
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        
        // Status filter
        if (status === 'active') {
            query.isActive = true;
            query['subscription.isActive'] = true;
        } else if (status === 'suspended') {
            query.isActive = false;
        }
        
        const hotels = await Hotel.find(query)
            .populate('adminId', 'name email phone permissions')
            .sort({ createdAt: -1 });
        
        res.status(200).json(hotels);
    } catch (error) {
        console.error('Error fetching hotels:', error);
        res.status(500).json({ 
            message: 'Error fetching hotels', 
            error: error.message 
        });
    }
};

// @desc    Get single hotel details
// @route   GET /api/super-admin/hotel/:id
// @access  Private (Super Admin only)
const getHotelById = async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id)
            .populate('adminId', 'name email phone permissions');
        
        if (!hotel) {
            return res.status(404).json({ message: 'Hotel not found' });
        }
        
        res.status(200).json(hotel);
    } catch (error) {
        console.error('Error fetching hotel:', error);
        res.status(500).json({ 
            message: 'Error fetching hotel details', 
            error: error.message 
        });
    }
};

// @desc    Create new hotel with admin
// @route   POST /api/super-admin/create-hotel
// @access  Private (Super Admin only)
const createHotel = async (req, res) => {
    try {
        const {
            hotelName,
            address,
            gstNumber,
            phone,
            subscriptionPlan,
            subscriptionDuration,
            adminName,
            adminEmail,
            adminPassword,
            adminPhone,
            adminPermissions
        } = req.body;

        // Validation
        if (!hotelName || !address || !subscriptionPlan || !subscriptionDuration || 
            !adminName || !adminEmail || !adminPassword) {
            return res.status(400).json({ 
                message: 'Please provide all required fields' 
            });
        }

        // Check if admin email already exists
        const existingUser = await User.findOne({ username: adminEmail });
        if (existingUser) {
            return res.status(400).json({ 
                message: 'Admin email already exists' 
            });
        }

        // Calculate subscription dates
        const startDate = new Date();
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + parseInt(subscriptionDuration));

        const sanitizedAdminPermissions = Array.isArray(adminPermissions)
            ? [...new Set(adminPermissions
                .filter((item) => typeof item === 'string')
                .map((item) => item.trim())
                .filter(Boolean))]
            : [];

        if (sanitizedAdminPermissions.length === 0) {
            return res.status(400).json({
                message: 'Please select at least one admin screen role'
            });
        }

        // Create hotel
        const dbName = await generateTenantDbName(hotelName);
        const hotel = await Hotel.create({
            name: hotelName,
            address,
            gstNumber,
            phone,
            dbName,
            isActive: true,
            subscription: {
                plan: subscriptionPlan,
                startDate,
                expiryDate,
                isActive: true
            }
        });

        // Create admin user (password will be hashed by pre-save hook)
        const admin = await User.create({
            name: adminName,
            username: adminEmail, // Using adminEmail as username
            password: adminPassword, // Will be hashed automatically by the User model's pre-save hook
            phone: adminPhone,
            role: 'admin',
            hotelId: hotel._id,
            permissions: sanitizedAdminPermissions
        });

        // Update hotel with adminId
        hotel.adminId = admin._id;
        await hotel.save();

        // Ensure tenant database exists and is warm in connection cache.
        getTenantConnection(dbName);

        res.status(201).json({
            message: 'Hotel and admin created successfully',
            hotel: {
                id: hotel._id,
                name: hotel.name,
                dbName: hotel.dbName,
                subscription: hotel.subscription
            },
            admin: {
                id: admin._id,
                name: admin.name,
                username: admin.username,
                permissions: admin.permissions
            }
        });
    } catch (error) {
        console.error('Error creating hotel:', error);
        res.status(500).json({ 
            message: 'Error creating hotel', 
            error: error.message 
        });
    }
};

// @desc    Update hotel admin permissions
// @route   PATCH /api/super-admin/hotel/:id/admin-permissions
// @access  Private (Super Admin only)
const updateHotelAdminPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ message: 'Permissions must be an array' });
        }

        const sanitizedPermissions = [...new Set(permissions
            .filter((item) => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean))];

        if (sanitizedPermissions.length === 0) {
            return res.status(400).json({ message: 'Please select at least one permission' });
        }

        const hotel = await Hotel.findById(id);
        if (!hotel) {
            return res.status(404).json({ message: 'Hotel not found' });
        }

        if (!hotel.adminId) {
            return res.status(400).json({ message: 'No admin assigned to this hotel' });
        }

        const adminUser = await User.findById(hotel.adminId);
        if (!adminUser) {
            return res.status(404).json({ message: 'Admin user not found' });
        }

        adminUser.permissions = sanitizedPermissions;
        await adminUser.save();

        return res.status(200).json({
            message: 'Admin permissions updated successfully',
            admin: {
                id: adminUser._id,
                name: adminUser.name,
                username: adminUser.username,
                permissions: adminUser.permissions
            }
        });
    } catch (error) {
        console.error('Error updating hotel admin permissions:', error);
        return res.status(500).json({
            message: 'Error updating admin permissions',
            error: error.message
        });
    }
};

// @desc    Suspend hotel
// @route   PATCH /api/super-admin/suspend/:id
// @access  Private (Super Admin only)
const suspendHotel = async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id);
        
        if (!hotel) {
            return res.status(404).json({ message: 'Hotel not found' });
        }

        // Toggle status - if currently active, suspend; if suspended, activate
        const newStatus = !hotel.subscription.isActive;
        hotel.isActive = newStatus;
        hotel.subscription.isActive = newStatus;
        await hotel.save();

        res.status(200).json({
            message: `Hotel ${newStatus ? 'activated' : 'suspended'} successfully`,
            hotel
        });
    } catch (error) {
        console.error('Error toggling hotel status:', error);
        res.status(500).json({ 
            message: 'Error toggling hotel status', 
            error: error.message 
        });
    }
};

// @desc    Activate hotel
// @route   PATCH /api/super-admin/activate/:id
// @access  Private (Super Admin only)
const activateHotel = async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id);
        
        if (!hotel) {
            return res.status(404).json({ message: 'Hotel not found' });
        }

        hotel.isActive = true;
        hotel.subscription.isActive = true;
        await hotel.save();

        res.status(200).json({
            message: 'Hotel activated successfully',
            hotel
        });
    } catch (error) {
        console.error('Error activating hotel:', error);
        res.status(500).json({ 
            message: 'Error activating hotel', 
            error: error.message 
        });
    }
};

// @desc    Renew hotel subscription
// @route   PATCH /api/super-admin/renew/:id
// @access  Private (Super Admin only)
const renewSubscription = async (req, res) => {
    try {
        const { duration, days } = req.body; // duration in months OR days in days
        
        // Support both duration (months) and days parameters
        const daysToAdd = days || (duration ? duration * 30 : 0);
        
        if (!daysToAdd || daysToAdd < 1) {
            return res.status(400).json({ 
                message: 'Please provide valid subscription duration (days or months)' 
            });
        }

        const hotel = await Hotel.findById(req.params.id);
        
        if (!hotel) {
            return res.status(404).json({ message: 'Hotel not found' });
        }

        // Calculate new expiry date from today or current expiry (whichever is later)
        const today = new Date();
        const currentExpiry = new Date(hotel.subscription.expiryDate);
        const startFrom = currentExpiry > today ? currentExpiry : today;
        
        const newExpiryDate = new Date(startFrom);
        newExpiryDate.setDate(newExpiryDate.getDate() + parseInt(daysToAdd));

        hotel.subscription.expiryDate = newExpiryDate;
        hotel.subscription.isActive = true;
        hotel.isActive = true;
        await hotel.save();

        res.status(200).json({
            message: `Subscription extended by ${daysToAdd} days successfully`,
            hotel
        });
    } catch (error) {
        console.error('Error renewing subscription:', error);
        res.status(500).json({ 
            message: 'Error renewing subscription', 
            error: error.message 
        });
    }
};

// @desc    Upgrade hotel subscription plan
// @route   PATCH /api/super-admin/upgrade-plan/:id
// @access  Private (Super Admin only)
const upgradePlan = async (req, res) => {
    try {
        const { plan } = req.body;
        
        if (!plan || !['basic', 'premium'].includes(plan)) {
            return res.status(400).json({ 
                message: 'Please provide valid subscription plan (basic or premium)' 
            });
        }

        const hotel = await Hotel.findById(req.params.id);
        
        if (!hotel) {
            return res.status(404).json({ message: 'Hotel not found' });
        }

        hotel.subscription.plan = plan;
        await hotel.save();

        res.status(200).json({
            message: 'Subscription plan updated successfully',
            hotel
        });
    } catch (error) {
        console.error('Error upgrading plan:', error);
        res.status(500).json({ 
            message: 'Error upgrading subscription plan', 
            error: error.message 
        });
    }
};

// @desc    Get super admin profile
// @route   GET /api/super-admin/profile
// @access  Private (Super Admin only)
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ 
            message: 'Error fetching profile', 
            error: error.message 
        });
    }
};

// @desc    Update super admin profile
// @route   PATCH /api/super-admin/profile
// @access  Private (Super Admin only)
const updateProfile = async (req, res) => {
    try {
        const { name, username, phone } = req.body;
        
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if username is being changed and if it already exists
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ 
                    message: 'Username/Email already exists' 
                });
            }
        }

        // Update fields
        if (name) user.name = name;
        if (username) user.username = username;
        if (phone !== undefined) user.phone = phone;

        await user.save();

        res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ 
            message: 'Error updating profile', 
            error: error.message 
        });
    }
};

// @desc    Change super admin password
// @route   PATCH /api/super-admin/change-password
// @access  Private (Super Admin only)
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                message: 'Please provide both current and new password' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                message: 'New password must be at least 6 characters long' 
            });
        }

        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                message: 'Current password is incorrect' 
            });
        }

        // Update password (will be hashed by pre-save hook)
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ 
            message: 'Error changing password', 
            error: error.message 
        });
    }
};

// @desc    Get analytics data
// @route   GET /api/super-admin/analytics
// @access  Private (Super Admin only)
const getAnalytics = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        // Calculate date range
        const now = new Date();
        let startDate;
        
        switch(period) {
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case 'year':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
            default:
                startDate = new Date(now.setMonth(now.getMonth() - 1));
        }

        // Get all hotels
        const allHotels = await Hotel.find();
        
        // Get new hotels in period
        const newHotels = await Hotel.countDocuments({
            createdAt: { $gte: startDate }
        });

        // Calculate revenue (hypothetical - based on subscription plans)
        const revenue = allHotels.reduce((total, hotel) => {
            const planPrice = hotel.subscription?.plan === 'premium' ? 5000 : 2000;
            return total + (hotel.subscription?.isActive ? planPrice : 0);
        }, 0);

        // Calculate subscription renewals in period
        const renewals = await Hotel.countDocuments({
            'subscription.startDate': { $gte: startDate }
        });

        // Plan distribution
        const planDistribution = {
            basic: await Hotel.countDocuments({ 'subscription.plan': 'basic' }),
            premium: await Hotel.countDocuments({ 'subscription.plan': 'premium' })
        };

        // Growth trend (hotels created per month for last 6 months)
        const growthTrend = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(new Date().setMonth(new Date().getMonth() - i, 1));
            const monthEnd = new Date(new Date().setMonth(new Date().getMonth() - i + 1, 0));
            
            const count = await Hotel.countDocuments({
                createdAt: {
                    $gte: monthStart,
                    $lte: monthEnd
                }
            });
            
            growthTrend.push({
                month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                count
            });
        }

        // Expiry distribution (for next 90 days)
        const expiryDistribution = [];
        for (let i = 0; i < 90; i += 30) {
            const rangeStart = new Date(new Date().setDate(new Date().getDate() + i));
            const rangeEnd = new Date(new Date().setDate(new Date().getDate() + i + 30));
            
            const count = await Hotel.countDocuments({
                'subscription.expiryDate': {
                    $gte: rangeStart,
                    $lt: rangeEnd
                },
                'subscription.isActive': true
            });
            
            expiryDistribution.push({
                range: `${Math.floor(i / 30)} - ${Math.floor((i + 30) / 30)} months`,
                count
            });
        }

        res.status(200).json({
            period,
            newHotels,
            revenue,
            renewals,
            planDistribution,
            growthTrend,
            expiryDistribution
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ 
            message: 'Error fetching analytics', 
            error: error.message 
        });
    }
};

// @desc    Get audit logs with filters
// @route   GET /api/super-admin/audit-logs
// @access  Private (Super Admin only)
const getAuditLogs = async (req, res) => {
    try {
        const {
            action,
            targetType,
            userId,
            startDate,
            endDate,
            status,
            page = 1,
            limit = 50
        } = req.query;

        // Build query
        let query = {};

        if (action) query.action = action;
        if (targetType) query.targetType = targetType;
        if (userId) query.userId = userId;
        if (status) query.status = status;

        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await AuditLog.countDocuments(query);

        // Fetch logs
        const logs = await AuditLog.find(query)
            .populate('userId', 'name username email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            logs,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({
            message: 'Error fetching audit logs',
            error: error.message
        });
    }
};

// @desc    Get audit log statistics
// @route   GET /api/super-admin/audit-stats
// @access  Private (Super Admin only)
const getAuditStats = async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        
        // Calculate date range
        const now = new Date();
        let startDate;
        
        switch(period) {
            case '24h':
                startDate = new Date(now.setHours(now.getHours() - 24));
                break;
            case '7d':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case '30d':
                startDate = new Date(now.setDate(now.getDate() - 30));
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 7));
        }

        // Total actions
        const totalActions = await AuditLog.countDocuments({
            createdAt: { $gte: startDate }
        });

        // Actions by type
        const actionsByType = await AuditLog.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Actions by user
        const actionsByUser = await AuditLog.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: '$userId', count: { $sum: 1 }, email: { $first: '$userEmail' } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // Failed actions
        const failedActions = await AuditLog.countDocuments({
            createdAt: { $gte: startDate },
            status: 'failed'
        });

        // Recent critical actions
        const criticalActions = await AuditLog.find({
            createdAt: { $gte: startDate },
            action: {
                $in: ['hotel_deleted', 'admin_deleted', 'bulk_hotels_suspended', 'subscription_cancelled']
            }
        })
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .limit(10);

        res.status(200).json({
            period,
            totalActions,
            actionsByType,
            actionsByUser,
            failedActions,
            criticalActions
        });
    } catch (error) {
        console.error('Error fetching audit stats:', error);
        res.status(500).json({
            message: 'Error fetching audit statistics',
            error: error.message
        });
    }
};

// @desc    Delete old audit logs
// @route   DELETE /api/super-admin/audit-logs/cleanup
// @access  Private (Super Admin only)
const cleanupAuditLogs = async (req, res) => {
    try {
        const { olderThan = 365 } = req.body; // Days
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThan));

        const result = await AuditLog.deleteMany({
            createdAt: { $lt: cutoffDate }
        });

        res.status(200).json({
            message: `Deleted ${result.deletedCount} audit logs older than ${olderThan} days`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error cleaning up audit logs:', error);
        res.status(500).json({
            message: 'Error cleaning up audit logs',
            error: error.message
        });
    }
};

// Legacy endpoints for backward compatibility
const getAllAdmins = getAllHotels;
const createAdmin = createHotel;
const toggleAdminStatus = suspendHotel;
const updateSubscription = renewSubscription;

module.exports = {
    getDashboardStats,
    getAllHotels,
    getHotelById,
    createHotel,
    updateHotelAdminPermissions,
    suspendHotel,
    activateHotel,
    renewSubscription,
    upgradePlan,
    // Profile Management
    getProfile,
    updateProfile,
    changePassword,
    // Analytics
    getAnalytics,
    // Audit Logs
    getAuditLogs,
    getAuditStats,
    cleanupAuditLogs,
    // Legacy exports
    getAllAdmins,
    createAdmin,
    toggleAdminStatus,
    updateSubscription
};

