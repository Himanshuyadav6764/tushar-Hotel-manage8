const express = require('express');
const router = express.Router();
const guestMealController = require('../controllers/guestMealController');

// ============================================================================
// TABLE ROUTES
// ============================================================================

// Get all tables
router.get('/tables', guestMealController.getAllTables);

// Get table by ID
router.get('/tables/:tableId', guestMealController.getTableById);

// Create new table
router.post('/tables', guestMealController.createTable);

// Delete table
router.delete('/tables/:tableId', guestMealController.deleteTable);

// Update table details (e.g. status)
router.put('/tables/:tableId', guestMealController.updateTable);

// Get tables by status
router.get('/tables/status/:status', guestMealController.getTablesByStatus);

// Initialize tables
router.post('/tables/initialize', guestMealController.initializeTables);

// Merge tables
router.post('/tables/merge', guestMealController.mergeTables);

// Release/Unmerge tables
router.post('/tables/:tableId/release', guestMealController.releaseTable);

// ============================================================================
// ORDER ROUTES
// ============================================================================

// Get all orders (Active/Billed)
router.get('/orders', guestMealController.getAllOrders);

// Get pending orders (for Cashier Dashboard) - MUST be before /:orderId
router.get('/orders/pending', guestMealController.getPendingOrders);

// Get room service specific orders
router.get('/orders/room-service', guestMealController.getRoomServiceOrders);

// Create new order
router.post('/orders/create', guestMealController.createOrder);

// Get order by table ID
router.get('/orders/table/:tableId', guestMealController.getOrderByTableId);

// Get latest order for currently verified QR guest
router.get('/orders/guest/latest', guestMealController.getLatestGuestOrder);

// Get order by ID
router.get('/orders/:orderId', guestMealController.getOrderById);

// Guest cancel from QR flow
router.post('/orders/:orderId/cancel-by-guest', guestMealController.cancelOrderByGuest);

// Update order items
router.put('/orders/:orderId/items', guestMealController.updateOrderItems);

// Apply discount
router.put('/orders/:orderId/discount', guestMealController.applyDiscount);

// Bill order
router.post('/orders/:orderId/bill', guestMealController.billOrder);

// Close order
router.post('/orders/:orderId/close', guestMealController.closeOrder);

// Send to Cashier (Pending Payment)
router.post('/orders/:orderId/send-to-cashier', guestMealController.sendToCashier);

// Settle order (Payment processed by cashier)
router.post('/orders/:orderId/settle', guestMealController.settleOrder);

// Update order status (Pending, Preparing, Ready)
router.patch('/orders/:orderId/status', guestMealController.updateOrderStatus);

// Delete order
router.delete('/orders/:orderId', guestMealController.deleteOrder);


// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

// Get dashboard stats
router.get('/analytics/dashboard', guestMealController.getDashboardStats);

// Get POS per-type stats (for FoodOrderPage live stats bar)
router.get('/analytics/pos-stats', guestMealController.getPosStats);

// Get revenue report
router.get('/analytics/revenue', guestMealController.getRevenueReport);

// Get outlet status (Live load/Table status)
router.get('/analytics/outlet-status', guestMealController.getOutletStatus);

module.exports = router;
