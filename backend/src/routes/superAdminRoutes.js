const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');
const { superAdminLimiter, superAdminCriticalLimiter } = require('../middleware/security');
const { superAdminIpGuard } = require('../middleware/superAdminIpGuard');
const {
    getDashboardStats,
    getAllHotels,
    getHotelById,
    getHotelAdminCredentials,
    createHotel,
    updateHotelDetails,
    updateHotelAdminPermissions,
    toggleHotelAdminAccountStatus,
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
    // Activity Monitoring
    getActivityLogs,
    getSuspiciousActivities,
    getMonitoringStatus,
    toggleMonitoringControl,
    // Legacy endpoints
    clearAllActivityLogs,
    getAllAdmins,
    createAdmin,
    toggleAdminStatus,
    updateSubscription
} = require('../controllers/superAdminController');

// All routes are protected and require super_admin role
router.use(protect);
router.use(authorizeRoles('super_admin'));
router.use(superAdminIpGuard);
router.use(superAdminLimiter);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Analytics
router.get('/analytics', getAnalytics);

// Audit Logs
router.get('/audit-logs', getAuditLogs);
router.get('/audit-stats', getAuditStats);
router.delete('/audit-logs/cleanup', auditLog('data_exported', 'system'), cleanupAuditLogs);

// Activity Monitoring
router.get('/activity-logs', getActivityLogs);
router.delete('/activity-logs/clear-all', superAdminCriticalLimiter, auditLog('data_deleted', 'system'), clearAllActivityLogs);
router.get('/suspicious-activities', getSuspiciousActivities);
router.get('/monitoring-status', getMonitoringStatus);
router.patch('/monitoring-toggle', toggleMonitoringControl);

// Profile Management
router.get('/profile', getProfile);
router.patch('/profile', auditLog('profile_updated', 'profile'), updateProfile);
router.patch('/change-password', superAdminCriticalLimiter, auditLog('password_changed', 'profile'), changePassword);

// Hotel Management (with audit logging)
router.post('/create-hotel', superAdminCriticalLimiter, auditLog('hotel_created', 'hotel'), createHotel);
router.get('/hotels', getAllHotels);
router.get('/hotel/:id', getHotelById);
router.get('/hotel/:id/admin-credentials', superAdminCriticalLimiter, getHotelAdminCredentials);
router.patch('/hotel/:id', auditLog('hotel_updated', 'hotel'), updateHotelDetails);
router.patch('/hotels/:id', auditLog('hotel_updated', 'hotel'), updateHotelDetails);
router.put('/hotel/:id', auditLog('hotel_updated', 'hotel'), updateHotelDetails);
router.put('/hotels/:id', auditLog('hotel_updated', 'hotel'), updateHotelDetails);
router.patch('/hotel/:id/admin-permissions', superAdminCriticalLimiter, auditLog('admin_updated', 'admin'), updateHotelAdminPermissions);
router.patch('/hotel/:id/permissions', superAdminCriticalLimiter, auditLog('admin_updated', 'admin'), updateHotelAdminPermissions);
router.patch('/hotels/:id/admin-permissions', superAdminCriticalLimiter, auditLog('admin_updated', 'admin'), updateHotelAdminPermissions);
router.patch('/hotel/:id/toggle-admin-account', superAdminCriticalLimiter, auditLog('admin_updated', 'admin'), toggleHotelAdminAccountStatus);
router.patch('/hotels/:id/toggle-admin-account', superAdminCriticalLimiter, auditLog('admin_updated', 'admin'), toggleHotelAdminAccountStatus);

// Hotel Actions (with audit logging)
router.patch('/suspend/:id', superAdminCriticalLimiter, auditLog('hotel_suspended', 'hotel'), suspendHotel);
router.patch('/activate/:id', superAdminCriticalLimiter, auditLog('hotel_activated', 'hotel'), activateHotel);
router.patch('/renew/:id', superAdminCriticalLimiter, auditLog('subscription_renewed', 'subscription'), renewSubscription);
router.patch('/upgrade-plan/:id', superAdminCriticalLimiter, auditLog('subscription_upgraded', 'subscription'), upgradePlan);

// Phase 1 Subscription Management Routes
router.post('/hotel/:id/extend-subscription', superAdminCriticalLimiter, auditLog('subscription_renewed', 'subscription'), renewSubscription);
router.patch('/hotel/:id/toggle-status', superAdminCriticalLimiter, auditLog('hotel_suspended', 'hotel'), suspendHotel);

// Legacy routes for backward compatibility
router.post('/create-admin', superAdminCriticalLimiter, auditLog('admin_created', 'admin'), createAdmin);
router.get('/admins', getAllAdmins);
router.put('/toggle-status/:id', superAdminCriticalLimiter, auditLog('hotel_suspended', 'hotel'), toggleAdminStatus);
router.put('/update-subscription/:id', superAdminCriticalLimiter, auditLog('subscription_renewed', 'subscription'), updateSubscription);

module.exports = router;

