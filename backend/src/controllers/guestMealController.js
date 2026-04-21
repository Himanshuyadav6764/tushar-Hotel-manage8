const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Table = require('../models/Table');
const GuestMealOrder = require('../models/Order');
const MenuItem = require('../models/Menu');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { emitOpsNotification } = require('../utils/opsRealtimeEmitter');

const buildOrderRealtimeMessage = (order, changeType = 'updated') => {
    const shortId = String(order?._id || '').slice(-6).toUpperCase();
    const place = order?.roomNumber
        ? `Room ${order.roomNumber}`
        : order?.tableNumber
            ? `Table ${order.tableNumber}`
            : order?.guestName || 'Guest';

    if (changeType === 'new') {
        return `New ${order?.orderType || 'order'} #${shortId} received for ${place}.`;
    }

    return `Order #${shortId} status is now ${order?.status || 'updated'} (${place}).`;
};

const emitOrderRealtimeEvent = (req, order, changeType = 'updated') => {
    if (!order?._id) return;

    const statusToken = String(order.status || 'na').toLowerCase().replace(/\s+/g, '-');

    emitOpsNotification(req, {
        eventId: `order-${String(order._id)}-${changeType}-${statusToken}-${Date.now()}`,
        module: 'orders',
        entity: 'order',
        entityId: String(order._id),
        title: 'Order Update',
        message: buildOrderRealtimeMessage(order, changeType),
        data: {
            _id: String(order._id),
            orderType: order.orderType,
            status: order.status,
            roomNumber: order.roomNumber,
            tableNumber: order.tableNumber,
            guestName: order.guestName,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
        },
    });
};

const readGuestAccessPayload = (req) => {
    const rawToken = req.headers['x-guest-access-token'];
    if (!rawToken) return null;
    try {
        const payload = jwt.verify(String(rawToken), process.env.JWT_SECRET);
        if (payload?.type !== 'guest_room_qr') return null;
        return payload;
    } catch (_) {
        return null;
    }
};

const isCheckedInStatus = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    return normalized === 'checked-in' || normalized === 'checkedin' || normalized === 'in_house';
};

const isGuestAllowedForOrder = (guestPayload, order) => {
    if (!guestPayload || !order) return false;

    const tokenRoom = String(guestPayload.roomNumber || '').trim();
    const orderRoom = String(order.roomNumber || '').trim();
    const tokenBooking = String(guestPayload.bookingDocId || '').trim();
    const orderBooking = String(order.booking || '').trim();

    if (!tokenRoom || tokenRoom !== orderRoom) {
        return false;
    }

    if (orderBooking && tokenBooking && tokenBooking !== orderBooking) {
        return false;
    }

    return true;
};

// ============================================================================
// TABLE MANAGEMENT CONTROLLERS
// ============================================================================

// Get all tables with their current status and details
exports.getAllTables = async (req, res) => {
    try {
        const tables = await Table.find()
            .populate('currentOrderId')
            .sort({ tableNumber: 1 });

        // Enhance table data
        const enhancedTables = tables.map(table => ({
            _id: table._id,
            tableId: table._id, // Frontend uses tableId
            tableNumber: table.tableNumber,
            tableName: table.tableName || `T${table.tableNumber}`,
            type: table.type,
            location: table.location || 'Main Hall',
            status: table.status,
            capacity: table.capacity,
            guests: table.guests,
            reservations: table.reservations || [],
            runningOrderAmount: table.runningOrderAmount,
            orderDuration: table.getOrderDuration(),
            formattedDuration: table.getFormattedDuration(),
            orderStartTime: table.orderStartTime,
            currentOrderId: table.currentOrderId,
            orderStatus: table.currentOrderId ? table.currentOrderId.status : null,
            mergedTableIds: table.mergedTableIds || [],
            isSplitChild: Boolean(table.isSplitChild),
            parentTableId: table.parentTableId || null,
            splitChildTableIds: table.splitChildTableIds || [],
            amount: table.runningOrderAmount || 0,
            duration: table.getOrderDuration() || 0,
            createdAt: table.createdAt,
            updatedAt: table.updatedAt
        }));

        res.status(200).json({
            success: true,
            data: enhancedTables,
            count: enhancedTables.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching tables',
            error: error.message
        });
    }
};

// Split one table into multiple sub tables (e.g. T1-A, T1-B)
exports.splitTable = async (req, res) => {
    try {
        const { sourceTableId, subTables } = req.body;

        if (!sourceTableId || !Array.isArray(subTables) || subTables.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Source table and at least 2 sub tables are required'
            });
        }

        const sourceTable = await Table.findById(sourceTableId);
        if (!sourceTable) {
            return res.status(404).json({ success: false, message: 'Source table not found' });
        }

        if (sourceTable.isSplitChild) {
            return res.status(400).json({ success: false, message: 'Split child table cannot be split again' });
        }

        if (Array.isArray(sourceTable.splitChildTableIds) && sourceTable.splitChildTableIds.length > 0) {
            return res.status(400).json({ success: false, message: 'Table is already split. Merge first.' });
        }

        const existingTables = await Table.find({}, { tableName: 1, tableNumber: 1 });
        const existingNames = new Set(existingTables.map(t => String(t.tableName || '').trim().toLowerCase()));
        const usedNumbers = new Set(existingTables.map(t => Number(t.tableNumber)).filter(Number.isFinite));

        const normalizedSubs = subTables.map((sub, idx) => {
            const suffix = String.fromCharCode(65 + idx);
            const fallbackName = `${sourceTable.tableName}-${suffix}`;
            const requestedName = String(sub?.name || '').trim();
            const finalName = requestedName || fallbackName;

            return {
                name: finalName,
                guests: Math.max(1, Number(sub?.guests || 1)),
                waiter: String(sub?.waiter || '').trim()
            };
        });

        const duplicateNames = new Set();
        for (const sub of normalizedSubs) {
            const key = sub.name.toLowerCase();
            if (existingNames.has(key) || duplicateNames.has(key)) {
                return res.status(400).json({
                    success: false,
                    message: `Table name "${sub.name}" already exists. Please rename split tables.`
                });
            }
            duplicateNames.add(key);
        }

        let nextTableNumber = Math.max(0, ...Array.from(usedNumbers)) + 1;
        const childDocs = [];

        for (const sub of normalizedSubs) {
            while (usedNumbers.has(nextTableNumber)) {
                nextTableNumber += 1;
            }
            usedNumbers.add(nextTableNumber);

            childDocs.push({
                tableName: sub.name,
                tableNumber: nextTableNumber,
                capacity: sub.guests,
                status: sourceTable.status === 'Billed' ? 'Available' : sourceTable.status,
                guests: sub.guests,
                type: sourceTable.type || 'General',
                location: sourceTable.location || 'Main Hall',
                isSplitChild: true,
                parentTableId: sourceTable._id,
                splitChildTableIds: [],
                reservations: []
            });

            nextTableNumber += 1;
        }

        const createdChildren = await Table.insertMany(childDocs);

        sourceTable.splitChildTableIds = createdChildren.map(t => t._id);
        sourceTable.status = 'Available';
        sourceTable.guests = 0;
        sourceTable.currentOrderId = null;
        sourceTable.runningOrderAmount = 0;
        sourceTable.orderStartTime = null;
        await sourceTable.save();

        return res.status(200).json({
            success: true,
            message: `Table split into ${createdChildren.length} sub tables`,
            data: {
                parentTable: sourceTable,
                splitTables: createdChildren
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error splitting table',
            error: error.message
        });
    }
};

// Get table by ID
exports.getTableById = async (req, res) => {
    try {
        const table = await Table.findById(req.params.tableId)
            .populate('currentOrderId');

        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ...table.toObject(),
                formattedDuration: table.getFormattedDuration()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching table',
            error: error.message
        });
    }
};

