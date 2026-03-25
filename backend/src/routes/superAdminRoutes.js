const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');
const {
    getDashboardStats,
    getAllHotels,
    getHotelById,
    createHotel,
    updateHotelDetails,
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
    // Legacy endpoints
    getAllAdmins,
    createAdmin,
    toggleAdminStatus,
    updateSubscription
} = require('../controllers/superAdminController');

// All routes are protected and require super_admin role
router.use(protect);
router.use(authorizeRoles('super_admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Analytics
router.get('/analytics', getAnalytics);

// Audit Logs
router.get('/audit-logs', getAuditLogs);
router.get('/audit-stats', getAuditStats);
router.delete('/audit-logs/cleanup', auditLog('data_exported', 'system'), cleanupAuditLogs);

// Profile Management
router.get('/profile', getProfile);
router.patch('/profile', auditLog('profile_updated', 'profile'), updateProfile);
router.patch('/change-password', auditLog('password_changed', 'profile'), changePassword);

// Hotel Management (with audit logging)
router.post('/create-hotel', auditLog('hotel_created', 'hotel'), createHotel);
router.get('/hotels', getAllHotels);
router.get('/hotel/:id', getHotelById);
router.patch('/hotel/:id', auditLog('hotel_updated', 'hotel'), updateHotelDetails);
router.patch('/hotels/:id', auditLog('hotel_updated', 'hotel'), updateHotelDetails);
router.put('/hotel/:id', auditLog('hotel_updated', 'hotel'), updateHotelDetails);
router.put('/hotels/:id', auditLog('hotel_updated', 'hotel'), updateHotelDetails);
router.patch('/hotel/:id/admin-permissions', auditLog('admin_updated', 'admin'), updateHotelAdminPermissions);
router.patch('/hotel/:id/permissions', auditLog('admin_updated', 'admin'), updateHotelAdminPermissions);
router.patch('/hotels/:id/admin-permissions', auditLog('admin_updated', 'admin'), updateHotelAdminPermissions);

// Hotel Actions (with audit logging)
router.patch('/suspend/:id', auditLog('hotel_suspended', 'hotel'), suspendHotel);
router.patch('/activate/:id', auditLog('hotel_activated', 'hotel'), activateHotel);
router.patch('/renew/:id', auditLog('subscription_renewed', 'subscription'), renewSubscription);
router.patch('/upgrade-plan/:id', auditLog('subscription_upgraded', 'subscription'), upgradePlan);

// Phase 1 Subscription Management Routes
router.post('/hotel/:id/extend-subscription', auditLog('subscription_renewed', 'subscription'), renewSubscription);
router.patch('/hotel/:id/toggle-status', auditLog('hotel_suspended', 'hotel'), suspendHotel);

// Legacy routes for backward compatibility
router.post('/create-admin', auditLog('admin_created', 'admin'), createAdmin);
router.get('/admins', getAllAdmins);
router.put('/toggle-status/:id', auditLog('hotel_suspended', 'hotel'), toggleAdminStatus);
router.put('/update-subscription/:id', auditLog('subscription_renewed', 'subscription'), updateSubscription);

module.exports = router;

