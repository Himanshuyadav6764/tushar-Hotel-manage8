import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL_CONFIG, { apiCall } from '../config/api';
import './ViewOrderPage.css';
import ItemStockStatus from './ItemStockStatus';
import OutletCurrentStatus from './OutletCurrentStatus';
import { useSettings } from '../context/SettingsContext';

const ViewOrderPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    // Top Tabs State
    const [activeTab, setActiveTab] = useState('KOT View');
    const [activeFilter, setActiveFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderForBill, setSelectedOrderForBill] = useState(null);

    const [currentTime, setCurrentTime] = useState(new Date());
    const [toast, setToast] = useState(null);
    const [hiddenOrderIds, setHiddenOrderIds] = useState(() => {
        const saved = localStorage.getItem('hiddenOrderIds');
        return saved ? JSON.parse(saved) : [];
    });
    const [pendingDeleteOrderId, setPendingDeleteOrderId] = useState(null);

    useEffect(() => {
        localStorage.setItem('hiddenOrderIds', JSON.stringify(hiddenOrderIds));
    }, [hiddenOrderIds]);

    useEffect(() => {
        if (!pendingDeleteOrderId) return;

        const timer = setTimeout(() => setPendingDeleteOrderId(null), 5000);
        return () => clearTimeout(timer);
    }, [pendingDeleteOrderId]);

    // Show toast notification
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Local storage for preparing start times
    const [preparingTimes, setPreparingTimes] = useState({});

    // Update current time for elapsed timer
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 10000);
        return () => clearInterval(timer);
    }, []);

    // Handle initial filter and tab from navigation
    useEffect(() => {
        if (location.state) {
            if (location.state.activeFilter) {
                setActiveFilter(location.state.activeFilter);
            }
            if (location.state.activeTab) {
                setActiveTab(location.state.activeTab);
            }
        }
    }, [location.state]);

    // Fetch Orders from API
    const fetchOrders = async () => {
        try {
            setLoading(true);
            const response = await apiCall(`/api/guest-meal/orders`);
            const data = await response.json();
            if (data.success) {
                const mappedOrders = data.data.map(order => ({
                    id: order._id,
                    createdAt: new Date(order.createdAt),
                    time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    table: order.roomNumber || order.tableNumber?.toString() || '-',
                    type: order.orderType || 'Dine In',
                    items: order.items || [],
                    status: order.status === 'Active' ? 'Pending' :
                        order.status === 'Started' ? 'In Service' :
                            order.status === 'Pending Payment' ? 'Billed' :
                                order.status,
                    rawStatus: order.status, // Keep raw for API calls
                    amount: order.finalAmount || 0,
                    updatedAt: new Date(order.updatedAt),
                    guestName: order.guestName || '',
                    notes: order.notes || '',
                    kotNote: order.kotNote || ''
                }));
                setOrders(mappedOrders);

                // Initialize preparing times
                const newPrepTimes = { ...preparingTimes };
                mappedOrders.forEach(o => {
                    if (o.status === 'Preparing' && !newPrepTimes[o.id]) {
                        newPrepTimes[o.id] = o.updatedAt;
                    }
                });
                setPreparingTimes(newPrepTimes);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleStatusUpdate = async (orderId, newStatus) => {
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return;

        const order = orders[orderIndex];
        const currentRaw = order.rawStatus || order.status;
        if (currentRaw === 'Billed' || currentRaw === newStatus) return;

        if ((currentRaw === 'Ready' || order.status === 'Ready') && (newStatus === 'Preparing' || newStatus === 'Pending')) return;
        if ((currentRaw === 'Preparing' || order.status === 'Preparing') && newStatus === 'Pending') return;

        const previousOrders = [...orders];
        const updatedOrders = [...orders];
        updatedOrders[orderIndex] = { ...order, status: newStatus };
        setOrders(updatedOrders);

        if (newStatus === 'Preparing') {
            setPreparingTimes(prev => ({ ...prev, [orderId]: new Date() }));
        }

        try {
            const response = await apiCall(`/api/guest-meal/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                setOrders(previousOrders);
                alert(`Failed to update status: ${errorData.message || errorData.error || 'Unknown Error'}`);
                return false;
            } else {
                fetchOrders();
                return true;
            }
        } catch (error) {
            console.error('Error updating status:', error);
            setOrders(previousOrders);
            return false;
        }
    };

    const handleSendNotification = async (orderId, status) => {
        if (status !== 'Ready' && status !== 'In Service') {
            alert('Order must be READY before sending.');
            return;
        }

        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        if (order.type === 'Post to Room' || order.type === 'Room Order' || order.type === 'Room Service') {
            const success = await handleStatusUpdate(orderId, 'Started');
            if (success) showToast('✅ Order sent — delivery started!');
        } else if (order.type === 'Take Away') {
            const success = await handleStatusUpdate(orderId, 'Pending Payment');
            if (success) showToast('✅ Order sent to cashier!');
        } else if (order.type === 'Online' || order.type === 'Delivery') {
            const success = await handleStatusUpdate(orderId, 'Started');
            if (success) showToast('✅ Online order — delivery started!');
        } else {
            await handleStatusUpdate(orderId, 'Served');
            showToast('✅ Order served to table!');
        }
    };

    const handleCompleteOrder = (orderId, status) => {
        if (status !== 'Ready' && status !== 'In Service') {
            alert('Order must be READY or In Service before completing.');
            return;
        }
        handleStatusUpdate(orderId, 'Billed');
    };

    const handleDeleteOrder = async (orderId) => {
        try {
            const response = await apiCall(`/api/guest-meal/orders/${orderId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                showToast('🗑️ Order deleted successfully', 'success');
                setPendingDeleteOrderId(null);
                fetchOrders();
            } else {
                showToast(data.message || data.error || 'Failed to delete order', 'error');
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            showToast('Error connecting to server', 'error');
        }
    };

    const getMinutesElapsed = (startTime) => {
        if (!startTime) return 0;
        return Math.floor((currentTime - startTime) / 60000);
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const matchesSearch =
                searchQuery === '' ||
                (order.table && order.table.toString().toLowerCase().includes(searchQuery.toLowerCase())) ||
                (order.guestName && order.guestName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                order.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

            let matchesFilter = true;
            if (activeFilter !== 'All') {
                if (activeFilter === 'Dine In') matchesFilter = order.type === 'Dine In' || order.type === 'Dine-In' || order.type === 'Direct Payment';
                else if (activeFilter === 'Room Order') matchesFilter = order.type === 'Post to Room' || order.type === 'Room Order' || order.type === 'Room Service';
                else if (activeFilter === 'Take Away') matchesFilter = order.type === 'Take Away';
                else if (activeFilter === 'Online Order') matchesFilter = order.type === 'Online' || order.type === 'Delivery';
            }

            let matchesTab = true;
            if (activeTab === 'KOT View') {
                matchesTab = !['Cancelled'].includes(order.rawStatus || order.status);
            }

            const isHidden = hiddenOrderIds.includes(order.id);
            return matchesSearch && matchesFilter && matchesTab && !isHidden;
        });
    }, [searchQuery, activeFilter, orders, activeTab, hiddenOrderIds]);

    const handleEditOrder = (order) => {
        const roomData = (order.type === 'Post to Room' || order.type === 'Room Order' || order.type === 'Room Service')
            ? { id: null, roomNumber: order.table, guestName: order.guestName }
            : { id: order.tableId?._id || order.tableId, roomNumber: order.table, guestName: order.guestName };

        navigate('/admin/food-order', {
            state: {
                room: roomData,
                orderId: order.id,
                source: (order.type === 'Post to Room' || order.type === 'Room Order' || order.type === 'Room Service') ? 'room-service' : 'table-order'
            }
        });
    };

    return (
        <div className="view-order-container">
            {toast && (
                <div style={{
                    position: 'fixed',
                    top: '80px',
                    right: '24px',
                    background: toast.type === 'success' ? '#22c55e' : '#ef4444',
                    color: '#fff',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    fontWeight: '600',
                    fontSize: '14px',
                    zIndex: 9999,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    animation: 'slideInRight 0.3s ease'
                }}>
                    {toast.message}
                </div>
            )}
            <div className="view-order-tabs">
                {['KOT View', 'Outlet Current Status', 'Item Stock Status'].map(tab => (
                    <button
                        key={tab}
                        className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'Item Stock Status' ? (
                <ItemStockStatus />
            ) : activeTab === 'Outlet Current Status' ? (
                <OutletCurrentStatus />
            ) : (
                <>
                    <div className="view-order-filters">
                        <div className="search-wrapper">
                            <input
                                type="text"
                                placeholder="Search Table or Item..."
                                className="filter-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                            />
                        </div>
                        {['All', 'Dine In', 'Room Order', 'Take Away', 'Online Order'].map(filter => (
                            <button
                                key={filter}
                                className={`filter-pill ${activeFilter === filter ? 'active' : ''}`}
                                onClick={() => setActiveFilter(filter)}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    <div className="orders-grid">
                        <AnimatePresence>
                            {filteredOrders.map(order => {
                                const isBilled = order.status === 'Billed' || order.status === 'Closed';
                                const isReady = order.status === 'Ready' || order.status === 'In Service';
                                const pendingElapsed = getMinutesElapsed(order.createdAt);
                                const prepElapsed = getMinutesElapsed(preparingTimes[order.id]);

                                return (
                                    <motion.div
                                        className={`order-card ${isBilled ? 'completed' : ''}`}
                                        key={order.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div className="card-header">
                                            <span className="header-table">
                                                {(order.type === 'Take Away') ? `${order.guestName || 'Take Away'}` :
                                                    (order.type === 'Online' || order.type === 'Delivery') ? `Online: ${order.guestName || 'Order'}` :
                                                        (order.type === 'Post to Room' || order.type === 'Room Order' || order.type === 'Room Service') ? `Room: ${order.table}` :
                                                            order.table === '-' ? 'Walk-in' : `Table: ${order.table}`}
                                            </span>
                                            <div className="header-right">
                                                <span className="header-time">{order.time}</span>
                                                <div style={{ position: 'relative' }}>
                                                    <button
                                                        className="card-close-btn"
                                                        onClick={() => setPendingDeleteOrderId(order.id)}
                                                        title="Delete Order"
                                                    >
                                                        ×
                                                    </button>

                                                    {pendingDeleteOrderId === order.id && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            right: 0,
                                                            top: 'calc(100% + 8px)',
                                                            padding: '8px 10px',
                                                            borderRadius: '10px',
                                                            border: '1px solid #fecaca',
                                                            background: '#fff1f2',
                                                            color: '#991b1b',
                                                            fontSize: '12px',
                                                            fontWeight: 700,
                                                            display: 'inline-flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'flex-start',
                                                            gap: '8px',
                                                            minWidth: '190px',
                                                            boxShadow: '0 12px 24px rgba(239, 68, 68, 0.2)',
                                                            zIndex: 9999
                                                        }}>
                                                            <span>Are you sure want to delete?</span>
                                                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteOrder(order.id)}
                                                                    style={{
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        padding: '4px 10px',
                                                                        background: '#dc2626',
                                                                        color: '#fff',
                                                                        cursor: 'pointer',
                                                                        fontWeight: 700,
                                                                        fontSize: '12px'
                                                                    }}
                                                                >
                                                                    Yes
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPendingDeleteOrderId(null)}
                                                                    style={{
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        padding: '4px 10px',
                                                                        background: '#fee2e2',
                                                                        color: '#7f1d1d',
                                                                        cursor: 'pointer',
                                                                        fontWeight: 700,
                                                                        fontSize: '12px'
                                                                    }}
                                                                >
                                                                    No
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {!isBilled && order.status === 'Pending' && (
                                            <div className="status-strip pending-delay">
                                                ⚠️ DELAY {pendingElapsed}m elapsed
                                            </div>
                                        )}
                                        {!isBilled && order.status === 'Preparing' && (
                                            <div className={`status-strip ${prepElapsed > 15 ? 'preparing-delay' : 'preparing-timer'}`}>
                                                {prepElapsed > 15 ? `⚠️ DELAY in preparation (${prepElapsed}m)` : `Preparing • ${prepElapsed}m`}
                                            </div>
                                        )}
                                        {!isBilled && order.status === 'In Service' && (
                                            <div className="status-strip" style={{ background: '#8b5cf6', color: '#fff', fontWeight: '700' }}>
                                                🛵 In Service — Delivery on the way
                                            </div>
                                        )}
                                        {(isBilled || order.status === 'Ready') && (
                                            <div className="status-strip"></div>
                                        )}

                                        <div className="card-body">
                                            <div className="item-list">
                                                {order.items.map((item, idx) => (
                                                    <div key={idx} className="order-item">
                                                        <span className="item-name-qty">
                                                            {item.name} {item.quantity > 1 ? `×${item.quantity}` : ''}
                                                        </span>
                                                        <span className="item-price">{cs}{item.price * item.quantity}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {order.kotNote && (
                                            <div className="order-special-note">
                                                <span className="special-note-icon">🍳</span>
                                                <span className="special-note-text"><strong>Special Note:</strong> {order.kotNote}</span>
                                            </div>
                                        )}

                                        <div className="status-actions">
                                            <button
                                                className={`status-btn ${order.status === 'Pending' && !isBilled ? 'blinking pending' : ''} ${(isBilled || order.status === 'In Service') ? 'disabled' : ''}`}
                                                onClick={() => handleStatusUpdate(order.id, 'Pending')}
                                                disabled={isBilled || order.status === 'In Service'}
                                            >
                                                <span className="status-icon">⏱</span>
                                                <span>Pending</span>
                                            </button>
                                            <button
                                                className={`status-btn ${order.status === 'Preparing' && !isBilled ? 'blinking preparing' : ''} ${(isBilled || order.status === 'In Service') ? 'disabled' : ''}`}
                                                onClick={() => handleStatusUpdate(order.id, 'Preparing')}
                                                disabled={isBilled || order.status === 'In Service'}
                                            >
                                                <span className="status-icon">🔥</span>
                                                <span>Preparing</span>
                                            </button>
                                            <button
                                                className={`status-btn ${order.status === 'Ready' && !isBilled ? 'blinking ready' : ''} ${(isBilled || order.status === 'In Service') ? 'disabled' : ''}`}
                                                onClick={() => handleStatusUpdate(order.id, 'Ready')}
                                                disabled={isBilled || order.status === 'In Service'}
                                            >
                                                <span className="status-icon">✔</span>
                                                <span>Ready</span>
                                            </button>
                                        </div>

                                        <div className="card-footer">
                                            <button
                                                className={`action-btn send ${isReady && !isBilled ? 'blinking-green' : ''} ${!isReady || isBilled ? 'disabled' : ''}`}
                                                onClick={() => handleSendNotification(order.id, order.status)}
                                                style={{
                                                    opacity: isReady && !isBilled ? 1 : 0.4,
                                                    cursor: isReady && !isBilled ? 'pointer' : 'not-allowed'
                                                }}
                                            >
                                                {order.type === 'Take Away' ? 'To Customer' : 'Send'}
                                            </button>
                                            <button
                                                className={`action-btn done ${!isBilled ? 'disabled' : ''}`}
                                                onClick={() => setHiddenOrderIds(prev => [...prev, order.id])}
                                                disabled={!isBilled}
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </>
            )}

            {selectedOrderForBill && (
                <div className="receipt-modal-overlay">
                    <div className="receipt-modal-container">
                        <button className="receipt-close-btn" onClick={() => setSelectedOrderForBill(null)}>×</button>
                        <div className="receipt-content">
                            <div className="receipt-header">
                                <h1>BAREENA ATITHI</h1>
                                <h2>PREMIUM HOSPITALITY</h2>
                                <p className="receipt-address">
                                    Near Railway Station, City Center<br />
                                    Ph: +91-9876543210 | GSTIN: 22AAAAA0000A1Z5
                                </p>
                            </div>
                            <div className="receipt-divider"></div>
                            <div className="receipt-info-grid">
                                <div className="info-row">
                                    <span className="info-label">Bill No:</span>
                                    <span className="info-value">#{selectedOrderForBill.id.slice(-6).toUpperCase()}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Guest:</span>
                                    <span className="info-value">{selectedOrderForBill.guestName || 'Walk-in'}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Source:</span>
                                    <span className="info-value">{selectedOrderForBill.type} - {selectedOrderForBill.table}</span>
                                </div>
                            </div>
                            <table className="receipt-table">
                                <thead>
                                    <tr>
                                        <th>ITEM DESCRIPTION</th>
                                        <th style={{ textAlign: 'center' }}>QTY</th>
                                        <th style={{ textAlign: 'right' }}>AMOUNT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedOrderForBill.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{item.name}</td>
                                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                            <td style={{ textAlign: 'right' }}>{item.price * item.quantity}.00</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="receipt-totals">
                                <div className="total-row">
                                    <span>Subtotal</span>
                                    <span>{cs} {selectedOrderForBill.amount}.00</span>
                                </div>
                                <div className="total-row grand-total">
                                    <span>NET PAYABLE</span>
                                    <span>{cs} {selectedOrderForBill.amount}.00</span>
                                </div>
                            </div>
                            <div className="receipt-footer">
                                <h3>Thank You!</h3>
                                <p>We hope to see you again soon.</p>
                            </div>
                            <div className="receipt-modal-actions">
                                <button className="print-btn" onClick={() => window.print()}>
                                    <span>🖨️</span> Print Bill
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewOrderPage;