// Create new table
exports.createTable = async (req, res) => {
    try {
        const { tableName, capacity, type, location } = req.body;
        const normalizedName = String(tableName || '').trim();
        const normalizedType = String(type || '').trim() || 'General';
        const normalizedLocation = String(location || '').trim() || 'Main Hall';

        if (!normalizedName) {
            return res.status(400).json({ success: false, message: 'Table name is required' });
        }

        // Check if table name already exists
        const existingTable = await Table.findOne({ tableName: { $regex: new RegExp(`^${normalizedName}$`, 'i') } });
        if (existingTable) {
            return res.status(400).json({ success: false, message: `Table "${normalizedName}" already exists` });
        }

        // Auto-generate table number
        const lastTable = await Table.findOne({ tableNumber: { $exists: true } }).sort({ tableNumber: -1 });
        let tableNumber = 1;
        if (lastTable && typeof lastTable.tableNumber === 'number') {
            tableNumber = lastTable.tableNumber + 1;
        }

        // Ensure tableNumber is unique by checking again
        let isUnique = false;
        while (!isUnique) {
            const collision = await Table.findOne({ tableNumber });
            if (collision) {
                tableNumber++;
            } else {
                isUnique = true;
            }
        }

        const table = new Table({
            tableName: normalizedName,
            tableNumber,
            capacity: capacity || 4,
            type: normalizedType,
            location: normalizedLocation,
            status: 'Available'
        });

        await table.save();

        res.status(201).json({
            success: true,
            data: table,
            message: 'Table created successfully'
        });
    } catch (error) {
        console.error('Error in createTable:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error creating table',
            error: error.message
        });
    }
};

// Delete table
exports.deleteTable = async (req, res) => {
    try {
        const table = await Table.findByIdAndDelete(req.params.tableId);

        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Table deleted successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error deleting table',
            error: error.message
        });
    }
};

// Update table details (status, type, reservation, etc.)
exports.updateTable = async (req, res) => {
    try {
        const { status, type, capacity, tableName, guests, reservation, currentOrderId, runningOrderAmount, orderStartTime, orderDuration, location } = req.body;

        let updateData = {};
        if (status) updateData.status = status;
        if (typeof type !== 'undefined') updateData.type = String(type || '').trim() || 'General';
        if (typeof location !== 'undefined') updateData.location = String(location || '').trim() || 'Main Hall';
        if (capacity) updateData.capacity = capacity;
        if (tableName) updateData.tableName = String(tableName || '').trim();
        if (guests !== undefined) updateData.guests = guests;

        // Handle order-related fields (allow clearing with null/0)
        if (req.body.hasOwnProperty('currentOrderId')) updateData.currentOrderId = currentOrderId;
        if (req.body.hasOwnProperty('runningOrderAmount')) updateData.runningOrderAmount = runningOrderAmount;
        if (req.body.hasOwnProperty('orderStartTime')) updateData.orderStartTime = orderStartTime;
        if (req.body.hasOwnProperty('orderDuration')) updateData.orderDuration = orderDuration;

        // Handle reservation: if explicit null sent, it clears it. If object, updates it.
        // Handle reservation updates
        if (req.body.reservations) {
            updateData.reservations = req.body.reservations;
        } else if (req.body.reservation) {
            // If legacy single reservation or "add reservation" request, append to array
            // We need to use $push for this if not replacing entire object
            // But since we are using findByIdAndUpdate with $set, we can't easily mix.
            // Strategy: First fetch table, modify array, then save. Or use specific update operator.
            // Let's use specific operator logic below.
        }

        let updateOperation = {};
        if (Object.keys(updateData).length > 0) {
            updateOperation.$set = updateData;
        }

        // If adding a single reservation (special validation or push)
        if (req.body.newReservation) {
            updateOperation.$push = { reservations: req.body.newReservation };
        }
        // If removing a reservation (by ID) which frontend might send as removeReservationId
        if (req.body.removeReservationId) {
            updateOperation.$pull = { reservations: { id: req.body.removeReservationId } };
        }

        // Ensure we have at least one operation
        if (Object.keys(updateOperation).length === 0) {
            return res.status(400).json({ success: false, message: 'No update data provided' });
        }

        console.log('Update Data:', updateData);
        console.log('Update Operation:', JSON.stringify(updateOperation, null, 2));

        const table = await Table.findByIdAndUpdate(
            req.params.tableId,
            updateOperation,
            { new: true } // Removed runValidators: true to bypass strict validation issues
        );

        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ...table.toObject(),
                tableId: table._id
            },
            message: 'Table updated successfully'
        });
    } catch (error) {
        console.error('Error updating table:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error updating table',
            error: error.message
        });
    }
};

// Initialize all tables (create default tables if they don't exist)
exports.initializeTables = async (req, res) => {
    try {
        const { numberOfTables = 12 } = req.body;

        // Check existing tables
        const existingTables = await Table.find();
        if (existingTables.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Tables already initialized'
            });
        }

        // Create new tables
        const tablesData = Array.from({ length: numberOfTables }, (_, i) => ({
            tableNumber: i + 1,
            status: 'Available',
            capacity: 4
        }));

        const tables = await Table.insertMany(tablesData);

        res.status(201).json({
            success: true,
            message: `${tables.length} tables initialized successfully`,
            data: tables
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error initializing tables',
            error: error.message
        });
    }
};

// Get tables by status (filter)
exports.getTablesByStatus = async (req, res) => {
    try {
        const { status } = req.params;

        if (!['Available', 'Running', 'Billed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const tables = await Table.find({ status })
            .populate('currentOrderId')
            .sort({ tableNumber: 1 });

        res.status(200).json({
            success: true,
            data: tables,
            count: tables.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching tables by status',
            error: error.message
        });
    }
};

// Merge Multiple Tables
exports.mergeTables = async (req, res) => {
    try {
        const { sourceTableId, targetTableIds } = req.body;

        if (!sourceTableId || !targetTableIds || !Array.isArray(targetTableIds) || targetTableIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Source table and target tables (array) are required'
            });
        }

        const sourceTable = await Table.findById(sourceTableId).populate('currentOrderId');
        const targetTables = await Table.find({ _id: { $in: targetTableIds } }).populate('currentOrderId');

        if (!sourceTable) {
            return res.status(404).json({ success: false, message: 'Source table not found' });
        }

        // Combine logic
        const allTables = [sourceTable, ...targetTables];
        const combinedName = allTables.map(t => t.tableName.replace('_MERGED_', '')).join(', ');
        const totalCapacity = allTables.reduce((sum, t) => sum + (t.capacity || 4), 0);
        const totalGuests = allTables.reduce((sum, t) => sum + (t.guests || 0), 0);

        // Merge Orders
        let sourceOrder = sourceTable.currentOrderId;

        // If source has no order but targets do, the first target with an order becomes the "base" or we create one.
        if (!sourceOrder) {
            const firstTargetWithOrder = targetTables.find(t => t.currentOrderId);
            if (firstTargetWithOrder) {
                sourceOrder = firstTargetWithOrder.currentOrderId;
                sourceTable.currentOrderId = sourceOrder._id;
            }
        }

        if (sourceOrder) {
            for (const target of targetTables) {
                if (target.currentOrderId && target.currentOrderId._id.toString() !== sourceOrder._id.toString()) {
                    // Move items from target order to source order
                    sourceOrder.items = [...(sourceOrder.items || []), ...(target.currentOrderId.items || [])];
                    // Close target order as "Merged"
                    target.currentOrderId.status = 'Closed';
                    target.currentOrderId.closedAt = new Date();
                    target.currentOrderId.note = `Merged into ${sourceTable.tableName}`;
                    await target.currentOrderId.save();
                }
            }
            // Recalculate source order totals (Order model should have a middleware or we do it here)
            // For now, assume save() triggers any logic or we do it manually if needed.
            await sourceOrder.save();
            sourceTable.runningOrderAmount = sourceOrder.totalAmount || 0;
        }

        // Store original state if not already stored (to handle multiple merges)
        if (!sourceTable.originalTableName) {
            sourceTable.originalTableName = sourceTable.tableName.replace('_MERGED_', '');
            sourceTable.originalCapacity = sourceTable.capacity;
        }

        // Update Source Table
        sourceTable.tableName = combinedName;
        sourceTable.capacity = totalCapacity;
        sourceTable.guests = totalGuests;
        sourceTable.status = 'Running';
        sourceTable.mergedTableIds = Array.from(new Set([...(sourceTable.mergedTableIds || []), ...targetTableIds]));
        await sourceTable.save();

        // Update Target Tables
        for (const target of targetTables) {
            target.tableName = `_MERGED_${target.tableName}`;
            target.status = 'Available'; // Or some hidden state
            target.currentOrderId = null;
            target.guests = 0;
            target.runningOrderAmount = 0;
            await target.save();
        }

        res.status(200).json({
            success: true,
            message: `Tables merged successfully into ${combinedName}`,
            data: sourceTable
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error merging tables',
            error: error.message
        });
    }
};

