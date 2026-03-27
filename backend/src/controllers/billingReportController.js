const Order = require('../models/Order');

const ORDER_TYPE_ALIASES = {
    'Dine-In': ['Dine-In', 'Table Order', 'Table', 'Direct Payment', 'Dine In'],
    'Take Away': ['Take Away', 'TakeAway', 'Take-Away'],
    'Room Service': ['Room Service', 'Room Order', 'Post to Room'],
    'Delivery': ['Delivery'],
    'Online': ['Online', 'Online Order']
};

const normalizeValue = (value) => String(value || '').trim().toLowerCase();

const normalizePaymentMode = (mode) => {
    const normalized = normalizeValue(mode);
    if (!normalized) return 'Cash';
    if (normalized.includes('mixed') || normalized.includes('multiple')) return 'Mixed';
    if (normalized.includes('upi')) return 'UPI';
    if (normalized.includes('card')) return 'Card';
    if (normalized.includes('bank') || normalized.includes('transfer')) return 'Bank Transfer';
    if (normalized.includes('room')) return 'Add to Room';
    if (normalized.includes('cash')) return 'Cash';
    return 'Cash';
};

const extractPaymentAllocations = (order, fallbackAmount = 0) => {
    const splits = Array.isArray(order?.paymentSplits) ? order.paymentSplits : [];
    const normalizedSplits = splits
        .map(split => ({
            mode: normalizePaymentMode(split?.mode || split?.method || split?.paymentMode),
            amount: Number(split?.amount) || 0
        }))
        .filter(split => split.amount > 0);

    if (normalizedSplits.length > 0) {
        return normalizedSplits;
    }

    const normalizedMethod = normalizePaymentMode(order?.paymentMethod || 'Cash');
    if (normalizedMethod === 'Mixed') {
        return [{
            mode: 'Mixed',
            amount: Number(fallbackAmount) || 0
        }];
    }

    return [{
        mode: normalizedMethod,
        amount: Number(fallbackAmount) || 0
    }];
};

const formatPaymentDisplay = (order, fallbackAmount = 0) => {
    const allocations = extractPaymentAllocations(order, fallbackAmount);
    const splitModes = allocations.filter(entry => entry.mode !== 'Mixed' && entry.amount > 0);

    if (splitModes.length > 1) {
        const detail = splitModes
            .map(entry => `${entry.mode} ${entry.amount.toFixed(2)}`)
            .join(', ');
        return `Mixed (${detail})`;
    }

    if (splitModes.length === 1 && normalizePaymentMode(order?.paymentMethod) === 'Mixed') {
        return `Mixed (${splitModes[0].mode})`;
    }

    if (splitModes.length === 1) {
        return splitModes[0].mode;
    }

    return normalizePaymentMode(order?.paymentMethod || 'Pending');
};

const getNormalizedOrderType = (orderType) => {
    const normalized = normalizeValue(orderType);
    if (!normalized) return null;

    for (const [canonical, aliases] of Object.entries(ORDER_TYPE_ALIASES)) {
        if (aliases.some(alias => normalizeValue(alias) === normalized)) {
            return canonical;
        }
    }

    if (normalized.includes('room')) return 'Room Service';
    if (normalized.includes('take')) return 'Take Away';
    if (normalized.includes('online')) return 'Online';
    if (normalized.includes('deliver')) return 'Delivery';
    if (normalized.includes('dine') || normalized.includes('table') || normalized.includes('direct')) return 'Dine-In';

    return null;
};

const getOrderTypeFilterValues = (orderTypeFilter) => {
    const normalizedFilter = getNormalizedOrderType(orderTypeFilter);
    if (!normalizedFilter) return null;
    return ORDER_TYPE_ALIASES[normalizedFilter] || [orderTypeFilter];
};

