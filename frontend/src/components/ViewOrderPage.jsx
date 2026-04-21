import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiCall } from '../config/api';
import './ViewOrderPage.css';
import ItemStockStatus from './ItemStockStatus';
import OutletCurrentStatus from './OutletCurrentStatus';
import OrderNotificationPanel from './OrderNotificationPanel';
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
    const [onlineStatusFilter, setOnlineStatusFilter] = useState('all');
    const [pendingOnlineDeleteId, setPendingOnlineDeleteId] = useState(null);
    const isOnlineManagement = location.state?.activeMenu === 'online-order-nav';

    const [currentTime, setCurrentTime] = useState(new Date());
    const [toast, setToast] = useState(null);
    const [hiddenOrderIds, setHiddenOrderIds] = useState(() => {
        const saved = localStorage.getItem('hiddenOrderIds');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('hiddenOrderIds', JSON.stringify(hiddenOrderIds));
    }, [hiddenOrderIds]);

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
        } else if (!isOnlineManagement) {
            setActiveTab('KOT View');
        }
    }, [location.state, isOnlineManagement]);

    useEffect(() => {
        if (isOnlineManagement) {
            setActiveFilter('Online Order');
            return;
        }

        // When returning to KOT mode, restore default list behavior.
        setPendingOnlineDeleteId(null);
        setOnlineStatusFilter('all');
        setSearchQuery('');
        setActiveFilter((prev) => (prev === 'Online Order' ? 'All' : prev));
    }, [isOnlineManagement]);

    // Fetch Orders from API
    const fetchOrders = async () => {
        try {
            setLoading(true);
            const response = await apiCall('/api/guest-meal/orders');
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
                    notes: order.notes || ''
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
                alert(`Failed to update status: ${errorData.message || 'Unknown Error'}`);
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
            if (success) showToast('G�� Order sent G�� delivery started!');
        } else if (order.type === 'Take Away') {
            const success = await handleStatusUpdate(orderId, 'Pending Payment');
            if (success) showToast('G�� Order sent to cashier!');
        } else if (order.type === 'Online' || order.type === 'Delivery') {
            const success = await handleStatusUpdate(orderId, 'Started');
            if (success) showToast('G�� Online order G�� delivery started!');
        } else {
            await handleStatusUpdate(orderId, 'Served');
            showToast('G�� Order served to table!');
        }
    };

    const handleCompleteOrder = (orderId, status) => {
        if (status !== 'Ready' && status !== 'In Service') {
            alert('Order must be READY or In Service before completing.');
            return;
        }
        handleStatusUpdate(orderId, 'Billed');
    };

    const handleDeleteOrder = async (orderId, { skipConfirm = false } = {}) => {
        if (!skipConfirm && !window.confirm('Are you sure you want to permanently delete this order?')) return;
        try {
            const response = await apiCall(`/api/guest-meal/orders/${orderId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                showToast('=���n+� Order deleted successfully', 'success');
                setPendingOnlineDeleteId(null);
                fetchOrders();
            } else {
                alert(data.message || data.error || 'Failed to delete order');
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            alert('Error connecting to server');
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

    const onlineOrdersForManagement = useMemo(() => {
        const normalizedSearch = String(searchQuery || '').toLowerCase().trim();

        return orders
            .filter((order) => order.type === 'Online' || order.type === 'Delivery' || order.type === 'Online Order')
            .filter((order) => {
                if (!normalizedSearch) return true;
                return (
                    String(order.table || '').toLowerCase().includes(normalizedSearch)
                    || String(order.guestName || '').toLowerCase().includes(normalizedSearch)
                    || (order.items || []).some(item => String(item.name || '').toLowerCase().includes(normalizedSearch))
                );
            })
            .filter((order) => {
                if (onlineStatusFilter === 'all') return true;
                if (onlineStatusFilter === 'pending') return ['Pending', 'Active'].includes(order.status);
                if (onlineStatusFilter === 'preparing') return order.status === 'Preparing';
                if (onlineStatusFilter === 'inservice') return ['In Service', 'Ready', 'Started'].includes(order.status);
                return true;
            })
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    }, [orders, searchQuery, onlineStatusFilter]);

    const activeOnlineOrdersCount = useMemo(() => {
        const isBilledStatus = (order) => {
            const raw = order.rawStatus || order.status;
            return ['Pending Payment', 'Billed', 'Closed', 'Cancelled'].includes(raw) || order.status === 'Billed';
        };

        return orders.filter((order) => (
            (order.type === 'Online' || order.type === 'Delivery' || order.type === 'Online Order')
            && !isBilledStatus(order)
        )).length;
    }, [orders]);

    const sendOnlineBillToCashier = async (orderId) => {
        try {
            const response = await apiCall(`/api/guest-meal/orders/${orderId}/send-to-cashier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                alert(`Failed to send online order to cashier: ${data.message || data.error || 'Unknown Error'}`);
                return;
            }

            navigate('/admin/cashier-section', {
                state: {
                    refresh: true,
                    initialTab: 'Online Order',
                    room: { orderId },
                    orderId
                }
            });
        } catch (error) {
            console.error('Error sending online order to cashier:', error);
            alert('Failed to send online order to cashier. Please try again.');
        }
    };

    const formatCurrentDate = () => {
        return new Date().toLocaleString('en-US', {
            month: 'short',
            day: '2-digit'
        }).toUpperCase();
    };

    const handleManualDelete = (orderId) => {
        setPendingOnlineDeleteId(orderId);
    };

    const confirmManualDelete = async (orderId) => {
        await handleDeleteOrder(orderId, { skipConfirm: true });
    };

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
            {isOnlineManagement ? (
                <>
                    <header className="oom-top-header">
                        <div className="oom-header-left">
                            <button className="oom-back-btn" onClick={() => navigate(-1)}>←</button>
                            <div>
                                <h1 className="oom-title">Online Order Management</h1>
                                <p className="oom-subtitle">ACTIVE OPERATIONS • {formatCurrentDate()} • {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                        </div>
                        <div className="oom-header-right">
                            <div className="oom-count-badge">{activeOnlineOrdersCount} Active Orders</div>
                            <OrderNotificationPanel scope="online-order" />
                        </div>
                    </header>

                    <div className="view-order-filters">
                        <div className="search-wrapper">
                            <input
                                type="text"
                                placeholder="Search rooms, guests or items..."
                                className="filter-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {[
                            { key: 'all', label: 'All Orders' },
                            { key: 'pending', label: 'Pending' },
                            { key: 'preparing', label: 'Preparing' },
                            { key: 'inservice', label: 'In Service' }
                        ].map(filter => (
                            <button
                                key={filter.key}
                                className={`filter-pill ${onlineStatusFilter === filter.key ? 'active' : ''}`}
                                onClick={() => setOnlineStatusFilter(filter.key)}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>

                    <div className="oom-grid">
                        {loading ? (
                            <div className="oom-empty">Loading online orders...</div>
                        ) : onlineOrdersForManagement.length === 0 ? (
                            <div className="oom-empty">No online orders found for this filter.</div>
                        ) : onlineOrdersForManagement.map((order) => {
                            const orderStatus = order.rawStatus || order.status;
                            const alreadyBilled = ['Pending Payment', 'Billed', 'Closed', 'Cancelled'].includes(orderStatus);
                            const isInService = order.status === 'In Service' || orderStatus === 'Started';
                            const canSend = !alreadyBilled && !isInService && order.status === 'Ready';
                            const canBill = !alreadyBilled && isInService;

                            return (
                                <div className="oom-card" key={order.id}>
                                    <div className="oom-card-top">
                                        <div className="oom-room">{order.table || '-'}</div>
                                        <div className="oom-card-right">
                                            <div className="oom-room-type">ONLINE ORDER</div>
                                            <button
                                                className="oom-card-close"
                                                onClick={() => handleManualDelete(order.id)}
                                                title="Delete card"
                                            >
                                                ×
                                            </button>
                                            {pendingOnlineDeleteId === order.id && (
                                                <div className="oom-delete-popover">
                                                    <span>Delete this card?</span>
                                                    <div className="oom-delete-actions">
                                                        <button type="button" className="oom-delete-yes" onClick={() => confirmManualDelete(order.id)}>Yes</button>
                                                        <button type="button" className="oom-delete-no" onClick={() => setPendingOnlineDeleteId(null)}>No</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="oom-guest-row">GUEST: {String(order.guestName || 'Guest').toUpperCase()}</div>
                                    <div className="oom-status-pill">{order.status || 'Pending'}</div>

                                    <div className="oom-detail-box">
                                        <div>
                                            <div className="oom-detail-label">ORDER ITEMS</div>
                                            <div className="oom-detail-value">
                                                {(order.items && order.items.length > 0)
                                                    ? `${order.items[0].name}${order.items.length > 1 ? ` +${order.items.length - 1}` : ''}`
                                                    : 'N/A'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="oom-detail-label">CATEGORY</div>
                                            <div className="oom-detail-value">Online</div>
                                        </div>
                                    </div>

                                    <div className="oom-card-footer">
                                        <span className="oom-time">{order.time}</span>
                                        <div className="oom-action-row">
                                            <button
                                                className={`oom-send-btn ${!canSend ? 'disabled' : ''}`}
                                                disabled={!canSend}
                                                onClick={() => handleSendNotification(order.id, order.status)}
                                                title={!canSend ? 'Set order to Ready in KOT before sending' : 'Send order to In Service'}
                                            >
                                                Send
                                            </button>
                                            <button
                                                className={`oom-bill-btn ${!canBill ? 'disabled' : ''}`}
                                                disabled={!canBill}
                                                onClick={() => sendOnlineBillToCashier(order.id)}
                                                title={!canBill ? 'Bill enabled after Send (In Service)' : 'Send bill to cashier'}
                                            >
                                                {alreadyBilled ? 'Billed' : 'Bill'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <>
                    <div className="vo-top-row">
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
                        <OrderNotificationPanel scope="kot-view" />
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
                                        onChange={(e) => setSearchQuery(e.target.value)}
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
                                                        <button
                                                            className="card-close-btn"
                                                            onClick={() => handleDeleteOrder(order.id)}
                                                            title="Delete Order"
                                                        >
                                                            +�
                                                        </button>
                                                    </div>
                                                </div>

                                                {!isBilled && order.status === 'Pending' && (
                                                    <div className="status-strip pending-delay">
                                                        G��n+� DELAY {pendingElapsed}m elapsed
                                                    </div>
                                                )}
                                                {!isBilled && order.status === 'Preparing' && (
                                                    <div className={`status-strip ${prepElapsed > 15 ? 'preparing-delay' : 'preparing-timer'}`}>
                                                        {prepElapsed > 15 ? `G��n+� DELAY in preparation (${prepElapsed}m)` : `Preparing G�� ${prepElapsed}m`}
                                                    </div>
                                                )}
                                                {!isBilled && order.status === 'In Service' && (
                                                    <div className="status-strip" style={{ background: '#8b5cf6', color: '#fff', fontWeight: '700' }}>
                                                        =��� In Service G�� Delivery on the way
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
                                                                    {item.name} {item.quantity > 1 ? `+�${item.quantity}` : ''}
                                                                </span>
                                                                <span className="item-price">{cs}{item.price * item.quantity}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {order.notes && (
                                                        <div className="order-notes-display">
                                                            <span className="notes-icon">=���</span>
                                                            <p>{order.notes}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="status-actions">
                                                    <button
                                                        className={`status-btn ${order.status === 'Pending' && !isBilled ? 'blinking pending' : ''} ${(isBilled || order.status === 'In Service') ? 'disabled' : ''}`}
                                                        onClick={() => handleStatusUpdate(order.id, 'Pending')}
                                                        disabled={isBilled || order.status === 'In Service'}
                                                    >
                                                        <span className="status-icon">GŦ</span>
                                                        <span>Pending</span>
                                                    </button>
                                                    <button
                                                        className={`status-btn ${order.status === 'Preparing' && !isBilled ? 'blinking preparing' : ''} ${(isBilled || order.status === 'In Service') ? 'disabled' : ''}`}
                                                        onClick={() => handleStatusUpdate(order.id, 'Preparing')}
                                                        disabled={isBilled || order.status === 'In Service'}
                                                    >
                                                        <span className="status-icon">=���</span>
                                                        <span>Preparing</span>
                                                    </button>
                                                    <button
                                                        className={`status-btn ${order.status === 'Ready' && !isBilled ? 'blinking ready' : ''} ${(isBilled || order.status === 'In Service') ? 'disabled' : ''}`}
                                                        onClick={() => handleStatusUpdate(order.id, 'Ready')}
                                                        disabled={isBilled || order.status === 'In Service'}
                                                    >
                                                        <span className="status-icon">G��</span>
                                                        <span>Ready</span>
                                                    </button>
                                                </div>

                                                <div className="card-footer">
                                                    <button
                                                        className={`action-btn send ${!isReady || isBilled ? 'disabled' : ''}`}
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
                </>
            )}

            {selectedOrderForBill && (
                <div className="receipt-modal-overlay">
                    <div className="receipt-modal-container">
                        <button className="receipt-close-btn" onClick={() => setSelectedOrderForBill(null)}>+�</button>
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
                                    <span>=���n+�</span> Print Bill
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