// Release/Unmerge Table
exports.releaseTable = async (req, res) => {
    try {
        const { tableId } = req.params;
        const table = await Table.findById(tableId);

        if (!table) {
            return res.status(404).json({ success: false, message: 'Table not found' });
        }

        // Identify target tables to release
        let targetIds = table.mergedTableIds || [];

        // If no explicit IDs, try to find by name for legacy merges
        if (targetIds.length === 0 && table.tableName.includes(',')) {
            const tableNames = table.tableName.split(',').map(n => n.trim());
            // The first one is (likely) the source, others are targets
            const potentialTargets = tableNames.slice(1);
            const foundTargets = await Table.find({
                tableName: { $in: potentialTargets.map(name => `_MERGED_${name}`) }
            });
            targetIds = foundTargets.map(t => t._id);
        }

        if (targetIds.length > 0) {
            const mergedTables = await Table.find({ _id: { $in: targetIds } });
            for (const target of mergedTables) {
                target.tableName = target.tableName.replace('_MERGED_', '');
                target.status = 'Available';
                target.mergedTableIds = [];
                await target.save();
            }
        }

        // Restore source table
        table.tableName = table.originalTableName || table.tableName.split(',')[0].trim();
        table.capacity = table.originalCapacity || 4;
        table.mergedTableIds = [];
        table.originalTableName = null;
        table.originalCapacity = null;

        // If it was only a release (not a checkout), we keep the status as it is?
        // But usually unmerging happens during checkout or when clearing a mess.
        // Let's set it to 'Available' if it has no running order after unmerge.
        if (!table.currentOrderId) {
            table.status = 'Available';
            table.guests = 0;
            table.runningOrderAmount = 0;
        }

        await table.save();

        res.status(200).json({
            success: true,
            message: 'Tables released successfully',
            data: table
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error releasing table',
            error: error.message
        });
    }
};

// Merge all split children back into the parent table
exports.mergeSplitTables = async (req, res) => {
    try {
        const { tableId } = req.body;

        if (!tableId) {
            return res.status(400).json({ success: false, message: 'tableId is required' });
        }

        const table = await Table.findById(tableId);
        if (!table) {
            return res.status(404).json({ success: false, message: 'Table not found' });
        }

        const parentId = table.isSplitChild ? table.parentTableId : table._id;
        if (!parentId) {
            return res.status(400).json({ success: false, message: 'Split parent table not found' });
        }

        const parentTable = await Table.findById(parentId);
        if (!parentTable) {
            return res.status(404).json({ success: false, message: 'Parent table not found' });
        }

        let childIds = Array.isArray(parentTable.splitChildTableIds) ? parentTable.splitChildTableIds : [];
        if (childIds.length === 0) {
            const childRows = await Table.find({ parentTableId: parentTable._id, isSplitChild: true }, { _id: 1 });
            childIds = childRows.map(row => row._id);
        }

        if (childIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No split tables found to merge' });
        }

        await Table.deleteMany({ _id: { $in: childIds } });

        parentTable.splitChildTableIds = [];
        parentTable.status = 'Available';
        parentTable.guests = 0;
        parentTable.currentOrderId = null;
        parentTable.runningOrderAmount = 0;
        parentTable.orderStartTime = null;
        await parentTable.save();

        return res.status(200).json({
            success: true,
            message: 'Split tables merged successfully',
            data: parentTable
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error merging split tables',
            error: error.message
        });
    }
};

// Create new order for a table
exports.createOrder = async (req, res) => {
    try {
        const { tableId, tableNumber, orderType = 'Direct Payment', roomNumber, guestName, numberOfGuests = 1, taxRate = 0, notes, kotNote, guest, guestPhone } = req.body;
        const guestAccessPayload = !req.user ? readGuestAccessPayload(req) : null;
        const isGuestOnlineOrder = Boolean(guestAccessPayload) && orderType === 'Online';

        if (!req.user && !guestAccessPayload) {
            return res.status(401).json({
                success: false,
                message: 'Guest access token missing or expired. Please scan QR again.'
            });
        }

        if (guestAccessPayload) {
            if (orderType !== 'Post to Room' && orderType !== 'Online') {
                return res.status(403).json({
                    success: false,
                    message: 'Guest QR flow only supports room orders.'
                });
            }

            if (String(roomNumber || '').trim() !== String(guestAccessPayload.roomNumber || '').trim()) {
                return res.status(403).json({
                    success: false,
                    message: 'Room mismatch in guest order request.'
                });
            }
        }

        let table = null;
        let room = null;

        // Skip table validation for Take Away and Post to Room
        if (orderType !== 'Take Away' && orderType !== 'Post to Room' && !isGuestOnlineOrder) {
            if (!tableId || !tableId.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({ success: false, message: 'Invalid or missing tableId' });
            }
            table = await Table.findById(tableId);
            if (!table) {
                return res.status(404).json({
                    success: false,
                    message: 'Table not found'
                });
            }

            if (table.status === 'Billed') {
                return res.status(409).json({
                    success: false,
                    message: 'Table is currently billed. Please close the existing order first.'
                });
            }

            // Check if an active order already exists to prevent duplicates
            const existingOrder = await GuestMealOrder.findOne({ tableId, status: 'Active' });
            if (existingOrder) {
                return res.status(200).json({
                    success: true,
                    message: 'Active order already exists',
                    data: existingOrder
                });
            }
        }

        // For Room Service (Post to Room), try to find the room for linking
        if ((orderType === 'Post to Room' || isGuestOnlineOrder) && roomNumber) {
            room = await Room.findOne({ roomNumber: roomNumber });

            if (guestAccessPayload) {
                const verifiedBooking = await Booking.findById(guestAccessPayload.bookingDocId);
                if (!verifiedBooking || !isCheckedInStatus(verifiedBooking.status)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Booking is no longer active for this room.'
                    });
                }
            }
        }

        // Create new order
        const orderData = {
            tableId: (orderType === 'Take Away' || orderType === 'Post to Room' || isGuestOnlineOrder) ? null : tableId,
            table: (orderType === 'Take Away' || orderType === 'Post to Room' || isGuestOnlineOrder) ? null : tableId,
            tableNumber: (orderType === 'Take Away') ? 0 : tableNumber,
            room: room ? room._id : null,
            booking: guestAccessPayload?.bookingDocId || null,
            orderType,
            roomNumber: (orderType === 'Post to Room' || isGuestOnlineOrder) ? roomNumber : null,
            guestName: guestAccessPayload?.guestName || guestName || (orderType === 'Take Away' ? 'Walk-in Customer' : null),
            guestPhone: guestAccessPayload?.mobileNumber || guestPhone || req.body.guestPhone || null,
            guest: guest || null,
            notes: notes || null,
            kotNote: kotNote || null,
            numberOfGuests: Number(numberOfGuests) || 1,
            items: (req.body.items || []).map(item => ({
                ...item,
                menuItem: item.id && item.id.match(/^[0-9a-fA-F]{24}$/) ? item.id : null,
                total: (item.price || 0) * (item.quantity || 1)
            })),
            taxRate: Number(taxRate) || 0,
            status: (orderType === 'Post to Room' || orderType === 'Online') ? 'Pending' : 'Active',
            paymentMethod: 'Pending',
            paymentStatus: 'Pending'
        };

        const order = new GuestMealOrder(orderData);
        await order.save();

        if (table) {
            // Update table status and set current order
            table.status = 'Running';
            table.currentOrderId = order._id;
            table.orderStartTime = new Date();
            table.runningOrderAmount = order.finalAmount || 0;
            await table.save();
        }

        // DECREMENT STOCK LOGIC
        if (req.body.items && req.body.items.length > 0) {
            for (const item of req.body.items) {
                try {
                    let menuItem;
                    const menuItemId = item.id || item.menuItemId || item._id;

                    if (menuItemId && menuItemId.match(/^[0-9a-fA-F]{24}$/)) {
                        menuItem = await MenuItem.findById(menuItemId);
                    }

                    if (!menuItem && (item.name || item.itemName)) {
                        menuItem = await MenuItem.findOne({ itemName: item.name || item.itemName });
                    }

                    if (menuItem) {
                        const qtyToDeduct = parseInt(item.quantity) || 1;
                        menuItem.quantity = Math.max(0, (menuItem.quantity || 0) - qtyToDeduct);
                        await menuItem.save();
                    }
                } catch (stockError) {
                    console.error(`Error updating stock:`, stockError);
                }
            }
        }

        emitOrderRealtimeEvent(req, order, 'new');

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: {
                order,
                table
            }
        });
    } catch (error) {
        console.error('Create Order Error:', error);
        res.status(400).json({
            success: false,
            message: 'Error creating order',
            error: error.message
        });
    }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
    try {
        const guestAccessPayload = !req.user ? readGuestAccessPayload(req) : null;
        if (!req.user && !guestAccessPayload) {
            return res.status(401).json({
                success: false,
                message: 'Guest access token missing or expired. Please scan QR again.'
            });
        }

        const order = await GuestMealOrder.findById(req.params.orderId)
            .populate('tableId');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (guestAccessPayload && !isGuestAllowedForOrder(guestAccessPayload, order)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied for this order.'
            });
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching order',
            error: error.message
        });
    }
};