exports.getBillingReport = async (req, res) => {
    try {
        const { startDate, endDate, orderType, paymentMethod, cashier, status } = req.query;

        let start = new Date();
        start.setHours(0, 0, 0, 0);
        if (startDate && !isNaN(new Date(startDate))) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
        }

        let end = new Date();
        end.setHours(23, 59, 59, 999);
        if (endDate && !isNaN(new Date(endDate))) {
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        }

        const query = {
            createdAt: { $gte: start, $lte: end }
        };

        // Filters
        if (orderType && orderType !== 'All') {
            const typeFilters = getOrderTypeFilterValues(orderType);
            query.orderType = (typeFilters && typeFilters.length > 0)
                ? { $in: typeFilters }
                : orderType;
        }
        if (cashier && cashier !== 'All') {
            query.guestName = { $regex: cashier, $options: 'i' }; // In this schema, 'staff' isn't explicitly on Order, using guestName as a proxy for search or assuming search by staff name if available
        }
        if (status && status !== 'All') {
            query.status = status;
        }

        let orders = await Order.find(query).sort({ createdAt: -1 });

        if (paymentMethod && paymentMethod !== 'All') {
            const selectedMode = normalizePaymentMode(paymentMethod);
            orders = orders.filter(order => {
                const billTotal = order.finalAmount || order.totalAmount || 0;
                const allocations = extractPaymentAllocations(order, billTotal);
                if (selectedMode === 'Mixed') {
                    const explicitSplits = allocations.filter(entry => entry.mode !== 'Mixed' && entry.amount > 0);
                    return explicitSplits.length > 1 || normalizePaymentMode(order.paymentMethod) === 'Mixed';
                }
                return allocations.some(entry => entry.mode === selectedMode && entry.amount > 0);
            });
        }

        // Calculate Summaries
        let totalRevenue = 0;
        let totalBills = orders.length;
        let totalItemsSold = 0;
        let totalDiscounts = 0;
        let totalTaxes = 0;

        const paymentBreakdown = {
            Cash: 0,
            UPI: 0,
            Card: 0,
            'Bank Transfer': 0,
            'Add to Room': 0,
            Mixed: 0
        };

        const typeBreakdown = {
            'Dine-In': 0,
            'Take Away': 0,
            'Room Service': 0,
            'Delivery': 0,
            'Online': 0
        };

        const itemSales = {};
        const cancelledBills = [];

        orders.forEach(order => {
            const billTotal = order.finalAmount || order.totalAmount || 0;
            const billDiscount = order.discountAmount || 0;
            const billTax = order.tax || 0;

            if (order.status === 'Cancelled' || order.status === 'Void') {
                cancelledBills.push({
                    billNo: order._id.toString().substr(-6).toUpperCase(),
                    amount: billTotal,
                    reason: order.notes || 'Customer Request',
                    date: new Date(order.createdAt).toLocaleDateString() + ' ' + new Date(order.createdAt).toLocaleTimeString()
                });
            } else {
                totalRevenue += billTotal;
                totalDiscounts += billDiscount;
                totalTaxes += billTax;

                // Payment Breakdown
                const allocations = extractPaymentAllocations(order, billTotal);
                allocations.forEach(({ mode, amount }) => {
                    if (paymentBreakdown[mode] !== undefined) {
                        paymentBreakdown[mode] += amount;
                    } else {
                        paymentBreakdown['Cash'] += amount;
                    }
                });

                // Type Breakdown
                const normalizedType = getNormalizedOrderType(order.orderType);
                if (normalizedType && typeBreakdown[normalizedType] !== undefined) {
                    typeBreakdown[normalizedType] += billTotal;
                } else if (!order.orderType) {
                    typeBreakdown['Dine-In'] += billTotal;
                }
            }

            // Items Sold
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const qty = Number(item.quantity || item.qty || 1);
                    totalItemsSold += qty;

                    // Support multiple naming conventions
                    const itemName = (item.name || item.itemName || item.item_name || 'Item').toString().trim() || 'Item';
                    const itemCategory = (item.category || '-').toString().trim();
                    const itemPrice = Number(item.price || item.rate || 0);

                    if (!itemSales[itemName]) {
                        itemSales[itemName] = { quantity: 0, revenue: 0, category: itemCategory };
                    }
                    itemSales[itemName].quantity += qty;
                    itemSales[itemName].revenue += itemPrice * qty;
                });
            }
        });

        // Format Table Data
        const tableData = orders.map(order => ({
            billNo: `#${order._id.toString().substr(-6).toUpperCase()}`,
            date: new Date(order.createdAt).toLocaleDateString(),
            tableNo: order.tableNumber || order.roomNumber || 'W-In',
            items: (order.items || []).map(i => `${i.name || i.itemName || 'Item'} (x${i.quantity || i.qty || 1})`).join(', '),
            amount: order.subtotal || 0,
            tax: order.tax || 0,
            discount: order.discountAmount || 0,
            total: order.finalAmount || order.totalAmount || 0,
            payment: formatPaymentDisplay(order, order.finalAmount || order.totalAmount || 0),
            staff: order.guestName || 'Staff'
        }));

        // Top Selling Items
        const topSelling = Object.entries(itemSales)
            .map(([displayName, stats]) => ({
                name: displayName,
                itemName: displayName, // Add alias for frontend compatibility
                category: stats.category || '-',
                qty: stats.quantity,
                quantity: stats.quantity, // Add alias
                revenue: stats.revenue
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        res.json({
            success: true,
            summary: {
                totalBills,
                totalRevenue,
                avgBillValue: totalBills > 0 ? (totalRevenue / totalBills) : 0,
                totalItemsSold,
                totalDiscounts,
                totalTaxes
            },
            breakdowns: {
                payment: paymentBreakdown,
                orderType: typeBreakdown
            },
            tableData,
            topSelling,
            cancelledBills
        });

    } catch (error) {
        console.error('Error generating billing report:', error);
        res.status(500).json({ success: false, message: 'Failed to generate billing report' });
    }
};
