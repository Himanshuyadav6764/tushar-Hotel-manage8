const Table = require('../models/Table');
const GuestMealOrder = require('../models/Order');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Fetch all tables
exports.getAllTables = async (req, res) => {
    try {
        const tables = await Table.find().sort({ tableNumber: 1 });

        // Log unique types
        const uniqueTypes = [...new Set(tables.map(t => t.type || 'General'))];
        console.log('📊 Fetching tables - Total:', tables.length, '| Types:', uniqueTypes);

        res.status(200).json({ success: true, count: tables.length, data: tables });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// Create a new table
exports.createTable = async (req, res) => {
    try {
        const { tableName, type, capacity, tableNumber, status } = req.body;

        // Validate required fields
        if (!tableName || !tableName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Table name is required'
            });
        }

        const tableType = type || 'General';

        // Check if table name already exists in the same type
        const existingTable = await Table.findOne({
            tableName: new RegExp(`^${tableName.trim()}$`, 'i'),
            type: tableType
        });

        if (existingTable) {
            return res.status(400).json({
                success: false,
                message: `Table "${tableName}" already exists in "${tableType}" type. Same table names are allowed in different types.`
            });
        }

        // Create table
        const newTable = await Table.create({
            tableName: tableName.trim(),
            type: tableType,
            capacity: capacity || 4,
            tableNumber: tableNumber || Date.now(),
            status: status || 'Available'
        });

        console.log('✅ Table created:', {
            tableName: newTable.tableName,
            type: newTable.type,
            capacity: newTable.capacity
        });

        res.status(201).json({ success: true, data: newTable });
    } catch (error) {
        console.error('Create table error:', error);

        // Handle MongoDB duplicate key error (E11000)
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0];
            if (field === 'tableName' || error.keyPattern?.tableName) {
                const tableName = error.keyValue?.tableName;
                const type = error.keyValue?.type || 'General';
                return res.status(400).json({
                    success: false,
                    message: `Table "${tableName}" already exists in "${type}" type.`
                });
            }
            return res.status(400).json({
                success: false,
                message: 'A table with this information already exists.'
            });
        }

        res.status(400).json({
            success: false,
            message: 'Error creating table',
            error: error.message
        });
    }
};

// Add Reservation to Table
exports.addReservation = async (req, res) => {
    try {
        const { tableId } = req.params;
        const { guestName, guestPhone, date, startTime, endTime, guests, note, source, advancePayment } = req.body;

        // Validation
        if (!guestPhone || guestPhone.length !== 10) {
            return res.status(400).json({ success: false, message: 'Phone number must be 10 digits' });
        }
        // Time Logic Fix for Midnight crossover
        const isEndNextDay = endTime < startTime;
        
        // If it's the same day, end must be after start. 
        // If it's next day, it's valid if they are different (00:00 vs 23:00 etc)
        if (!isEndNextDay && endTime === startTime) {
            return res.status(400).json({ success: false, message: 'End time must be after start time' });
        }

        const table = await Table.findById(tableId);
        if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

        if (guests > table.capacity) {
            return res.status(400).json({ success: false, message: `Guests exceed table capacity of ${table.capacity}` });
        }

        // Time Conflict Check
        const hasConflict = table.reservations.some(res => {
            if (res.date !== date) return false;
            // Only conflict with non-cancelled ones
            if (res.status === 'Cancelled') return false;
            return (startTime < res.endTime && endTime > res.startTime);
        });

        if (hasConflict) {
            return res.status(409).json({ success: false, message: 'Table already reserved for this time slot' });
        }

        // Add Reservation
        const newReservation = {
            id: new Date().getTime().toString(),
            name: guestName,
            phone: guestPhone,
            date,
            startTime,
            endTime,
            guests,
            note,
            source: source || 'Phone',
            advancePayment: Number(advancePayment) || 0,
            status: 'Upcoming'
        };

        table.reservations.push(newReservation);
        table.reservations.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startTime.localeCompare(b.startTime);
        });

        await table.save();
        res.status(200).json({ success: true, message: 'Table reserved successfully', data: table });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// Update Reservation Status (Arrived, No Show, Cancelled, etc)