// Get latest guest order for current QR guest session
exports.getLatestGuestOrder = async (req, res) => {
    try {
        const guestAccessPayload = readGuestAccessPayload(req);
        if (!guestAccessPayload) {
            return res.status(401).json({
                success: false,
                message: 'Guest access token missing or expired. Please scan QR again.'
            });
        }

        const query = {
            roomNumber: String(guestAccessPayload.roomNumber || '').trim(),
            orderType: { $in: ['Online', 'Post to Room'] }
        };

        if (guestAccessPayload.bookingDocId) {
            query.booking = guestAccessPayload.bookingDocId;
        }

        const latestOrder = await GuestMealOrder.findOne(query)
            .sort({ createdAt: -1 })
            .populate('tableId');

        return res.status(200).json({
            success: true,
            data: latestOrder || null,
            message: latestOrder ? 'Latest order fetched' : 'No order found for this room yet.'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching latest guest order',
            error: error.message
        });
    }
};

// Get order by table ID
exports.getOrderByTableId = async (req, res) => {
    try {
        const { tableId } = req.params;

        const order = await GuestMealOrder.findOne({
            tableId,
            status: 'Active'
        }).populate('tableId');

        if (!order) {
            return res.status(200).json({
                success: true,
                data: null,
                message: 'No active order found for this table'
            });
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching order',
            error: error.message
        });
    }
};

// Update order items
exports.updateOrderItems = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { items, taxRate, notes, kotNote, guestName, guestPhone, guest } = req.body;
        const guestAccessPayload = !req.user ? readGuestAccessPayload(req) : null;

        if (!req.user && !guestAccessPayload) {
            return res.status(401).json({
                success: false,
                message: 'Guest access token missing or expired. Please scan QR again.'
            });
        }

        const order = await GuestMealOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (guestAccessPayload) {
            if (!isGuestAllowedForOrder(guestAccessPayload, order)) {
                return res.status(403).json({
                    success: false,
                    message: 'Guest token is not valid for this order.'
                });
            }
        }

        if (items) {
            // Mapping items for consistency
            const mappedItems = items.map(item => ({
                ...item,
                menuItem: item.id && item.id.match(/^[0-9a-fA-F]{24}$/) ? item.id :
                    (item.menuItem || null),
                total: (item.price || 0) * (item.quantity || 1)
            }));

            // STOCK SYNC LOGIC: Compare old items and new items to adjust stock
            const oldItemsMap = new Map();
            order.items.forEach(item => {
                const id = (item.id || item.menuItemId || item.menuItem || item._id)?.toString();
                if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
                    oldItemsMap.set(id, (oldItemsMap.get(id) || 0) + (item.quantity || 0));
                }
            });

            const newItemsMap = new Map();
            mappedItems.forEach(item => {
                const id = (item.id || item.menuItemId || item.menuItem || item._id)?.toString();
                if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
                    newItemsMap.set(id, (newItemsMap.get(id) || 0) + (item.quantity || 0));
                }
            });

            const allItemIds = new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]);

            for (const itemId of allItemIds) {
                const oldQty = oldItemsMap.get(itemId) || 0;
                const newQty = newItemsMap.get(itemId) || 0;
                const diff = newQty - oldQty;

                if (diff !== 0) {
                    try {
                        const menuItem = await MenuItem.findById(itemId);
                        if (menuItem) {
                            menuItem.quantity = Math.max(0, (menuItem.quantity || 0) - diff);
                            await menuItem.save();
                        }
                    } catch (err) {
                        console.error(`Error updating stock for item ${itemId}:`, err);
                    }
                }
            }

            order.items = mappedItems;
        }

        if (taxRate !== undefined) order.taxRate = Number(taxRate) || 0;
        if (notes !== undefined) order.notes = notes;
        if (kotNote !== undefined) order.kotNote = kotNote;
        if (guestName !== undefined) order.guestName = guestName;
        if (guestPhone !== undefined) order.guestPhone = guestPhone;
        if (guest !== undefined) order.guest = guest;

        if (guestAccessPayload) {
            order.guestName = guestAccessPayload.guestName || order.guestName;
            order.guestPhone = guestAccessPayload.mobileNumber || order.guestPhone;
        }

        await order.save();

        // Update table running order amount if linked to a table
        if (order.tableId) {
            const table = await Table.findById(order.tableId);
            if (table) {
                table.runningOrderAmount = order.finalAmount || 0;
                await table.save();
            }
        }

        emitOrderRealtimeEvent(req, order, 'updated');

        res.status(200).json({
            success: true,
            message: 'Order items updated and stock adjusted successfully',
            data: order
        });
    } catch (error) {
        console.error('Update Order Error:', error);
        res.status(400).json({
            success: false,
            message: 'Error updating order',
            error: error.message
        });
    }
};

// Apply discount to order
exports.applyDiscount = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { discountAmount } = req.body;

        const order = await GuestMealOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        order.discountAmount = discountAmount;
        await order.save();

        // Update table running order amount
        const table = await Table.findById(order.tableId);
        if (table) {
            table.runningOrderAmount = order.finalAmount;
            await table.save();
        }

        res.status(200).json({
            success: true,
            message: 'Discount applied successfully',
            data: order
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error applying discount',
            error: error.message
        });
    }
};

// Bill the order
exports.billOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { paymentMethod = 'Cash' } = req.body;

        const order = await GuestMealOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.status !== 'Active') {
            return res.status(409).json({
                success: false,
                message: 'Order is not in active status'
            });
        }

        // Update order status
        order.status = 'Billed';
        order.paymentMethod = paymentMethod;
        order.paymentStatus = 'Completed';
        order.billedAt = new Date();
        order.revenue = order.finalAmount;
        await order.save();

        // Update table status
        const table = await Table.findById(order.tableId);
        if (table) {
            table.status = 'Billed';
            table.runningOrderAmount = order.finalAmount;
            await table.save();
        }

        // Emit real-time sales update
        const io = req.app.get('io');
        if (io) {
            io.emit('salesUpdated');
        }

        emitOrderRealtimeEvent(req, order, 'updated');

        res.status(200).json({
            success: true,
            message: 'Order billed successfully',
            data: order
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error billing order',
            error: error.message
        });
    }
};

// Send order to cashier (Pending Payment)
exports.sendToCashier = async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log(`[sendToCashier] Received request for orderId: ${orderId}`);

        const order = await GuestMealOrder.findById(orderId);
        if (!order) {
            console.log(`[sendToCashier] Order not found: ${orderId}`);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        console.log(`[sendToCashier] Updating order ${orderId} status to Pending Payment`);
        // Update order status
        order.status = 'Pending Payment';
        await order.save();

        // Update table status to indicate billing phase
        const table = await Table.findById(order.tableId);
        if (table) {
            console.log(`[sendToCashier] Updating table ${table.tableName} status to Running`);
            table.status = 'Running'; // Keeping it running until Cashier processes it
            await table.save();
        }

        emitOrderRealtimeEvent(req, order, 'updated');

        res.status(200).json({
            success: true,
            message: 'Order sent to cashier successfully',
            data: order
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error sending order to cashier',
            error: error.message
        });
    }
};

// Close order and reset table
exports.closeOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await GuestMealOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Update order status
        order.status = 'Closed';
        order.closedAt = new Date();
        await order.save();

        // Reset table
        const table = await Table.findById(order.tableId);
        if (table) {
            table.status = 'Available';
            table.currentOrderId = null;
            table.runningOrderAmount = 0;
            table.orderStartTime = null;
            table.orderDuration = 0;
            await table.save();
        }

        emitOrderRealtimeEvent(req, order, 'updated');

        res.status(200).json({
            success: true,
            message: 'Order closed and table reset successfully',
            data: {
                order,
                table
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error closing order',
            error: error.message
        });
    }
};

