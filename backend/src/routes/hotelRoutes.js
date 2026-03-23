const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Hotel = require('../models/Hotel');
const { getTenantContext } = require('../middleware/tenantContext');

const DEFAULT_ROOM_GST_SLABS = [
    { min: 0, max: 1000, rate: 0 },
    { min: 1001, max: 7500, rate: 12 },
    { min: 7501, max: 99999, rate: 18 }
];

const resolveHotelIdForRequest = (req) => {
    if (req.user?.role === 'super_admin') {
        return req.query.hotelId || req.body.hotelId || null;
    }
    return req.user?.hotelId || null;
};

const normalizeRoomGstSlabs = (slabs) => {
    if (!Array.isArray(slabs) || slabs.length === 0) return DEFAULT_ROOM_GST_SLABS;

    return slabs
        .map((slab) => ({
            min: Math.max(0, Number(slab?.min) || 0),
            max: Math.max(0, Number(slab?.max) || 0),
            rate: Math.max(0, Math.min(100, Number(slab?.rate) || 0))
        }))
        .sort((a, b) => a.min - b.min)
        .map((slab) => ({
            ...slab,
            max: slab.max >= slab.min ? slab.max : slab.min
        }));
};

// @desc    Get hotel settings (no auth needed for frontend context)
// @route   GET /api/hotel/settings
// @access  Public
router.get('/settings', async (req, res) => {
    try {
        const tenantContext = getTenantContext();
        const targetHotelId = req.query.hotelId || tenantContext?.hotelId || null;

        let hotel = targetHotelId
            ? await Hotel.findById(targetHotelId).lean()
            : await Hotel.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();
        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Hotel not found'
            });
        }
        const normalizedServiceCharge = hotel.roomServiceCharge ?? hotel.serviceCharge ?? 0;
        const normalizedRoomPosting = hotel.enableRoomPosting ?? hotel.billingRules?.autoPost ?? true;
        const normalizedData = {
            ...hotel,
            serviceCharge: normalizedServiceCharge,
            roomServiceCharge: normalizedServiceCharge,
            roomGstSlabs: normalizeRoomGstSlabs(hotel.roomGstSlabs),
            enableRoomPosting: normalizedRoomPosting,
            billingRules: {
                ...(hotel.billingRules || {}),
                autoPost: normalizedRoomPosting
            }
        };
        res.json({ success: true, data: normalizedData });
    } catch (error) {
        console.error('Error fetching hotel settings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch settings' });
    }
});

// @desc    Update hotel settings
// @route   PUT /api/hotel/settings
// @access  Private
router.put('/settings', protect, async (req, res) => {
    try {
        const updates = { ...req.body };
        const targetHotelId = resolveHotelIdForRequest(req);

        if (!targetHotelId) {
            return res.status(400).json({
                success: false,
                message: 'hotelId is required'
            });
        }

        const hasRoomServiceCharge = updates.roomServiceCharge !== undefined;
        const hasServiceCharge = updates.serviceCharge !== undefined;
        if (hasRoomServiceCharge || hasServiceCharge) {
            const unifiedServiceCharge = hasRoomServiceCharge ? updates.roomServiceCharge : updates.serviceCharge;
            updates.serviceCharge = unifiedServiceCharge;
            updates.roomServiceCharge = unifiedServiceCharge;
        }

        const hasEnableRoomPosting = updates.enableRoomPosting !== undefined;
        const hasBillingAutoPost = updates.billingRules && updates.billingRules.autoPost !== undefined;
        if (hasEnableRoomPosting || hasBillingAutoPost) {
            const unifiedRoomPosting = hasEnableRoomPosting ? updates.enableRoomPosting : updates.billingRules.autoPost;
            updates.enableRoomPosting = unifiedRoomPosting;
            updates.billingRules = {
                ...(updates.billingRules || {}),
                autoPost: unifiedRoomPosting
            };
        }

        // Validate tax caps - service charge, cgst, sgst cannot exceed their set max
        if (updates.serviceCharge !== undefined && updates.serviceCharge > 100) {
            return res.status(400).json({ success: false, message: 'Service charge cannot exceed 100%' });
        }
        if (updates.cgst !== undefined && updates.cgst > 50) {
            return res.status(400).json({ success: false, message: 'CGST cannot exceed 50%' });
        }
        if (updates.sgst !== undefined && updates.sgst > 50) {
            return res.status(400).json({ success: false, message: 'SGST cannot exceed 50%' });
        }
        if (updates.roomGstSlabs !== undefined) {
            updates.roomGstSlabs = normalizeRoomGstSlabs(updates.roomGstSlabs);
        }

        let hotel = await Hotel.findById(targetHotelId);
        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Hotel not found'
            });
        }

        // Update allowed fields
        const allowedFields = [
            'name', 'address', 'city', 'state', 'pin', 'gstNumber', 'phone', 'logoUrl',
            'currency', 'timezone', 'dateFormat', 'timeFormat',
            'taxType', 'cgst', 'sgst', 'serviceCharge', 'roomGst', 'roomGstSlabs', 'foodGst', 'roomServiceCharge', 'inclusiveTax',
            'invoicePrefix', 'billingInvoicePrefix', 'startingInvoiceNumber', 'panNumber',
            'autoGenerateInvoice', 'autoIncrementInvoice', 'billPrintFormat', 'thankYouMessage',
            'enableRoomPosting', 'posEnabled', 'displayLogoOnBill', 'printKOTHeader',
            'paymentModes', 'billingRules', 'discountRules'
        ];

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                hotel[field] = updates[field];
            }
        });

        await hotel.save();
        res.json({ success: true, data: hotel });
    } catch (error) {
        console.error('Error updating hotel settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
});

// @desc    Get hotel by ID (for admin/staff to view their own hotel)
// @route   GET /api/hotel/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id)
            .populate('adminId', 'name email phone');
        
        if (!hotel) {
            return res.status(404).json({ message: 'Hotel not found' });
        }

        // Verify user has access to this hotel (either owns it or is staff)
        if (req.user.role === 'super_admin' || 
            req.user.hotelId?.toString() === hotel._id.toString()) {
            res.status(200).json(hotel);
        } else {
            res.status(403).json({ message: 'Access denied. You can only view your own hotel information.' });
        }
    } catch (error) {
        console.error('Error fetching hotel:', error);
        res.status(500).json({ 
            message: 'Error fetching hotel details', 
            error: error.message 
        });
    }
});

module.exports = router;