exports.updateReservationStatus = async (req, res) => {
    try {
        const { tableId, reservationId } = req.params;
        const { status } = req.body;

        const table = await Table.findById(tableId);
        if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

        const resIdx = table.reservations.findIndex(r => r.id === reservationId);
        if (resIdx === -1) return res.status(404).json({ success: false, message: 'Reservation not found' });

        table.reservations[resIdx].status = status;
        await table.save();

        res.status(200).json({ success: true, message: `Reservation status updated to ${status}`, data: table });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// Cancel Reservation (Instead of permanent deletion, just mark as Cancelled for reports)
exports.cancelReservation = async (req, res) => {
    try {
        const { tableId, reservationId } = req.params;
        const table = await Table.findById(tableId);

        if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

        // User says "delete" should be "cancelled". 
        // We find and update status.
        const resIdx = table.reservations.findIndex(r => r.id === reservationId);
        if (resIdx !== -1) {
            table.reservations[resIdx].status = 'Cancelled';
            await table.save();
            return res.status(200).json({ success: true, message: 'Reservation marked as Cancelled', data: table });
        }

        res.status(404).json({ success: false, message: 'Reservation not found' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// Update table status
exports.updateTableStatus = async (req, res) => {
    try {
        const { tableId } = req.params;
        const { status } = req.body;

        const table = await Table.findByIdAndUpdate(tableId, { status }, { new: true });

        if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

        res.status(200).json({ success: true, data: table });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// Split one table into multiple sub tables.
exports.splitTable = async (req, res) => {
    try {
        const { tableId } = req.params;
        const { subTables = [] } = req.body || {};

        if (!Array.isArray(subTables) || subTables.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'At least 2 sub-tables are required for split'
            });
        }

        const table = await Table.findById(tableId);
        if (!table) {
            return res.status(404).json({ success: false, message: 'Table not found' });
        }

        let hasActiveOrder = false;
        if (table.currentOrderId) {
            const order = await GuestMealOrder.findById(table.currentOrderId).select('status').lean();
            const activeOrderStatuses = ['Pending', 'Active', 'Confirmed', 'Preparing', 'Ready', 'Started', 'Served', 'Pending Payment', 'Billed'];
            hasActiveOrder = !!(order && activeOrderStatuses.includes(order.status));

            // Auto-clean stale order link when order is already closed/completed/cancelled.
            if (!hasActiveOrder) {
                table.currentOrderId = null;
                table.runningOrderAmount = 0;
                table.guests = 0;
                table.orderStartTime = null;
                if (table.status !== 'Available') table.status = 'Available';
                await table.save();
            }
        }

        if (hasActiveOrder || (table.runningOrderAmount || 0) > 0 || ['Running', 'Occupied', 'Billed'].includes(table.status)) {
            return res.status(400).json({
                success: false,
                message: 'Only free tables can be split. Please close active order first.'
            });
        }

        const normalizedSubTables = subTables.map((item) => ({
            name: String(item?.name || '').trim(),
            guests: Number(item?.guests) || 0,
            waiter: String(item?.waiter || '').trim()
        }));

        const invalidRow = normalizedSubTables.find((item) => !item.name || item.guests < 1);
        if (invalidRow) {
            return res.status(400).json({
                success: false,
                message: 'Each sub-table must have a valid name and at least 1 seat'
            });
        }

        const totalSeats = normalizedSubTables.reduce((sum, item) => sum + item.guests, 0);
        if (totalSeats !== table.capacity) {
            return res.status(400).json({
                success: false,
                message: `Total split seats (${totalSeats}) must match table capacity (${table.capacity})`
            });
        }

        const duplicateInPayload = new Set();
        for (const item of normalizedSubTables) {
            const key = item.name.toLowerCase();
            if (duplicateInPayload.has(key)) {
                return res.status(400).json({
                    success: false,
                    message: `Duplicate sub-table name in split request: ${item.name}`
                });
            }
            duplicateInPayload.add(key);
        }

        for (const item of normalizedSubTables) {
            const nameRegex = new RegExp(`^${escapeRegex(item.name)}$`, 'i');
            const exists = await Table.findOne({
                _id: { $ne: table._id },
                tableName: nameRegex,
                type: table.type || 'General'
            }).lean();

            if (exists) {
                return res.status(409).json({
                    success: false,
                    message: `Table name "${item.name}" already exists in type "${table.type || 'General'}"`
                });
            }
        }

        const highestTable = await Table.findOne().sort({ tableNumber: -1 }).select('tableNumber').lean();
        let nextTableNumber = Number(highestTable?.tableNumber || 0) + 1;

        const childTablesPayload = normalizedSubTables.map((item) => ({
            tableName: item.name,
            tableNumber: nextTableNumber++,
            capacity: item.guests,
            guests: 0,
            status: 'Available',
            type: table.type || 'General',
            location: table.location || 'Main Hall',
            assignedWaiter: item.waiter || '',
            isSplitChild: true,
            parentTableName: table.tableName
        }));

        const created = await Table.insertMany(childTablesPayload);
        await Table.findByIdAndDelete(table._id);

        return res.status(200).json({
            success: true,
            message: `Table ${table.tableName} split into ${created.length} sub-tables`,
            data: created
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Close split group and restore parent table.
exports.closeSplitTable = async (req, res) => {
    try {
        const { tableId } = req.params;
        const selectedTable = await Table.findById(tableId);

        if (!selectedTable) {
            return res.status(404).json({ success: false, message: 'Table not found' });
        }

        if (!selectedTable.isSplitChild || !selectedTable.parentTableName) {
            return res.status(400).json({
                success: false,
                message: 'Selected table is not a split child table'
            });
        }

        const parentTableName = String(selectedTable.parentTableName).trim();
        const splitChildren = await Table.find({
            isSplitChild: true,
            parentTableName
        });

        if (!splitChildren.length) {
            return res.status(404).json({
                success: false,
                message: 'No split child tables found for this parent'
            });
        }

        const activeOrderStatuses = ['Pending', 'Active', 'Confirmed', 'Preparing', 'Ready', 'Started', 'Served', 'Pending Payment', 'Billed'];
        const busyTables = [];

        for (const child of splitChildren) {
            let hasActiveOrder = false;
            if (child.currentOrderId) {
                const order = await GuestMealOrder.findById(child.currentOrderId).select('status').lean();
                hasActiveOrder = !!(order && activeOrderStatuses.includes(order.status));

                // Auto-clean stale order link if order is already closed/completed/cancelled.
                if (!hasActiveOrder) {
                    child.currentOrderId = null;
                    child.runningOrderAmount = 0;
                    child.guests = 0;
                    child.orderStartTime = null;
                }
            }

            const normalizedStatus = String(child.status || '').toLowerCase();
            const isBusyStatus = ['running', 'occupied', 'billed'].includes(normalizedStatus);
            const hasAmount = Number(child.runningOrderAmount || 0) > 0;

            if (hasActiveOrder || isBusyStatus || hasAmount) {
                busyTables.push(child);
                continue;
            }

            if (child.status !== 'Available') {
                child.status = 'Available';
            }
            await child.save();
        }

        if (busyTables.length > 0) {
            return res.status(409).json({
                success: false,
                message: `Cannot close split while tables are active: ${busyTables.map((t) => t.tableName).join(', ')}`
            });
        }

        const parentAlreadyExists = await Table.findOne({
            tableName: new RegExp(`^${escapeRegex(parentTableName)}$`, 'i'),
            type: selectedTable.type || 'General',
            isSplitChild: { $ne: true }
        }).lean();

        if (parentAlreadyExists) {
            await Table.deleteMany({ _id: { $in: splitChildren.map((child) => child._id) } });
            return res.status(200).json({
                success: true,
                message: `Split already closed. Parent table ${parentTableName} is available.`,
                data: parentAlreadyExists
            });
        }

        const totalCapacity = splitChildren.reduce((sum, child) => sum + Number(child.capacity || 0), 0);
        const highestTable = await Table.findOne().sort({ tableNumber: -1 }).select('tableNumber').lean();
        const nextTableNumber = Number(highestTable?.tableNumber || 0) + 1;

        const restoredParent = await Table.create({
            tableName: parentTableName,
            tableNumber: nextTableNumber,
            capacity: totalCapacity,
            guests: 0,
            status: 'Available',
            type: selectedTable.type || 'General',
            location: selectedTable.location || 'Main Hall',
            assignedWaiter: '',
            isSplitChild: false,
            parentTableName: ''
        });

        await Table.deleteMany({ _id: { $in: splitChildren.map((child) => child._id) } });

        return res.status(200).json({
            success: true,
            message: `Split closed successfully. Restored table ${parentTableName}`,
            data: restoredParent
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