// Get all orders (for View Order page - Active/Billed)
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await GuestMealOrder.find({})
            .populate('tableId')
            .sort({ createdAt: -1 })
            .limit(500);

        res.status(200).json({
            success: true,
            data: orders,
            count: orders.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching orders',
            error: error.message
        });
    }
};

// Guest cancellation from QR flow.
exports.cancelOrderByGuest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const guestAccessPayload = readGuestAccessPayload(req);

        if (!guestAccessPayload) {
            return res.status(401).json({
                success: false,
                message: 'Guest access token missing or expired. Please scan QR again.'
            });
        }

        const order = await GuestMealOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!isGuestAllowedForOrder(guestAccessPayload, order)) {
            return res.status(403).json({ success: false, message: 'Access denied for this order.' });
        }

        const currentStatus = String(order.status || '').trim();
        const cancellableStatuses = ['Pending', 'Active', 'Preparing'];
        if (!cancellableStatuses.includes(currentStatus)) {
            return res.status(409).json({
                success: false,
                message: 'Order cannot be cancelled once it is Ready or beyond.'
            });
        }

        order.status = 'Cancelled';
        order.notes = [order.notes, '[Guest Cancelled]'].filter(Boolean).join(' | ');
        await order.save();

        emitOrderRealtimeEvent(req, order, 'updated');

        return res.status(200).json({
            success: true,
            message: 'Order cancelled successfully.',
            data: order
        });
    } catch (error) {
        console.error('Error cancelling order by guest:', error);
        return res.status(500).json({
            success: false,
            message: 'Error cancelling order',
            error: error.message
        });
    }
};

// Update order status — unified handler for ViewOrderPage and RoomService
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        let { status } = req.body;

        // Accept UI alias used in some screens and map it to persisted status.
        if (status === 'In Service') {
            status = 'Started';
        }

        const validStatuses = ['Pending', 'Active', 'Preparing', 'Ready', 'Started', 'Served', 'Pending Payment', 'Billed', 'Closed', 'Cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status: "${status}". Valid: ${validStatuses.join(', ')}`
            });
        }

        const order = await GuestMealOrder.findById(orderId).lean();
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const statusUpdate = { status };
        if (status === 'Closed') statusUpdate.closedAt = new Date();
        if (status === 'Billed') statusUpdate.billedAt = new Date();

        // Atomic update avoids failing on unrelated legacy-field validations.
        const updatedOrder = await GuestMealOrder.findByIdAndUpdate(
            orderId,
            { $set: statusUpdate },
            { new: true, runValidators: false }
        );

        // Sync table status if linked. Never fail status update on legacy table-link issues.
        if (updatedOrder?.tableId) {
            try {
                const tableIdValue = String(updatedOrder.tableId);

                if (mongoose.Types.ObjectId.isValid(tableIdValue)) {
                    const table = await Table.findById(tableIdValue);
                    if (table) {
                        let shouldSaveTable = false;

                        if (status === 'Billed' && table.status !== 'Billed') {
                            table.status = 'Billed';
                            shouldSaveTable = true;
                        } else if (status === 'Closed') {
                            if (table.status !== 'Available') {
                                table.status = 'Available';
                                shouldSaveTable = true;
                            }
                            if (table.currentOrderId) {
                                table.currentOrderId = null;
                                shouldSaveTable = true;
                            }
                        }

                        if (shouldSaveTable) {
                            await table.save();
                        }
                    }
                } else {
                    console.warn(`Skipping table sync for order ${orderId}: invalid tableId ${tableIdValue}`);
                }
            } catch (tableSyncError) {
                console.error(`Table sync failed for order ${orderId}:`, tableSyncError.message);
            }
        }

        emitOrderRealtimeEvent(req, updatedOrder, 'updated');

        return res.status(200).json({
            success: true,
            message: `Order status updated to ${status}`,
            data: updatedOrder
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: `Error updating order status: ${error.message}`,
            error: error.message
        });
    }
};

// ============================================================================
// ANALYTICS & REPORTING
// ============================================================================

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
    try {
        const totalTables = await Table.countDocuments();
        const availableTables = await Table.countDocuments({ status: 'Available' });
        const runningTables = await Table.countDocuments({ status: 'Running' });
        const billedTables = await Table.countDocuments({ status: 'Billed' });

        // Get today's revenue
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayClosed = await GuestMealOrder.find({
            status: 'Closed',
            closedAt: { $gte: today }
        });

        const totalRevenue = todayClosed.reduce((sum, order) => sum + order.revenue, 0);
        const totalOrders = await GuestMealOrder.countDocuments({ status: 'Closed', closedAt: { $gte: today } });

        // Calculate payment breakdowns for today
        const collections = {
            Cash: 0,
            UPI: 0,
            Card: 0,
            Online: 0,
            Room: 0
        };

        todayClosed.forEach(order => {
            const method = order.paymentMethod;
            if (method && collections.hasOwnProperty(method)) {
                collections[method] += order.finalAmount || 0;
            } else if (method === 'Room Billing') {
                collections.Room += order.finalAmount || 0;
            }
        });

        res.status(200).json({
            success: true,
            data: {
                totalTables,
                availableTables,
                runningTables,
                billedTables,
                totalRevenue,
                totalOrders,
                collections
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard stats',
            error: error.message
        });
    }
};

// Get POS stats per order type (for FoodOrderPage live stats)
exports.getPosStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const runningStatuses = ['Pending', 'Active', 'Preparing', 'Ready', 'Started', 'Pending Payment', 'Served'];

        // Order type groupings
        const typeMap = {
            dinein: { $in: ['Dine-In', 'Direct Payment'] },
            takeaway: 'Take Away',
            online: { $in: ['Online', 'Delivery'] },
            roomservice: { $in: ['Post to Room', 'Room Order', 'Room Service'] }
        };

        const results = {};

        for (const [key, typeFilter] of Object.entries(typeMap)) {
            const typeQuery = typeof typeFilter === 'string' ? { orderType: typeFilter } : { orderType: typeFilter };

            // Today's closed sale
            const closedOrders = await GuestMealOrder.find({
                ...typeQuery,
                status: 'Closed',
                closedAt: { $gte: today }
            });
            const todaySale = closedOrders.reduce((sum, o) => sum + (o.finalAmount || o.revenue || 0), 0);

            // Running orders
            const runningOrders = await GuestMealOrder.find({
                ...typeQuery,
                status: { $in: runningStatuses }
            });
            const runningCount = runningOrders.length;
            const runningValue = runningOrders.reduce((sum, o) => sum + (o.finalAmount || o.subtotal || 0), 0);

            results[key] = {
                todaySale,
                runningCount,
                runningValue
            };
        }

        res.status(200).json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching POS stats',
            error: error.message
        });
    }
};

// Get all orders for room service view
exports.getRoomServiceOrders = async (req, res) => {
    try {
        // Find all active-like orders that are for rooms (Post to Room or linked to a room)
        const query = {
            status: { $in: ['Pending', 'Preparing', 'Ready', 'Started', 'Active', 'Pending Payment'] },
            orderType: 'Post to Room'
        };

        const orders = await GuestMealOrder.find(query)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching room service orders',
            error: error.message
        });
    }
};


// Get revenue report
exports.getRevenueReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const query = {
            status: 'Closed',
            closedAt: {
                $gte: new Date(startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
                $lte: new Date(endDate || new Date())
            }
        };

        const orders = await GuestMealOrder.find(query)
            .populate('tableId')
            .sort({ closedAt: -1 });

        const totalRevenue = orders.reduce((sum, order) => sum + order.revenue, 0);
        const totalOrders = orders.length;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Group by payment method
        const byPaymentMethod = {};
        orders.forEach(order => {
            const method = order.paymentMethod;
            if (!byPaymentMethod[method]) {
                byPaymentMethod[method] = { count: 0, amount: 0 };
            }
            byPaymentMethod[method].count += 1;
            byPaymentMethod[method].amount += order.revenue;
        });

        res.status(200).json({
            success: true,
            data: {
                totalRevenue,
                totalOrders,
                averageOrderValue,
                byPaymentMethod,
                orders
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching revenue report',
            error: error.message
        });
    }
};

