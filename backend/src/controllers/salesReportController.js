const GuestMealOrder = require('../models/Order');

const toNum = (value) => Number(value) || 0;

const normalizePaymentMode = (mode) => {
    const normalized = String(mode || '').trim().toLowerCase();
    if (!normalized) return 'Cash';
    if (normalized.includes('mixed') || normalized.includes('multiple')) return 'Mixed';
    if (normalized.includes('upi')) return 'UPI';
    if (normalized.includes('card')) return 'Card';
    if (normalized.includes('bank') || normalized.includes('transfer')) return 'Bank Transfer';
    if (normalized.includes('room')) return 'Add to Room';
    if (normalized.includes('cash')) return 'Cash';
    return String(mode || 'Cash');
};

const buildPaymentDisplay = (order) => {
    const splits = Array.isArray(order?.paymentSplits)
        ? order.paymentSplits
            .map(split => ({
                mode: normalizePaymentMode(split?.mode || split?.method || split?.paymentMode),
                amount: Number(split?.amount) || 0
            }))
            .filter(split => split.amount > 0)
        : [];

    if (splits.length > 1) {
        const detail = splits.map(split => `${split.mode} ${split.amount.toFixed(2)}`).join(', ');
        return `Mixed (${detail})`;
    }

    if (splits.length === 1 && normalizePaymentMode(order?.paymentMethod) === 'Mixed') {
        return `Mixed (${splits[0].mode})`;
    }

    return normalizePaymentMode(order?.paymentMethod || 'Cash');
};

exports.getSalesReport = async (req, res) => {
    try {
        const { outlet, category, item, startDate, endDate } = req.query;

        let query = {};

        // 1. Date Filter
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt = { $gte: start, $lte: end };
        }

        // 2. Outlet Filter
        if (outlet && outlet !== 'All') {
            if (outlet === 'Dine-In') {
                query.orderType = { $in: ['Dine-In', 'Table Order', 'Table', 'Direct Payment'] };
            } else if (outlet === 'Room Service') {
                query.orderType = { $in: ['Room Service', 'Room Order', 'Post to Room'] };
            } else if (outlet === 'Take Away') {
                query.orderType = { $in: ['Take Away', 'TakeAway'] };
            } else if (outlet === 'Online') {
                query.orderType = { $in: ['Online', 'Online Order', 'Delivery'] };
            } else {
                query.orderType = outlet;
            }
        }

        // Fetch Orders
        let orders = await GuestMealOrder.find(query).sort({ createdAt: -1 }).lean();

        // Transform and Filter locally for category and items
        let transactions = [];

        orders.forEach(order => {
            const items = order.items || [];
            const orderSubtotal = toNum(order.subtotal) || items.reduce((sum, i) => sum + (toNum(i.total) || (toNum(i.price) * toNum(i.quantity))), 0);
            const orderTax = toNum(order.tax);
            const orderFinal = toNum(order.finalAmount || order.totalAmount);

            items.forEach(orderItem => {
                let matchCategory = true;
                let matchItem = true;

                // Category filter
                if (category && category !== 'All' && category !== 'All Categories' && category !== 'All Categorys') {
                    matchCategory = orderItem.category === category;
                }

                // Item filter 
                if (item && item !== 'All' && item !== 'All Items') {
                    matchItem = (orderItem.name || orderItem.itemName) === item;
                }

                if (matchCategory && matchItem) {
                    const itemSubtotal = toNum(orderItem.total) || (toNum(orderItem.price) * toNum(orderItem.quantity || 1));
                    const ratio = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) : 0;
                    const itemTax = orderTax > 0 ? (orderTax * ratio) : 0;
                    const itemNet = itemSubtotal + itemTax;

                    transactions.push({
                        id: `${order._id}-${orderItem._id || orderItem.menuItem || orderItem.id || transactions.length}`,
                        billNo: `BILL-${order._id.toString().slice(-6).toUpperCase()}`,
                        date: order.createdAt,
                        orderId: order._id,
                        itemName: orderItem.name || orderItem.itemName || 'Unknown Item',
                        category: orderItem.category || 'Uncategorized',
                        price: toNum(orderItem.price),
                        qty: toNum(orderItem.quantity) || 1,
                        subtotal: itemSubtotal,
                        tax: itemTax,
                        net: itemNet,
                        orderSubtotal,
                        orderTax,
                        orderFinal,
                        status: order.status || 'Active',
                        outlet: order.orderType || 'Dine-In',
                        paymentMethod: order.paymentMethod || 'Cash',
                        paymentMethodDisplay: buildPaymentDisplay(order),
                        paymentStatus: order.paymentStatus || 'Pending',
                        tableNumber: order.tableNumber || '-',
                        roomNumber: order.roomNumber || '-',
                        guestName: order.guestName || '-',
                        itemNotes: orderItem.notes || '-',
                        orderNotes: order.notes || '-',
                        kotNote: order.kotNote || '-'
                    });
                }
            });
        });

        res.status(200).json({
            success: true,
            data: transactions,
            count: transactions.length
        });
    } catch (error) {
        console.error("Sales Report Error:", error);
        res.status(500).json({
            success: false,
            message: 'Error fetching sales report',
            error: error.message
        });
    }
};