// Get pending orders for Cashier View
exports.getPendingOrders = async (req, res) => {
    try {
        // Cashier should only receive orders explicitly sent via "Bill Details".
        // That transition sets status to 'Pending Payment'.
        const query = {
            status: 'Pending Payment'
        };

        const orders = await GuestMealOrder.find(query)
            .populate('tableId', 'tableNumber tableName') // Populate basic table info
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching pending orders',
            error: error.message
        });
    }
};

// Settle order (Cash, UPI, Card, or Post to Room)
exports.settleOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
    const { paymentMethod, paymentMode, amount, roomNumber, folioId, billingMeta, paymentSplits, performedBy } = req.body;

    const actorName = (typeof performedBy === 'string' && performedBy.trim())
        ? performedBy.trim()
        : (performedBy?.name || performedBy?.username || performedBy?.email || req.user?.name || req.user?.username || 'Cashier');

        const order = await GuestMealOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const toNum = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        };

        // Persist final bill breakup so reports can show exact Tax/Discount/Total.
        const applySettledBillMeta = () => {
            if (!billingMeta || typeof billingMeta !== 'object') return;

            const settledSubtotal = toNum(billingMeta.subtotal ?? order.subtotal);
            const settledFoodGst = toNum(billingMeta.taxAmount ?? billingMeta.foodGstAmount ?? order.tax);
            const settledServiceCharge = toNum(billingMeta.serviceChargeAmount ?? order.serviceChargeAmount);
            const settledDiscount = toNum(billingMeta.discountAmount ?? order.discountAmount);
            const settledGrandTotal = toNum(billingMeta.grandTotal ?? (settledSubtotal + settledFoodGst + settledServiceCharge));
            const settledNetPayable = toNum(billingMeta.netPayable ?? amount ?? order.finalAmount ?? (settledGrandTotal - settledDiscount));
            const combinedTax = Math.max(0, settledFoodGst + settledServiceCharge);

            order.subtotal = settledSubtotal;
            order.tax = combinedTax;
            order.discountAmount = settledDiscount;
            order.totalAmount = settledGrandTotal;
            order.finalAmount = settledNetPayable;
            order.taxRate = settledSubtotal > 0 ? ((combinedTax / settledSubtotal) * 100) : 0;

            if (billingMeta.discountMeta && typeof billingMeta.discountMeta === 'object') {
                order.discountMeta = billingMeta.discountMeta;
            }

            if (Array.isArray(billingMeta.discountHistory)) {
                order.discountHistory = billingMeta.discountHistory.slice(-20);
            } else if (billingMeta.currentDiscountEntry && typeof billingMeta.currentDiscountEntry === 'object') {
                const previousHistory = Array.isArray(order.discountHistory) ? order.discountHistory : [];
                order.discountHistory = [...previousHistory, billingMeta.currentDiscountEntry].slice(-20);
            }

            order.billing = {
                subtotal: settledSubtotal,
                tax: combinedTax,
                total: settledGrandTotal,
                balance: 0
            };
        };

        // 1. Handle "Post to Room" (Add to Folio)
        if (paymentMethod === 'Add to Room') {
            const Booking = require('../models/Booking');
            // Find active booking for this room - handle multiple in-house status variants
            const booking = await Booking.findOne({
                roomNumber: roomNumber,
                status: { $in: ['Checked-in', 'CheckedIn', 'IN_HOUSE', 'Checked-In'] }
            });

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: `No active check-in found for Room ${roomNumber}`
                });
            }

            // Build item summary and full billing detail for folio description
            const sourceItems = Array.isArray(billingMeta?.items) && billingMeta.items.length > 0
                ? billingMeta.items
                : (order.items || []).map(i => ({ name: i.name, quantity: i.quantity || 1, amount: i.subtotal || i.amount || 0 }));
            const itemSummary = sourceItems.map(i => `${i.name} x${i.quantity || 1}`).join(', ');
            const normalizedOrderType = String(order.orderType || '').toLowerCase().trim();
            const sourceOrderCategory = String(billingMeta?.sourceOrderCategory || '').toLowerCase().trim();
            const isRoomServiceSource = ['room service', 'room order'].includes(normalizedOrderType);
            const isPostToRoomSource = normalizedOrderType === 'post to room';
            const hasTableLink = Boolean(order.tableId) || Boolean(order.tableNumber);
            const hasRoomLink = Boolean(order.roomNumber);
            let sourceLabel = '';

            if (sourceOrderCategory === 'room') {
                sourceLabel = 'Room Service';
            } else if (sourceOrderCategory === 'table' && order.tableNumber) {
                sourceLabel = `Table ${order.tableNumber}`;
            } else if (isRoomServiceSource) {
                sourceLabel = 'Room Service';
            } else if (isPostToRoomSource && hasRoomLink && !hasTableLink) {
                // Orders raised directly from room service flow should show Room Service context.
                sourceLabel = 'Room Service';
            } else if (isPostToRoomSource && order.tableNumber) {
                sourceLabel = `Table ${order.tableNumber}`;
            } else if (order.tableNumber) {
                sourceLabel = `Table ${order.tableNumber}`;
            } else if (order.roomNumber) {
                sourceLabel = `Room ${order.roomNumber}`;
            }

            const grossTotal = Number(billingMeta?.grandTotal ?? order.finalAmount ?? 0) || 0;
            const discountAmount = Number(billingMeta?.discountAmount ?? 0) || 0;
            const netPayable = Number(amount ?? billingMeta?.netPayable ?? order.finalAmount ?? 0) || 0;
            const discountValue = Number(billingMeta?.discountValue ?? 0) || 0;
            const discountType = String(billingMeta?.discountType || 'PERCENTAGE');
            const discountSource = String(billingMeta?.discountSource || '').trim();
            const discountLabel = discountAmount > 0
                ? (discountSource
                    ? `${discountSource} (${discountType === 'PERCENTAGE' ? `${discountValue}%` : `Rs ${discountValue.toFixed(2)}`})`
                    : (discountType === 'PERCENTAGE' ? `${discountValue}%` : `Rs ${discountValue.toFixed(2)}`))
                : 'No discount';
            const folioAmount = amount || order.finalAmount;

            // Create folio transaction
            const transactionData = {
                type: 'Charge',
                particulars: 'Restaurant Bill',
                description: `${order.orderType || 'Dine-In'} ${sourceLabel ? `(${sourceLabel})` : ''} #${orderId.toString().substr(-6).toUpperCase()}${itemSummary ? ` | ${itemSummary}` : ''} | Gross: Rs ${grossTotal.toFixed(2)} | Discount: ${discountLabel} [Rs ${discountAmount.toFixed(2)}] | Net: Rs ${netPayable.toFixed(2)}`,
                amount: folioAmount,
                date: new Date(),
                day: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short' }),
                user: actorName,
                notes: `Restaurant Bill - ${orderId.toString().substr(-6).toUpperCase()} | Items: ${itemSummary || 'N/A'} | Gross: Rs ${grossTotal.toFixed(2)} | Discount: ${discountLabel} [Rs ${discountAmount.toFixed(2)}] | Net: Rs ${netPayable.toFixed(2)}`,
                folioId: folioId !== undefined ? parseInt(folioId) : 0 // User selected folio or default to Primary
            };

            // Apply automatic routing rules
            const { applyRoutingRules } = require('../utils/folioUtils');
            applyRoutingRules(booking, transactionData);

            // Add to transactions and update total billing
            booking.transactions.push(transactionData);

            // Reservation/Folio level audit trail for staff/admin action visibility.
            if (!booking.auditTrail) booking.auditTrail = [];
            booking.auditTrail.push({
                action: 'CASHIER_POST_TO_FOLIO',
                description: `Cashier posted restaurant bill to folio (Order #${orderId.toString().substr(-6).toUpperCase()}, Room ${roomNumber}, Amount Rs ${folioAmount}).`,
                performedBy: actorName,
                performedAt: new Date(),
                metadata: {
                    source: 'Cashier Section',
                    orderId,
                    roomNumber,
                    folioId: folioId !== undefined ? parseInt(folioId) : 0,
                    grossTotal,
                    discountAmount,
                    netPayable,
                    paymentMethod,
                    paymentMode,
                    itemSummary
                }
            });

            // Increment total amount - hooks should handle it, but we update explicit mapping here
            if (!booking.billing) booking.billing = {};
            // The pre('save') hook in Booking.js will recalculate totalAmount correctly from transactions

            await booking.save();

            order.paymentMethod = 'Room Billing';
            order.paymentStatus = 'Completed';
            applySettledBillMeta();
        } else {
            // 2. Handle Direct Payment
            const normalizePaymentMethod = (method) => {
                if (!method) return 'Cash';
                const lower = String(method).toLowerCase().trim();
                if (lower === 'cash') return 'Cash';
                if (lower === 'card') return 'Card';
                if (lower === 'upi') return 'UPI';
                if (lower.includes('bank') || lower.includes('transfer')) return 'Bank Transfer';
                if (lower === 'cheque' || lower === 'check') return 'Cheque';
                if (lower === 'credit') return 'Credit';
                return 'Cash';
            };

            const normalizedSplits = Array.isArray(paymentSplits)
                ? paymentSplits
                    .map(split => ({
                        mode: normalizePaymentMethod(split?.mode),
                        amount: Number(split?.amount || 0)
                    }))
                    .filter(split => split.amount > 0)
                : [];

            const isSplitPayment = normalizedSplits.length > 0;
            if (isSplitPayment) {
                const splitTotal = normalizedSplits.reduce((sum, split) => sum + split.amount, 0);
                const payableAmount = Number(amount || order.finalAmount || 0);
                if (Math.abs(splitTotal - payableAmount) > 0.01) {
                    return res.status(400).json({
                        success: false,
                        message: `Split total (${splitTotal.toFixed(2)}) must match payable amount (${payableAmount.toFixed(2)})`
                    });
                }
            }

            order.paymentMethod = isSplitPayment ? 'Mixed' : paymentMode; // Cash, Card, UPI, or Mixed
            order.paymentStatus = 'Completed';
            applySettledBillMeta();

            // Also record in overall cashier Transaction model
            const Transaction = require('../models/Transaction');

            const createTransactionRecord = async (txnAmount, txnMode, index = 0) => {
                await Transaction.create({
                    date: new Date(),
                    type: 'Income',
                    category: 'Restaurant',
                    amount: txnAmount,
                    order: orderId, // Link to the order
                    referenceId: `TXN-${Date.now()}-${orderId.toString().substr(-6).toUpperCase()}${index > 0 ? `-${index}` : ''}`,
                    description: `Restaurant Bill - Table ${order.tableNumber || 'N/A'} - ${order.orderType || 'Dine-In'}${isSplitPayment ? ` [${txnMode}]` : ''}`,
                    paymentMethod: normalizePaymentMethod(txnMode)
                });
            };

            if (isSplitPayment) {
                for (let i = 0; i < normalizedSplits.length; i++) {
                    const split = normalizedSplits[i];
                    await createTransactionRecord(split.amount, split.mode, i + 1);
                }
            } else {
                await createTransactionRecord(amount || order.finalAmount, paymentMode, 0);
            }
        }

        // 3. Mark Order as Closed
        order.status = 'Closed';
        order.closedAt = new Date();
        order.revenue = order.finalAmount;
        // Keep cashier-settled values exact; avoid pre-save recalculation overriding billingMeta.
        order.$locals = order.$locals || {};
        order.$locals.skipFinancialRecalc = true;
        await order.save();

        // 4. Set to Billed (Custom User Flow: Billed means Payment Completed, waiting for table clear)
        const Table = require('../models/Table');
        const table = await Table.findById(order.tableId);
        if (table) {
            table.status = 'Billed';
            // Keeping currentOrderId so the table continues to show the billed amount until manually cleared
            await table.save();
        }

        emitOrderRealtimeEvent(req, order, 'updated');

        res.status(200).json({
            success: true,
            message: 'Order settled successfully',
            data: { order, table }
        });

    } catch (error) {
        console.error('Error settling order:', error);
        res.status(500).json({
            success: false,
            message: 'Error settling order',
            error: error.message
        });
    }
};

// Get live outlet status for dashboard
exports.getOutletStatus = async (req, res) => {
    try {
        console.log('[getOutletStatus] Fetching live status...');

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const pendingLikeStatuses = ['Active', 'Pending', 'Pending Payment'];
        const inProgressLikeStatuses = ['Active', 'Pending', 'Preparing', 'Started', 'Pending Payment'];
        const roomOrderTypes = ['Room Service', 'Room Order', 'Post to Room'];
        const takeAwayOrderTypes = ['Take Away', 'TakeAway'];
        const onlineOrderTypes = ['Online', 'Online Order', 'Delivery'];

        // ============ 1. DINE-IN (Tables) ============
        const totalTables = await Table.countDocuments();
        const occupiedTablesCount = await Table.countDocuments({ status: { $in: ['Running', 'Occupied', 'Billed'] } });
        const billedTables = await Table.countDocuments({ status: 'Billed' });
        const availableTables = Math.max(0, totalTables - occupiedTablesCount);

        // Dine-In Kitchen Stats
        const dineInPending = await GuestMealOrder.countDocuments({
            status: { $in: pendingLikeStatuses },
            orderType: { $nin: [...roomOrderTypes, ...takeAwayOrderTypes, ...onlineOrderTypes] }
        });
        const dineInPreparing = await GuestMealOrder.countDocuments({
            status: { $in: ['Preparing', 'Started'] },
            orderType: { $nin: [...roomOrderTypes, ...takeAwayOrderTypes, ...onlineOrderTypes] }
        });
        const dineInReady = await GuestMealOrder.countDocuments({
            status: 'Ready',
            orderType: { $nin: [...roomOrderTypes, ...takeAwayOrderTypes, ...onlineOrderTypes] }
        });

        // Dine-In Avg Prep Time (Include 'Ready' and 'Closed')
        const recentDineIn = await GuestMealOrder.find({
            status: { $in: ['Closed', 'Ready', 'Served', 'Billed'] },
            updatedAt: { $gte: dayAgo },
            orderType: { $nin: [...roomOrderTypes, ...takeAwayOrderTypes, ...onlineOrderTypes] }
        });
        let diPrepTotal = 0, diPrepCount = 0;
        recentDineIn.forEach(o => {
            if (o.updatedAt && o.createdAt) {
                const t = (o.updatedAt - o.createdAt) / 60000;
                if (t > 0 && t < 180) { diPrepTotal += t; diPrepCount++; }
            }
        });
        const diAvgPrep = diPrepCount > 0 ? Math.round(diPrepTotal / diPrepCount) : 0;

        // Dine-In Load Assessment
        let diLoad = 'Low', diStaff = 'Normal', diRisk = 'Minimal';
        const diActive = dineInPending + dineInPreparing;
        if (diActive > 15) { diLoad = 'High'; diStaff = 'Busy'; diRisk = 'High'; }
        else if (diActive > 7) { diLoad = 'Moderate'; diStaff = 'Active'; diRisk = 'Moderate'; }

        // ============ 2. ROOM SERVICE ============
        const occupiedRoomsCount = await Room.countDocuments({ status: { $in: ['Occupied', 'Booked'] } });

        const roomPending = await GuestMealOrder.countDocuments({
            status: { $in: pendingLikeStatuses },
            orderType: { $in: roomOrderTypes }
        });
        const roomPreparing = await GuestMealOrder.countDocuments({
            status: { $in: ['Preparing', 'Started'] },
            orderType: { $in: roomOrderTypes }
        });
        const roomReady = await GuestMealOrder.countDocuments({
            status: 'Ready',
            orderType: { $in: roomOrderTypes }
        });

        // Room Service Avg Prep Time (Include 'Ready', 'Closed', 'Served')
        const recentRoom = await GuestMealOrder.find({
            status: { $in: ['Closed', 'Ready', 'Served', 'Billed'] },
            updatedAt: { $gte: dayAgo },
            orderType: { $in: roomOrderTypes }
        });
        let rmPrepTotal = 0, rmPrepCount = 0;
        recentRoom.forEach(o => {
            if (o.updatedAt && o.createdAt) {
                const t = (o.updatedAt - o.createdAt) / 60000;
                if (t > 0 && t < 180) { rmPrepTotal += t; rmPrepCount++; }
            }
        });
        const rmAvgPrep = rmPrepCount > 0 ? Math.round(rmPrepTotal / rmPrepCount) : 0;

        // Room Service Load Assessment
        let rmLoad = 'Low', rmStaff = 'Normal', rmRisk = 'Minimal';
        const rmActive = roomPending + roomPreparing;
        if (rmActive > 10) { rmLoad = 'High'; rmStaff = 'Busy'; rmRisk = 'High'; }
        else if (rmActive > 5) { rmLoad = 'Moderate'; rmStaff = 'Active'; rmRisk = 'Moderate'; }

        // ============ 3. TAKE AWAY ============
        const taPending = await GuestMealOrder.countDocuments({
            orderType: { $in: takeAwayOrderTypes },
            status: { $in: inProgressLikeStatuses }
        });
        const taReady = await GuestMealOrder.countDocuments({
            orderType: { $in: takeAwayOrderTypes },
            status: 'Ready'
        });
        const taClosedToday = await GuestMealOrder.countDocuments({
            orderType: { $in: takeAwayOrderTypes },
            status: 'Closed',
            updatedAt: { $gte: startOfDay, $lte: endOfDay }
        });
        const taTotalToday = taPending + taReady + taClosedToday;
        const taCompletionRate = taTotalToday > 0 ? Math.round(((taTotalToday - taPending) / taTotalToday) * 100) : 0;

        // Take Away Kitchen Stats
        const taKOTPending = await GuestMealOrder.countDocuments({
            status: { $in: pendingLikeStatuses },
            orderType: { $in: takeAwayOrderTypes }
        });
        const taKOTPreparing = await GuestMealOrder.countDocuments({
            status: { $in: ['Preparing', 'Started'] },
            orderType: { $in: takeAwayOrderTypes }
        });

        // Take Away Avg Prep Time (Include 'Ready', 'Closed', 'Picked Up')
        const recentTA = await GuestMealOrder.find({
            status: { $in: ['Closed', 'Ready', 'PickedUp', 'Served', 'Billed'] },
            updatedAt: { $gte: dayAgo },
            orderType: { $in: takeAwayOrderTypes }
        });
        let taPrepTotal = 0, taPrepCount = 0;
        recentTA.forEach(o => {
            if (o.updatedAt && o.createdAt) {
                const t = (o.updatedAt - o.createdAt) / 60000;
                if (t > 0 && t < 180) { taPrepTotal += t; taPrepCount++; }
            }
        });
        const taAvgPrep = taPrepCount > 0 ? Math.round(taPrepTotal / taPrepCount) : 0;

        // Take Away Load Assessment
        let taLoad = 'Low', taStaff = 'Normal', taRisk = 'Minimal';
        if (taPending > 10) { taLoad = 'High'; taStaff = 'Busy'; taRisk = 'High'; }
        else if (taPending > 5) { taLoad = 'Moderate'; taStaff = 'Active'; taRisk = 'Moderate'; }

        // ============ 4. ONLINE ORDER ============
        const onlinePending = await GuestMealOrder.countDocuments({
            orderType: { $in: onlineOrderTypes },
            status: { $in: inProgressLikeStatuses }
        });
        const onlineReady = await GuestMealOrder.countDocuments({
            orderType: { $in: onlineOrderTypes },
            status: 'Ready'
        });
        const onlineClosedToday = await GuestMealOrder.countDocuments({
            orderType: { $in: onlineOrderTypes },
            status: 'Closed',
            updatedAt: { $gte: startOfDay, $lte: endOfDay }
        });
        const onlineTotalToday = onlinePending + onlineReady + onlineClosedToday;
        const onlineCompletionRate = onlineTotalToday > 0
            ? Math.round(((onlineTotalToday - onlinePending) / onlineTotalToday) * 100)
            : 0;

        const onlineKOTPreparing = await GuestMealOrder.countDocuments({
            orderType: { $in: onlineOrderTypes },
            status: { $in: ['Preparing', 'Started'] }
        });

        const recentOnline = await GuestMealOrder.find({
            status: { $in: ['Closed', 'Ready', 'PickedUp', 'Served', 'Billed'] },
            updatedAt: { $gte: dayAgo },
            orderType: { $in: onlineOrderTypes }
        });
        let onlinePrepTotal = 0, onlinePrepCount = 0;
        recentOnline.forEach(o => {
            if (o.updatedAt && o.createdAt) {
                const t = (o.updatedAt - o.createdAt) / 60000;
                if (t > 0 && t < 180) { onlinePrepTotal += t; onlinePrepCount++; }
            }
        });
        const onlineAvgPrep = onlinePrepCount > 0 ? Math.round(onlinePrepTotal / onlinePrepCount) : 0;

        let onlineLoad = 'Low', onlineStaff = 'Normal', onlineRisk = 'Minimal';
        if (onlinePending > 10) { onlineLoad = 'High'; onlineStaff = 'Busy'; onlineRisk = 'High'; }
        else if (onlinePending > 5) { onlineLoad = 'Moderate'; onlineStaff = 'Active'; onlineRisk = 'Moderate'; }

        console.log(`[getOutletStatus] Tables=${totalTables}, Occupied=${occupiedTablesCount}, RoomOccupied=${occupiedRoomsCount}, RoomPending=${roomPending}, TAPending=${taPending}, OnlinePending=${onlinePending}`);

        res.status(200).json({
            success: true,
            data: {
                tables: {
                    total: totalTables,
                    occupied: occupiedTablesCount,
                    available: availableTables
                },
                rooms: {
                    total: occupiedRoomsCount,
                    occupied: occupiedRoomsCount,
                    pendingOrders: roomPending,
                    available: 0
                },
                takeAway: {
                    total: taTotalToday,
                    pending: taPending,
                    ready: taReady,
                    completionRate: taCompletionRate
                },
                online: {
                    total: onlineTotalToday,
                    pending: onlinePending,
                    ready: onlineReady,
                    completed: onlineClosedToday,
                    completionRate: onlineCompletionRate
                },
                kitchen: {
                    pending: dineInPending,
                    preparing: dineInPreparing,
                    ready: dineInReady,
                    avgPrepTime: diAvgPrep,
                    load: diLoad,
                    staffLoad: diStaff,
                    delayRisk: diRisk
                },
                roomKitchen: {
                    pending: roomPending,
                    preparing: roomPreparing,
                    ready: roomReady,
                    avgPrepTime: rmAvgPrep,
                    load: rmLoad,
                    staffLoad: rmStaff,
                    delayRisk: rmRisk
                },
                taKitchen: {
                    pending: taKOTPending,
                    preparing: taKOTPreparing,
                    ready: taReady,
                    avgPrepTime: taAvgPrep,
                    load: taLoad,
                    staffLoad: taStaff,
                    delayRisk: taRisk
                },
                onlineKitchen: {
                    pending: onlinePending,
                    preparing: onlineKOTPreparing,
                    ready: onlineReady,
                    avgPrepTime: onlineAvgPrep,
                    load: onlineLoad,
                    staffLoad: onlineStaff,
                    delayRisk: onlineRisk
                }
            }
        });
    } catch (error) {
        console.error('[getOutletStatus] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching outlet status',
            error: error.message
        });
    }
};

// Delete order
exports.deleteOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log(`[deleteOrder] Request to delete order: ${orderId}`);

        if (!orderId || !orderId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ success: false, message: 'Invalid Order ID format' });
        }

        const order = await GuestMealOrder.findById(orderId);
        if (!order) {
            console.log(`[deleteOrder] Order not found: ${orderId}`);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // If order is active and linked to a table, release the table
        if (order.tableId && (['Active', 'Pending', 'Preparing', 'Ready'].includes(order.status))) {
            try {
                const table = await Table.findById(order.tableId);
                if (table) {
                    console.log(`[deleteOrder] Releasing table: ${table.tableName}`);
                    table.status = 'Available';
                    table.currentOrderId = null;
                    table.runningOrderAmount = 0;
                    table.orderStartTime = null;
                    await table.save();
                }
            } catch (tableErr) {
                console.error(`[deleteOrder] Error releasing table:`, tableErr);
                // We continue deleting the order even if table release fails
            }
        }

        await GuestMealOrder.findByIdAndDelete(orderId);
        console.log(`[deleteOrder] Order deleted successfully: ${orderId}`);

        emitOpsNotification(req, {
            eventId: `order-${String(orderId)}-deleted-${Date.now()}`,
            module: 'orders',
            entity: 'order',
            entityId: String(orderId),
            title: 'Order Removed',
            message: `Order #${String(orderId).slice(-6).toUpperCase()} was deleted.`,
            data: {
                _id: String(orderId),
                status: 'Deleted',
                orderType: order.orderType,
                roomNumber: order.roomNumber,
                tableNumber: order.tableNumber,
                guestName: order.guestName,
                createdAt: order.createdAt,
                updatedAt: new Date().toISOString(),
            },
        });

        res.status(200).json({
            success: true,
            message: 'Order deleted successfully'
        });
    } catch (error) {
        console.error('[deleteOrder] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting order: ' + error.message
        });
    }
};
