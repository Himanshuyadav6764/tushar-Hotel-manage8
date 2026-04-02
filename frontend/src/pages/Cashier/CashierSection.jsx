import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import API_URL, { apiCall } from '../../config/api';
import './CashierSection.css';

const CashierSection = () => {
    const { user } = useAuth();
    const { settings, getCurrencySymbol, formatDate, formatTime } = useSettings();
    const cs = getCurrencySymbol();
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [activeTab, setActiveTab] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [showOrdersMobile, setShowOrdersMobile] = useState(false);
    const [showPaymentMobile, setShowPaymentMobile] = useState(false);
    const [showNewOrderModal, setShowNewOrderModal] = useState(false);
    const [newOrderDetails, setNewOrderDetails] = useState({ name: '', phone: '' });
    const [newOrderWarning, setNewOrderWarning] = useState('');

    // Track Order State
    const [showTrackModal, setShowTrackModal] = useState(false);
    const [trackQuery, setTrackQuery] = useState('');
    const [trackedOrders, setTrackedOrders] = useState(null); // null means not searched yet
    const [trackLoading, setTrackLoading] = useState(false);
    const [trackWarning, setTrackWarning] = useState('');

    // Checked-in Rooms for Folio
    const [checkedInRooms, setCheckedInRooms] = useState([]);

    // State for Orders
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState({
        totalCollection: 0,
        cash: 0,
        upi: 0,
        card: 0,
        pending: 0
    });

    const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';
    const permissionLabels = Array.isArray(user?.permissions) ? user.permissions : [];
    const hasExplicitAssignments = !isSuperAdmin && permissionLabels.length > 0;

    // Helper to check permissions
    const hasCashierPermission = (type) => {
        if (!user) return false;
        if (isSuperAdmin) return true;

        const hasTable = permissionLabels.includes('Cashier Section (Table)');
        const hasRoom = permissionLabels.includes('Cashier Section (Room Service)');
        const hasTakeAway = permissionLabels.includes('Cashier Section (Take Away)');

        if (hasExplicitAssignments) {
            if (type === 'Table') return hasTable;
            if (type === 'Room') return hasRoom;
            if (type === 'Take Away') return hasTakeAway;
            return false;
        }

        if (user.role === 'staff') return false;
        return false;
    };

    const canAccessOrderType = (orderType) => {
        if (orderType === 'Table') return hasCashierPermission('Table');
        if (orderType === 'Room') return hasCashierPermission('Room');
        if (['Take Away', 'Delivery', 'Online'].includes(orderType)) return hasCashierPermission('Take Away');
        return false;
    };

    const modeTabs = [];
    if (hasCashierPermission('Table')) modeTabs.push('Dine In');
    if (hasCashierPermission('Room')) modeTabs.push('Room');
    if (hasCashierPermission('Take Away')) {
        modeTabs.push('Take Away');
        modeTabs.push('Delivery');
        modeTabs.push('Online Order');
    }
    const allowedTabs = modeTabs.length > 1 ? ['All', ...modeTabs] : modeTabs;
    const canCreateTakeAwayOrder = hasCashierPermission('Take Away');

    useEffect(() => {
        if (allowedTabs.length === 0) {
            setActiveTab('All');
            return;
        }
        if (!allowedTabs.includes(activeTab)) {
            setActiveTab(allowedTabs[0]);
        }
    }, [allowedTabs, activeTab]);

    useEffect(() => {
        const requestedMode = location.state?.cashierMode;
        if (!requestedMode) return;

        if (!hasCashierPermission(requestedMode)) {
            alert('Role not assigned for this cashier section.');
            navigate(location.pathname, { replace: true, state: null });
        }
    }, [location.state, location.pathname, navigate]);

    // Initial fetch and periodic refresh
    useEffect(() => {
        const refreshData = () => {
            fetchPendingOrders();
            fetchDashboardStats();
            fetchCheckedInRooms();
        };

        refreshData();
        const interval = setInterval(refreshData, 15000); // Refresh every 15 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchCheckedInRooms = async () => {
        try {
            const response = await apiCall(`/api/bookings/list`);
            const data = await response.json();
            if (data.success) {
                const checkedIn = data.data.filter(b => ['Checked-in', 'CheckedIn', 'IN_HOUSE', 'Checked-In'].includes(b.status));
                setCheckedInRooms(checkedIn);
            }
        } catch (error) {
            console.error("Error fetching checked-in rooms:", error);
        }
    };

    // Listen for refresh triggers (e.g. from GuestMealService 'Send')
    useEffect(() => {
        if (location.state && location.state.refresh) {
            fetchPendingOrders();
            fetchDashboardStats();
        }
    }, [location.state]);

    // Auto-select order if navigated from another page (e.g. Room Service Bill Details)
    useEffect(() => {
        if (location.state && location.state.room && location.state.room.orderId && orders.length > 0) {
            const orderToSelect = orders.find(o => o.id === location.state.room.orderId);
            if (orderToSelect && selectedOrder?.id !== orderToSelect.id) {
                console.log(`[CashierSection] Auto-selecting order:`, orderToSelect.id);
                setSelectedOrder(orderToSelect);
                setActiveTab('All'); // Ensure we are on a tab where the order is visible

                // Consume one-time navigation state so periodic refresh doesn't keep re-selecting.
                navigate(location.pathname, { replace: true, state: null });
            }
        }
    }, [orders, location.state, selectedOrder, navigate, location.pathname]);

    const fetchDashboardStats = async () => {
        try {
            const response = await apiCall(`/api/guest-meal/analytics/dashboard`);
            const data = await response.json();
            if (data.success) {
                const s = data.data;
                // Keep pending from fetchPendingOrders; avoid stale closure resets during interval refresh.
                setStats(prev => ({
                    ...prev,
                    totalCollection: s.totalRevenue || 0,
                    cash: s.collections?.Cash || 0,
                    upi: s.collections?.UPI || 0,
                    card: s.collections?.Card || 0
                }));
            }
        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
        }
    };

    const fetchPendingOrders = async () => {
        try {
            const response = await apiCall(`/api/guest-meal/orders/pending`);
            const data = await response.json();

            if (data.success) {
                console.log(`[CashierSection] Fetched ${data.data.length} pending orders:`, data.data);
                const mappedOrders = data.data.map(order => {
                    // Prefer actual table label from Table View (including merged names)
                    // and fall back to tableNumber only when table name is unavailable.
                    const rawTableName =
                        (order.tableId && typeof order.tableId === 'object' && order.tableId.tableName)
                        || order.tableName
                        || '';
                    const cleanTableName = String(rawTableName).replace(/_MERGED_/g, '').trim();
                    const tableLabel = cleanTableName || (order.tableNumber ? String(order.tableNumber) : 'Walk-In');

                    return {
                        id: order._id,
                        type: (order.orderType === 'Table Order' || order.orderType === 'Dine-In' || order.orderType === 'Direct Payment') ? 'Table' :
                            (order.orderType === 'Room Service' || order.orderType === 'Post to Room' || order.orderType === 'Room Order') ? 'Room' :
                                (order.orderType === 'Take Away' || order.orderType === 'Delivery' || order.orderType === 'Online') ? order.orderType : 'Table',
                        name: (order.orderType === 'Table Order' || order.orderType === 'Dine-In' || order.orderType === 'Direct Payment') ? tableLabel :
                            (order.orderType === 'Room Service' || order.orderType === 'Post to Room' || order.orderType === 'Room Order') ? `Room ${order.roomNumber || 'Unknown'}` :
                                (order.orderType === 'Take Away' || order.orderType === 'Delivery' || order.orderType === 'Online') ? order.orderType : `Table ${order.tableNumber || ''}`,
                        guest: `${order.guestName || 'Guest'}${order.guestPhone ? ` - ${order.guestPhone}` : ''}`,
                        amount: order.finalAmount || 0,
                        status: 'Pending',
                        time: order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
                        items: (order.items || []).map(item => ({
                            name: item.name,
                            qty: item.quantity,
                            price: item.price,
                            amount: item.subtotal
                        })),
                        billNo: `${settings.invoicePrefix || settings.billingInvoicePrefix || '#'}${order._id.toString().substr(-6).toUpperCase()}`,
                        kotInfo: `KOT - ${order._id.toString().substr(-4)}`,
                        notes: order.notes || ''
                    };
                });

                const permissionScopedOrders = mappedOrders.filter((order) => canAccessOrderType(order.type));
                setOrders(permissionScopedOrders);
                setStats(prev => ({
                    ...prev,
                    pending: permissionScopedOrders.length,
                }));
            }
        } catch (error) {
            console.error("Error fetching pending orders:", error);
        }
    };

    const handleOrderClick = (order) => {
        setSelectedOrder(order);
        if (typeof window !== 'undefined' && window.innerWidth < 640) {
            setShowOrdersMobile(false);
        }
    };

    const handlePaymentComplete = async (orderId, amount, mode, type, roomNumber = null, folioId = 0, billingMeta = null, paymentSplits = null, bookingId = null) => {
        try {
            const response = await apiCall(`/api/guest-meal/orders/${orderId}/settle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentMethod: type, // 'Direct Payment' or 'Add to Room'
                    paymentMode: mode,   // 'Cash', 'UPI', etc.
                    amount: amount,
                    roomNumber: roomNumber,
                    bookingId,
                    folioId: folioId,
                    billingMeta,
                    paymentSplits
                })
            });

            const data = await response.json();

            if (data.success) {
                // Remove processed order from pending list but keep selectedOrder for printing
                const updatedOrders = orders.filter(o => o.id !== orderId);
                setOrders(updatedOrders);

                // Remove from tracked orders as well
                if (trackedOrders) {
                    setTrackedOrders(prev => prev.filter(o => o._id !== orderId));
                }

                // Update Stats
                setStats(prev => {
                    const next = {
                        ...prev,
                        totalCollection: prev.totalCollection + amount,
                        pending: Math.max(0, prev.pending - 1)
                    };

                    if (Array.isArray(paymentSplits) && paymentSplits.length > 0) {
                        paymentSplits.forEach(split => {
                            const key = String(split.mode || '').toLowerCase().trim();
                            const amt = Number(split.amount || 0);
                            if (key === 'cash' || key === 'upi' || key === 'card') {
                                next[key] = (next[key] || 0) + amt;
                            }
                        });
                    } else {
                        const singleKey = String(mode || '').toLowerCase().trim();
                        if (singleKey === 'cash' || singleKey === 'upi' || singleKey === 'card') {
                            next[singleKey] = (next[singleKey] || 0) + amount;
                        }
                    }

                    return next;
                });

                return true;
            } else {
                alert('Failed to settle order: ' + data.message);
                return false;
            }
        } catch (error) {
            console.error('Error settling order:', error);
            alert('Error settling order. Please check connection.');
            return false;
        }
    };

    const handleNewOrderClick = () => {
        if (!settings.posEnabled) {
            alert('POS is disabled. Cannot create orders. Enable POS from Company Settings.');
            return;
        }
        if (!canCreateTakeAwayOrder) {
            alert('Take Away order permission required.');
            return;
        }
        setNewOrderWarning('');
        setShowNewOrderModal(true);
    };

    const handleGoToFoodMenu = () => {
        const customerName = newOrderDetails.name.trim();
        const customerPhone = newOrderDetails.phone.trim();

        if (!/^\d{10}$/.test(customerPhone)) {
            setNewOrderWarning('Please enter a valid 10-digit phone number');
            return;
        }

        if (!/^[A-Za-z\s]+$/.test(customerName) || customerName.length < 2) {
            setNewOrderWarning('Please enter customer name (letters only)');
            return;
        }

        setNewOrderWarning('');
        setShowNewOrderModal(false);
        // Navigate by state instead of preventing default
        // The AdminDashboard listens for location.state.activeMenu
        navigate('/admin/dashboard', {
            state: {
                activeMenu: 'food-order', // Trigger switching to food order view
                customerName,
                customerPhone,
                orderMode: 'takeaway'
            }
        });
    };

    // --- TRACK ORDER LOGIC ---
    const handleTrackOrderSearch = async () => {
        if (!/^\d{10}$/.test(trackQuery.trim())) {
            setTrackWarning('Please enter exactly 10 digits');
            setTrackedOrders(null);
            return;
        }

        setTrackWarning('');
        setTrackLoading(true);
        try {
            // Using getAllOrders to find by phone/name/id
            // In a real app, this should be a specific search endpoint.
            // Optimized: Fetch all active orders and filter client side for now.
            const response = await apiCall(`/api/guest-meal/orders`);
            const data = await response.json();

            if (data.success) {
                const query = trackQuery.trim();
                const matched = data.data.filter(o =>
                    ['Take Away', 'Delivery', 'Online', 'Room Service'].includes(o.orderType) &&
                    !['Closed', 'Cancelled', 'Completed', 'Settled'].includes(o.status) &&
                    (
                        (o.guestPhone && o.guestPhone.includes(query))
                    )
                );
                setTrackedOrders(matched);
            } else {
                setTrackedOrders([]);
            }
        } catch (error) {
            console.error("Error tracking order:", error);
            setTrackedOrders([]);
        }
        setTrackLoading(false);
    };

    const getStatusStep = (status) => {
        if (['Pending', 'Active'].includes(status)) return 1;
        if (['Preparing', 'Started'].includes(status)) return 2;
        if (['Ready', 'Served'].includes(status)) return 3;
        if (['Billed', 'Pending Payment', 'Completed'].includes(status)) return 4;
        return 0;
    };

    const getStepLabel = (step) => {
        if (step === 1) return 'Pending';
        if (step === 2) return 'Preparing';
        if (step >= 3) return 'Ready';
        return 'Pending';
    };


    // Filter Logic
    const filteredOrders = (activeTab === 'All'
        ? orders
        : orders.filter(order => {
            if (activeTab === 'Dine In') return order.type === 'Table';
            if (activeTab === 'Room') return order.type === 'Room';
            if (activeTab === 'Take Away') return order.type === 'Take Away';
            if (activeTab === 'Delivery') return order.type === 'Delivery';
            if (activeTab === 'Online Order') return order.type === 'Online';
            return true;
        })).filter(order => {
            // Apply search filter
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                order.billNo.toLowerCase().includes(q) ||
                order.name.toLowerCase().includes(q) ||
                order.type.toLowerCase().includes(q)
            );
        });

    return (
        <>
            <div className="cashier-container fadeIn">
            <div className="cashier-dashboard">

                {/* PAGE HEADER */}
                <div className="cashier-header">
                    <h1>Cashier Dashboard</h1>
                    <div className="header-actions">
                        <button className="btn-track" onClick={() => setShowTrackModal(true)}>
                            <span className="icon">📡</span> Track Order
                        </button>
                        {canCreateTakeAwayOrder && (
                            <button className="btn-new-order" onClick={handleNewOrderClick}>
                                <span className="icon">🛍️</span> New Take Away Order
                            </button>
                        )}
                    </div>
                </div>

                {/* TOP SECTION: SUMMARY CARDS */}
                <div className="stats-wrapper">
                    <div className="stat-card total">
                        <div className="stat-card-inner">
                            <span className="stat-label">TOTAL COLLECTION (LAST 24 HOURS)</span>
                            <span className="stat-value">{cs}{stats.totalCollection.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="stat-card cash">
                        <div className="stat-card-inner">
                            <span className="stat-label">CASH COLLECTION</span>
                            <span className="stat-value">{cs}{stats.cash.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="stat-card upi">
                        <div className="stat-card-inner">
                            <span className="stat-label">UPI COLLECTION</span>
                            <span className="stat-value">{cs}{stats.upi.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="stat-card card-pay">
                        <div className="stat-card-inner">
                            <span className="stat-label">CARD COLLECTION</span>
                            <span className="stat-value">{cs}{stats.card.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="stat-card pending">
                        <div className="stat-card-inner">
                            <span className="stat-label">TOTAL PENDING</span>
                            <span className="stat-value">{stats.pending}</span>
                        </div>
                    </div>
                </div>

                {/* MAIN CONTENT AREA: 3 COLUMN GRID */}
                <div className={`dashboard-content ${showOrdersMobile ? 'show-orders-mobile' : ''} ${showPaymentMobile ? 'show-payment-mobile' : ''}`}>

                    {/* LEFT PANEL: ORDERS */}
                    <div className="pos-card orders-sidebar">
                        <div className="sidebar-header">
                            {/* Search Bar first as per image 2 */}
                            <div className="search-bar">
                                <input
                                    type="text"
                                    placeholder="Search orders..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                                />
                            </div>

                            <div className="tabs-row">
                                {allowedTabs.length > 0 ? (
                                    allowedTabs.map(tab => (
                                        <button
                                            key={tab}
                                            className={`tab ${activeTab === tab ? 'active' : ''}`}
                                            onClick={() => setActiveTab(tab)}
                                        >
                                            {tab}
                                        </button>
                                    ))
                                ) : (
                                    <span className="tab" style={{ cursor: 'default', opacity: 0.75 }}>No cashier mode assigned</span>
                                )}
                            </div>
                        </div>

                        <div className="orders-list-wrapper">
                            {filteredOrders.length > 0 ? (
                                filteredOrders.map(order => (
                                    <div
                                        key={order.id}
                                        className={`order-card ${selectedOrder && selectedOrder.id === order.id ? 'active' : ''} ${order.type === 'Room' ? 'type-room' : 'type-dinein'}`}
                                        onClick={() => handleOrderClick(order)}
                                    >
                                        <div className="order-item-left">
                                            <span className="order-id">Order {order.billNo}</span>
                                            <span className="order-source">{order.name} • {order.guest.split('-')[0].trim()}</span>
                                            <span className="order-kot">{order.kotInfo}</span>
                                        </div>
                                        <div className="order-item-right">
                                            <span className="order-amount">{cs} {order.amount}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-orders-state">
                                    <div className="no-orders-icon">📦</div>
                                    <p>No more orders</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CENTER + RIGHT PANELS: Bill & Payment */}
                    <CashierPayment
                        order={selectedOrder}
                        onPaymentComplete={handlePaymentComplete}
                        onClearSelection={() => setSelectedOrder(null)}
                        checkedInRooms={checkedInRooms}
                    />

                    <div className="mobile-panel-overlay" onClick={() => { setShowOrdersMobile(false); setShowPaymentMobile(false); }} />

                </div>

                <div className="mobile-bottom-nav" role="navigation" aria-label="Cashier Mobile Navigation">
                    <button
                        type="button"
                        className={`mobile-nav-btn ${showOrdersMobile ? 'active' : ''}`}
                        onClick={() => {
                            setShowOrdersMobile(prev => !prev);
                            setShowPaymentMobile(false);
                        }}
                    >
                        Orders
                    </button>
                    <button
                        type="button"
                        className={`mobile-nav-btn ${showPaymentMobile ? 'active' : ''}`}
                        onClick={() => {
                            setShowPaymentMobile(prev => !prev);
                            setShowOrdersMobile(false);
                        }}
                    >
                        Payment
                    </button>
                </div>

                <button
                    type="button"
                    className="mobile-fab-pay"
                    onClick={() => {
                        setShowPaymentMobile(true);
                        setShowOrdersMobile(false);
                    }}
                    aria-label="Open payment panel"
                >
                    🛒
                </button>
            </div>
        </div>

        {/* Track Order Modal */}
            {showTrackModal && (
                <div className="add-payment-overlay" onClick={() => { setShowTrackModal(false); setTrackedOrders(null); setTrackQuery(''); setTrackWarning(''); }}>
                    <div className="add-payment-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span role="img" aria-label="track">📡</span>
                            </div>
                            <div className="header-text">
                                <h3>Track Order</h3>
                                <span>Order Status Tracking</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => { setShowTrackModal(false); setTrackedOrders(null); setTrackQuery(''); setTrackWarning(''); }}>×</button>
                        </div>
                        <div className="add-payment-body">
                            <div className="payment-field-group">
                                <label className="field-label-premium">PHONE NUMBER *</label>
                                <div className="premium-input-wrapper">
                                    <div className="input-icon-prefix">🔍</div>
                                    <input
                                        type="text"
                                        placeholder="Enter 10-digit phone number"
                                        value={trackQuery}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                            setTrackQuery(digits);
                                            if (trackWarning) setTrackWarning('');
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleTrackOrderSearch()}
                                    />
                                    <button 
                                        className="btn-primary" 
                                        onClick={handleTrackOrderSearch} 
                                        disabled={trackLoading || trackQuery.length !== 10}
                                        style={{ 
                                            width: 'auto', 
                                            height: '42px', 
                                            padding: '0 24px', 
                                            borderRadius: '10px', 
                                            margin: '4px',
                                            fontSize: '13px',
                                            flex: 'none'
                                        }}
                                    >
                                        {trackLoading ? '...' : 'CHECK'}
                                    </button>
                                </div>
                                {trackWarning && <div className="form-warning-text">{trackWarning}</div>}
                            </div>

                            {trackedOrders && trackedOrders.length > 0 && (
                                <div className="track-summary-banner">
                                    <div>
                                        <div className="summary-title">Latest Match</div>
                                        <div className="summary-main">{trackedOrders[0].guestName || 'Walk-in'} • {trackedOrders[0].guestPhone || 'No Phone'}</div>
                                    </div>
                                    <div className={`summary-pill step-${getStatusStep(trackedOrders[0].status)}`}>{trackedOrders[0].status}</div>
                                </div>
                            )}

                            {trackedOrders && trackedOrders.length > 0 && (() => {
                                const firstOrder = trackedOrders[0];
                                const firstStep = getStatusStep(firstOrder.status);
                                return (
                                    <div className={`track-top-result-card step-${firstStep}`}>
                                        <div className="track-card-header">
                                            <span className="track-id">#{firstOrder._id.substr(-6).toUpperCase()}</span>
                                            <span className="track-amount">{cs}{firstOrder.finalAmount}</span>
                                        </div>
                                        <div className="track-guest">{firstOrder.guestName} ({firstOrder.guestPhone || 'No Phone'})</div>
                                        <div className="track-current-status">Current Stage: {getStepLabel(firstStep)}</div>

                                        <div className="track-status-stepper">
                                            <div className={`step-item ${firstStep >= 1 ? 'completed' : ''} ${firstStep === 1 ? 'active' : ''}`}>
                                                <div className="step-circle">{firstStep > 1 ? '✓' : '1'}</div>
                                                <div className="step-label">Pending</div>
                                            </div>
                                            <div className={`step-line ${firstStep >= 2 ? 'completed' : ''}`}></div>
                                            <div className={`step-item ${firstStep >= 2 ? 'completed' : ''} ${firstStep === 2 ? 'active' : ''}`}>
                                                <div className="step-circle">{firstStep > 2 ? '✓' : '2'}</div>
                                                <div className="step-label">Preparing</div>
                                            </div>
                                            <div className={`step-line ${firstStep >= 3 ? 'completed' : ''}`}></div>
                                            <div className={`step-item ${firstStep >= 3 ? 'completed' : ''} ${firstStep === 3 ? 'active' : ''}`}>
                                                <div className="step-circle">{firstStep > 3 ? '✓' : '3'}</div>
                                                <div className="step-label">Ready</div>
                                            </div>
                                        </div>

                                        {firstOrder.status === 'Ready' && (
                                            <div className="ready-alert">
                                                🎉 Order is Ready for Pickup!
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            <div className="track-results-area" style={{ marginTop: '10px' }}>
                                {trackedOrders === null ? (
                                    <div className="placeholder-text" style={{ textAlign: 'center', color: '#94a3b8', marginTop: '24px' }}>
                                        Enter 10-digit number to track status
                                    </div>
                                ) : trackedOrders.length === 0 ? (
                                    <div className="placeholder-text" style={{ textAlign: 'center', color: '#ef4444', marginTop: '24px' }}>
                                        No active orders found for this number.
                                    </div>
                                ) : (
                                    <div className="tracked-orders-list">
                                        {trackedOrders.slice(1).map(order => {
                                            const step = getStatusStep(order.status);
                                            return (
                                                <div key={order._id} className={`track-card step-${step}`}>
                                                    <div className="track-card-header">
                                                        <span className="track-id">#{order._id.substr(-6).toUpperCase()}</span>
                                                        <span className="track-amount">{cs}{order.finalAmount}</span>
                                                    </div>
                                                    <div className="track-guest">{order.guestName} ({order.guestPhone || 'No Phone'})</div>
                                                    <div className="track-current-status">Current Stage: {getStepLabel(step)}</div>

                                                    <div className="track-status-stepper">
                                                        <div className={`step-item ${step >= 1 ? 'completed' : ''} ${step === 1 ? 'active' : ''}`}>
                                                            <div className="step-circle">{step > 1 ? '✓' : '1'}</div>
                                                            <div className="step-label">Pending</div>
                                                        </div>
                                                        <div className={`step-line ${step >= 2 ? 'completed' : ''}`}></div>
                                                        <div className={`step-item ${step >= 2 ? 'completed' : ''} ${step === 2 ? 'active' : ''}`}>
                                                            <div className="step-circle">{step > 2 ? '✓' : '2'}</div>
                                                            <div className="step-label">Preparing</div>
                                                        </div>
                                                        <div className={`step-line ${step >= 3 ? 'completed' : ''}`}></div>
                                                        <div className={`step-item ${step >= 3 ? 'completed' : ''} ${step === 3 ? 'active' : ''}`}>
                                                            <div className="step-circle">{step > 3 ? '✓' : '3'}</div>
                                                            <div className="step-label">Ready</div>
                                                        </div>
                                                    </div>

                                                    {order.status === 'Ready' && (
                                                        <div className="ready-alert">
                                                            🎉 Order is Ready for Pickup!
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showNewOrderModal && (
                <div className="add-payment-overlay" onClick={() => { setShowNewOrderModal(false); setNewOrderWarning(''); }}>
                    <div className="add-payment-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span role="img" aria-label="new-order">🛍️</span>
                            </div>
                            <div className="header-text">
                                <h3>New Take Away Order</h3>
                                <span>Customer Essentials</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => { setShowNewOrderModal(false); setNewOrderWarning(''); }}>×</button>
                        </div>

                        <div className="add-payment-body">
                            {newOrderWarning && <div className="form-warning-text">{newOrderWarning}</div>}

                            <div className="payment-field-group">
                                <label className="field-label-premium">PHONE NUMBER *</label>
                                <div className="premium-input-wrapper">
                                    <div className="input-icon-prefix">📞</div>
                                    <input
                                        type="tel"
                                        placeholder="Enter 10-digit phone number"
                                        value={newOrderDetails.phone}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                            setNewOrderDetails({ ...newOrderDetails, phone: value });
                                            if (newOrderWarning) setNewOrderWarning('');
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="payment-field-group">
                                <label className="field-label-premium">CUSTOMER NAME *</label>
                                <div className="premium-input-wrapper">
                                    <div className="input-icon-prefix">👤</div>
                                    <input
                                        type="text"
                                        placeholder="Enter Customer Name"
                                        value={newOrderDetails.name}
                                        onChange={(e) => {
                                            const nameValue = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                            setNewOrderDetails({ ...newOrderDetails, name: nameValue });
                                            if (newOrderWarning) setNewOrderWarning('');
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="payment-modal-footer">
                            <button type="button" className="btn-secondary" onClick={() => setShowNewOrderModal(false)}>
                                CANCEL
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleGoToFoodMenu}
                                disabled={newOrderDetails.phone.length !== 10 || !newOrderDetails.name.trim()}
                            >
                                OPEN FOOD MENU
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const CashierPayment = ({ order, onPaymentComplete, onClearSelection, checkedInRooms = [] }) => {
    const { settings, getCurrencySymbol, formatDate } = useSettings();
    const cs = getCurrencySymbol();
    const initialSplitAmounts = { Cash: '', UPI: '', Card: '', 'Bank Transfer': '' };
    const initialSplitReferences = { UPI: '', Card: '', 'Bank Transfer': '' };

    // Inclusive Tax toggle acts as global tax enable switch for cashier billing.
    const computedSubtotal = order ? order.items.reduce((s, i) => s + i.amount, 0) : 0;
    const taxEnabled = Boolean(settings.inclusiveTax);
    const cgstPct = parseFloat(settings.cgst) || 0;
    const sgstPct = parseFloat(settings.sgst) || 0;
    const rawFoodGstPct = (cgstPct + sgstPct) > 0 ? (cgstPct + sgstPct) : (parseFloat(settings.foodGst) || 0);
    const foodGstPct = taxEnabled ? rawFoodGstPct : 0;
    const svcChargePct = parseFloat(settings.roomServiceCharge) || 0;
    let taxAmtComputed = 0, svcAmtComputed = 0;
    let grandTotalComputed = computedSubtotal;
    if (computedSubtotal > 0) {
        taxAmtComputed = Math.round(computedSubtotal * foodGstPct / 100);
        svcAmtComputed = Math.round(computedSubtotal * svcChargePct / 100);
        grandTotalComputed = computedSubtotal + taxAmtComputed + svcAmtComputed;
    }

    // State for payment interactions
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [paymentType, setPaymentType] = useState('Direct Payment');
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [splitAmounts, setSplitAmounts] = useState(initialSplitAmounts);
    const [splitReferences, setSplitReferences] = useState(initialSplitReferences);
    const [receivedAmount, setReceivedAmount] = useState('');
    const [upiUtr, setUpiUtr] = useState('');
    const [bankTransactionId, setBankTransactionId] = useState('');
    const [cardTransactionId, setCardTransactionId] = useState('');
    const [returnAmount, setReturnAmount] = useState(0);
    const [targetRoom, setTargetRoom] = useState('');
    const [targetFolioId, setTargetFolioId] = useState(0); // Default to Primary Folio
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [isTendered, setIsTendered] = useState(false);
    const [showPrintDropdown, setShowPrintDropdown] = useState(false);
    const [showEditBill, setShowEditBill] = useState(false);
    const [editItems, setEditItems] = useState([]);
    const [pendingRemoveItemIndex, setPendingRemoveItemIndex] = useState(null);
    const [paymentSuccessNote, setPaymentSuccessNote] = useState('');
    const [sideNoteText, setSideNoteText] = useState('');
    const [showSideNote, setShowSideNote] = useState(false);
    const [lastPrintableBill, setLastPrintableBill] = useState(null);

    const printDropdownRef = useRef(null);
    const tenderResetTimerRef = useRef(null);
    const sideNoteTimerRef = useRef(null);

    // Derived: list of folios for current booking
    const availableFolios = useMemo(() => {
        if (!selectedBooking) return [];
        const folios = [{ id: 0, name: `Primary - ${selectedBooking.guestName}` }];
        if (selectedBooking.additionalGuests && Array.isArray(selectedBooking.additionalGuests)) {
            selectedBooking.additionalGuests.forEach((g, i) => {
                folios.push({ id: i + 1, name: g.name || `Guest ${i + 1}` });
            });
        }
        return folios;
    }, [selectedBooking]);

    // Discount states
    const [discountType, setDiscountType] = useState('PERCENTAGE');
    const [discountValue, setDiscountValue] = useState('');
    const [discountSource, setDiscountSource] = useState('');



    // Initial state reset only when selected order changes.
    // Do not reset on checkedInRooms periodic refresh, otherwise split mode jumps back.
    useEffect(() => {
        if (tenderResetTimerRef.current) {
            clearTimeout(tenderResetTimerRef.current);
            tenderResetTimerRef.current = null;
        }

        if (order) {
            const firstMode = settings.paymentModes?.upi ? 'UPI' : settings.paymentModes?.card ? 'Card' : 'Cash';
            const defaultPayMode = settings.paymentModes?.cash !== false ? 'Cash' : firstMode;
            setPaymentMode(defaultPayMode);
            setPaymentType('Direct Payment');
            setIsSplitPayment(false);
            setSplitAmounts(initialSplitAmounts);
            setSplitReferences(initialSplitReferences);
            setUpiUtr('');
            setBankTransactionId('');
            setCardTransactionId('');
            setIsTendered(false);
            setShowPrintDropdown(false);
            setShowEditBill(false);
            setPaymentSuccessNote('');

            // Auto-fill discount from rules for food/all-bill orders
            let autoDiscType = 'PERCENTAGE', autoDiscVal = '', autoDiscSrc = '';
            try {
                const discounts = JSON.parse(localStorage.getItem('discounts') || '[]');
                const match = discounts.find(
                    d => d.status === 'ACTIVE' && d.autoApply &&
                    Array.isArray(d.appliesTo) &&
                    (d.appliesTo.includes('FOOD') || d.appliesTo.includes('BILL'))
                );
                if (match) {
                    autoDiscType = match.type === 'FLAT' ? 'FLAT' : 'PERCENTAGE';
                    autoDiscVal = String(match.value);
                    autoDiscSrc = match.name;
                }
            } catch { /* ignore */ }
            setDiscountType(autoDiscType);
            setDiscountValue(autoDiscVal);
            setDiscountSource(autoDiscSrc);

            // Set received amount to net after auto-discount
            const autoDiscAmt = autoDiscVal
                ? autoDiscType === 'PERCENTAGE'
                    ? Math.round(grandTotalComputed * (parseFloat(autoDiscVal) || 0) / 100)
                    : parseFloat(autoDiscVal) || 0
                : 0;
            setReceivedAmount(Math.max(0, grandTotalComputed - autoDiscAmt).toString());

            // Pre-fill room number if it's a Room order
            if (order.type === 'Room' && order.name.includes('Room')) {
                const rNum = order.name.replace('Room', '').trim();
                setTargetRoom(rNum);
                const booking = checkedInRooms.find(b => b.roomNumber === rNum);
                if (booking) setSelectedBooking(booking);
            } else {
                setTargetRoom('');
                setSelectedBooking(null);
            }
        } else {
            setReceivedAmount('');
            setReturnAmount(0);
            setTargetRoom('');
            setSelectedBooking(null);
            setIsTendered(false);
            setShowPrintDropdown(false);
            setShowEditBill(false);
            setPaymentSuccessNote('');
            setDiscountValue('');
            setDiscountSource('');
            setDiscountType('PERCENTAGE');
            setIsSplitPayment(false);
            setSplitAmounts(initialSplitAmounts);
            setSplitReferences(initialSplitReferences);
            setUpiUtr('');
            setBankTransactionId('');
            setCardTransactionId('');
        }
    }, [order]);

    useEffect(() => {
        return () => {
            if (tenderResetTimerRef.current) {
                clearTimeout(tenderResetTimerRef.current);
                tenderResetTimerRef.current = null;
            }

            if (sideNoteTimerRef.current) {
                clearTimeout(sideNoteTimerRef.current);
                sideNoteTimerRef.current = null;
            }
        };
    }, []);

    const showSimpleSideNote = (message) => {
        if (sideNoteTimerRef.current) {
            clearTimeout(sideNoteTimerRef.current);
            sideNoteTimerRef.current = null;
        }

        setSideNoteText(message);
        setShowSideNote(true);

        sideNoteTimerRef.current = setTimeout(() => {
            setShowSideNote(false);
            sideNoteTimerRef.current = null;
        }, 2200);
    };

    // Close print dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (printDropdownRef.current && !printDropdownRef.current.contains(e.target)) {
                setShowPrintDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (pendingRemoveItemIndex === null) return;

        const timer = setTimeout(() => setPendingRemoveItemIndex(null), 5000);
        return () => clearTimeout(timer);
    }, [pendingRemoveItemIndex]);

    const directPaymentModes = useMemo(() => {
        const modes = [];
        if (settings.paymentModes?.cash !== false) modes.push('Cash');
        if (settings.paymentModes?.upi !== false) modes.push('UPI');
        if (settings.paymentModes?.card !== false) modes.push('Card');
        if (settings.paymentModes?.bankTransfer) modes.push('Bank Transfer');
        return modes;
    }, [settings.paymentModes]);

    const splitPaymentModes = useMemo(() => [...directPaymentModes], [directPaymentModes]);

    const splitTotalReceived = useMemo(() => {
        return Object.values(splitAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    }, [splitAmounts]);

    const splitUsedModesCount = useMemo(() => {
        return splitPaymentModes.filter(mode => (parseFloat(splitAmounts[mode]) || 0) > 0).length;
    }, [splitPaymentModes, splitAmounts]);

    // Discount + final payable computation
    const discountAmt = discountValue
        ? discountType === 'PERCENTAGE'
            ? Math.round(grandTotalComputed * (parseFloat(discountValue) || 0) / 100)
            : parseFloat(discountValue) || 0
        : 0;
    const netAfterDiscount = Math.max(0, grandTotalComputed - discountAmt);

    const splitRemainingAmount = useMemo(() => {
        return Math.max(0, netAfterDiscount - splitTotalReceived);
    }, [netAfterDiscount, splitTotalReceived]);

    const splitHasMismatch = useMemo(() => {
        return Math.abs(splitTotalReceived - netAfterDiscount) > 0.01;
    }, [splitTotalReceived, netAfterDiscount]);

    const effectiveReceivedAmount = isSplitPayment ? splitTotalReceived : (parseFloat(receivedAmount) || 0);

    // Calculate Return Amount
    useEffect(() => {
        if (order) {
            const discAmt = discountValue
                ? discountType === 'PERCENTAGE'
                    ? Math.round(grandTotalComputed * (parseFloat(discountValue) || 0) / 100)
                    : parseFloat(discountValue) || 0
                : 0;
            setReturnAmount(effectiveReceivedAmount - Math.max(0, grandTotalComputed - discAmt));
        } else {
            setReturnAmount(0);
        }
    }, [effectiveReceivedAmount, order, discountType, discountValue, grandTotalComputed]);

    const currentSplitBreakup = useMemo(() => {
        if (!(paymentType === 'Direct Payment' && isSplitPayment)) return [];
        return splitPaymentModes
            .map(mode => ({ mode, amount: parseFloat(splitAmounts[mode]) || 0 }))
            .filter(entry => entry.amount > 0);
    }, [paymentType, isSplitPayment, splitPaymentModes, splitAmounts]);

    const normalizeUtrInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 12);
    const normalizeTxnInput = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    const isValidUtr = (value) => /^\d{12}$/.test(String(value || ''));
    const isValidTxnId = (value) => /^(?:[A-Z0-9]{10}|[A-Z0-9]{12}|[A-Z0-9]{15})$/.test(String(value || ''));

    const printFormats = [
        { key: 'a4', label: 'A4', icon: '📄', pageSize: '210mm 297mm', bodyWidth: '190mm' },
        { key: 'a5', label: 'A5', icon: '📃', pageSize: '148mm 210mm', bodyWidth: '130mm' },
        { key: 'thermal', label: 'Thermal', icon: '🧾', pageSize: '80mm auto', bodyWidth: '72mm' },
        { key: 'dotmatrix', label: 'Dot Matrix', icon: '🖨️', pageSize: '210mm auto', bodyWidth: '190mm' },
        { key: '3inch', label: '3 inch', icon: '📜', pageSize: '76mm auto', bodyWidth: '68mm' },
        { key: '2inch', label: '2 inch', icon: '🔖', pageSize: '58mm auto', bodyWidth: '50mm' },
    ];

    const handlePrintBill = (format = 'thermal') => {
        const printOrder = order || lastPrintableBill?.order;
        if (!printOrder) {
            showSimpleSideNote('No bill available to print');
            return;
        }
        setShowPrintDropdown(false);

        const fmt = printFormats.find(f => f.key === format) || printFormats[2];
        const isNarrow = ['thermal', '3inch', '2inch'].includes(format);
        const fontSize = format === '2inch' ? '9px' : format === '3inch' ? '10px' : '11px';
        const logoSize = isNarrow ? '16px' : '24px';
        const windowWidth = isNarrow ? 350 : 700;
        const printSubtotal = order ? computedSubtotal : (lastPrintableBill?.subtotal || 0);
        const printTax = order ? taxAmtComputed : (lastPrintableBill?.tax || 0);
        const printService = order ? svcAmtComputed : (lastPrintableBill?.service || 0);
        const printGrand = order ? grandTotalComputed : (lastPrintableBill?.grand || 0);
        const printDiscount = order ? discountAmt : (lastPrintableBill?.discountAmt || 0);
        const printNet = order ? netAfterDiscount : (lastPrintableBill?.net || 0);
        const printDiscountType = order ? discountType : (lastPrintableBill?.discountType || 'PERCENTAGE');
        const printDiscountValue = order ? discountValue : (lastPrintableBill?.discountValue || '');
        const printDiscountSource = order ? discountSource : (lastPrintableBill?.discountSource || '');
        const printPaymentBreakup = order
            ? currentSplitBreakup
            : (Array.isArray(lastPrintableBill?.paymentBreakup) ? lastPrintableBill.paymentBreakup : []);
        const printPaymentReceivedTotal = order
            ? currentSplitBreakup.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
            : (Number(lastPrintableBill?.paymentReceivedTotal) || 0);
        const printDiscountLabel = printDiscountType === 'PERCENTAGE'
            ? `${Number(printDiscountValue || 0)}%`
            : `${cs}${Number(printDiscountValue || 0).toFixed(2)}`;
        const printInvoicePrefix = settings.billingInvoicePrefix || settings.invoicePrefix || 'INV';

        const invoiceContent = `
    <!DOCTYPE html>
        <html>
            <head>
                <title>Invoice ${printOrder.billNo}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Libre+Barcode+39+Text&display=swap" rel="stylesheet">
                    <style>
                        @page { size: ${fmt.pageSize}; margin: ${isNarrow ? '0' : '10mm'}; }
                        body {
                            font-family: ${format === 'dotmatrix' ? "'Courier New', monospace" : "'Inter', sans-serif"};
                            width: ${fmt.bodyWidth};
                            margin: ${isNarrow ? '4mm' : '10mm'} auto;
                            background: white;
                            color: #000;
                            font-size: ${fontSize};
                            line-height: 1.4;
                        }
                        .header { text-align: center; margin-bottom: 12px; }
                        .logo-image { max-height: ${isNarrow ? '42px' : '68px'}; max-width: 180px; object-fit: contain; margin: 0 auto 8px auto; display: block; mix-blend-mode: multiply; background: transparent; }
                        .logo-area { font-size: ${logoSize}; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 2px; }
                        .subtitle { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #444; margin-bottom: 8px; }
                        .contact-info { font-size: 9px; color: #666; line-height: 1.2; }
                        
                        .divider { border-top: 1px dashed #ccc; margin: 10px 0; }
                        .bill-info { margin-bottom: 10px; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                        .info-label { color: #666; }
                        .info-value { font-weight: 700; }

                        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                        th { text-align: left; border-bottom: 1.5px solid #000; padding: 6px 0; font-size: 10px; text-transform: uppercase; }
                        td { padding: 8px 0; vertical-align: top; border-bottom: 0.5px solid #eee; }
                        .col-qty { text-align: center; width: 10%; }
                        .col-amt { text-align: right; width: 30%; }
                        .col-item { width: 60%; font-weight: 500; }

                        .totals { margin-top: 8px; }
                        .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px; }
                        .grand-total { 
                            display: flex; 
                            justify-content: space-between; 
                            margin-top: 8px; 
                            padding: 10px 0; 
                            border-top: 2px solid #000; 
                            border-bottom: 2.5px double #000;
                            font-size: 15px; 
                            font-weight: 800; 
                        }

                        .footer { margin-top: 20px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
                        .footer-qr { width: ${isNarrow ? '88px' : '126px'}; height: ${isNarrow ? '88px' : '126px'}; object-fit: contain; margin: 0 auto 6px auto; display: block; }
                        .invoice-prefix { font-size: 10px; font-weight: 700; margin-bottom: 4px; }
                        .thanks { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
                        .visit-again { font-size: 9px; color: #666; }
                        .barcode { 
                            text-align: center; 
                            margin-top: 15px; 
                            font-family: 'Libre Barcode 39 Text', cursive; 
                            font-size: 32px; 
                            opacity: 0.8;
                        }
                        .timestamp { font-size: 8px; color: #999; margin-top: 15px; text-align: center; }
                    </style>
            </head>
            <body>
                <div class="header">
                    ${settings.displayLogoOnBill && settings.logoUrl ? `<img class="logo-image" src="${settings.logoUrl}" alt="Hotel Logo" />` : ''}
                    ${settings.displayLogoOnBill && settings.logoUrl ? '' : `<div class="logo-area">${settings.name || 'Hotel'}</div>`}
                    <div class="subtitle">Premium Hospitality</div>
                    <div class="contact-info">
                        ${[settings.address, settings.city, settings.state, settings.pin].filter(Boolean).join(', ')}<br>
                        ${settings.phone ? 'Ph: ' + settings.phone + ' | ' : ''}GSTIN: ${settings.gstNumber || 'N/A'}
                    </div>
                </div>

                <div class="divider"></div>

                <div class="bill-info">
                    <div class="info-row">
                        <span class="info-label">Bill No:</span>
                        <span class="info-value">${printOrder.billNo}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Guest:</span>
                        <span class="info-value">${printOrder.guest}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Source:</span>
                        <span class="info-value">${printOrder.type} - ${printOrder.name}</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th class="col-item">Item Description</th>
                            <th class="col-qty">Qty</th>
                            <th class="col-amt">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${printOrder.items.map(item => `
                                <tr>
                                    <td class="col-item">${item.name}</td>
                                    <td class="col-qty">${item.qty}</td>
                                    <td class="col-amt">${item.amount.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="total-row">
                        <span>Subtotal</span>
                        <span>${cs} ${printSubtotal.toFixed(2)}</span>
                    </div>
                    ${foodGstPct > 0 ? `<div class="total-row">
                        <span>Food GST (${foodGstPct.toFixed(0)}%)</span>
                        <span>${cs} ${printTax.toFixed(2)}</span>
                    </div>` : ''}
                    ${svcChargePct > 0 ? `<div class="total-row">
                        <span>Service Charge (${svcChargePct.toFixed(0)}%)</span>
                        <span>${cs} ${printService.toFixed(2)}</span>
                    </div>` : ''}
                    <div class="total-row">
                        <span>Grand Total</span>
                        <span>${cs} ${printGrand.toFixed(2)}</span>
                    </div>
                    ${printDiscount > 0 ? `<div class="total-row">
                        <span>Discount${printDiscountSource ? ` (${printDiscountSource} - ${printDiscountLabel})` : ` (${printDiscountLabel})`}</span>
                        <span>-${cs} ${printDiscount.toFixed(2)}</span>
                    </div>` : ''}
                    <div class="grand-total">
                        <span>NET PAYABLE</span>
                        <span>${cs} ${printNet.toFixed(2)}</span>
                    </div>
                    ${printPaymentBreakup.length > 0 ? `
                    <div style="margin-top:8px; border-top:1px dashed #cbd5e1; padding-top:6px;">
                        <div class="total-row" style="font-weight:700;">
                            <span>Payment Breakup</span>
                            <span>${cs} ${printPaymentReceivedTotal.toFixed(2)}</span>
                        </div>
                        ${printPaymentBreakup.map(row => `
                            <div class="total-row">
                                <span>${row.mode}</span>
                                <span>${cs} ${(Number(row.amount) || 0).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>` : ''}
                </div>

                ${printOrder.notes ? `
                <div class="divider"></div>
                <div style="font-style: italic; background: #f8f9fa; padding: 5px; border-left: 3px solid #000; font-size: 10px; margin-top: 10px;">
                    <strong>Note:</strong> ${printOrder.notes}
                </div>` : ''}

                <div class="footer">
                    ${settings.qrCodeUrl ? `<img class="footer-qr" src="${settings.qrCodeUrl}" alt="Payment QR" />` : ''}
                    <div class="invoice-prefix">Invoice Prefix: ${printInvoicePrefix}</div>
                    <div class="thanks">${settings.thankYouMessage || 'Thank You!'}</div>
                    <div class="visit-again">We hope to see you again soon.</div>
                    <div class="barcode">${printOrder.billNo.replace('#', '')}</div>
                </div>

                <div class="timestamp">
                    Printed on: ${formatDate(new Date().toISOString())} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    }
                </script>
            </body>
        </html>
`;

        const printWindow = window.open('', '_blank', `height=600,width=${windowWidth}`);
        printWindow.document.write(invoiceContent);
        printWindow.document.close();
    };

    const handleEmailBill = () => {
        if (!order) return;
        showSimpleSideNote(`Email successfully sent to ${order.guest} for Invoice ${order.billNo}`);
    };

    const handleSendSMS = () => {
        if (!order) return;
        showSimpleSideNote(`SMS successfully sent to ${order.guest}`);
    };

    const handleTender = async () => {
        if (!order) return;

        // Validation for "Add to Room"
        if (paymentType === 'Add to Room') {
            if (!targetRoom.trim()) {
                alert('⚠️ Please enter a valid Room Number to add to folio!');
                return;
            }
        }

        // Validation for "Direct Payment"
        if (paymentType === 'Direct Payment') {
            const received = effectiveReceivedAmount;
            if (received < netAfterDiscount) {
                alert('⚠️ Received amount cannot be less than bill amount!');
                return;
            }

            if (!isSplitPayment) {
                if (paymentMode === 'UPI' && !isValidUtr(upiUtr)) {
                    alert('⚠️ UPI payment ke liye valid 12-digit UTR number required hai.');
                    return;
                }
                if (paymentMode === 'Bank Transfer' && !isValidTxnId(bankTransactionId)) {
                    alert('⚠️ Bank payment Transaction ID valid hona chahiye (A-Z/0-9 only, length 10/12/15).');
                    return;
                }
                if (paymentMode === 'Card' && !isValidTxnId(cardTransactionId)) {
                    alert('⚠️ Card payment Transaction ID valid hona chahiye (A-Z/0-9 only, length 10/12/15).');
                    return;
                }
            }

            if (isSplitPayment) {
                const usedModes = splitPaymentModes.filter(mode => (parseFloat(splitAmounts[mode]) || 0) > 0);
                if (usedModes.length < 2) {
                    alert('⚠️ Multiple payment me kam se kam 2 payment modes enter karein.');
                    return;
                }

                if (Math.abs(splitTotalReceived - netAfterDiscount) > 0.01) {
                    alert(`⚠️ Split total (${splitTotalReceived.toFixed(2)}) aur bill amount (${netAfterDiscount.toFixed(2)}) same hona chahiye.`);
                    return;
                }

                if (usedModes.includes('UPI') && !isValidUtr(splitReferences.UPI)) {
                    alert('⚠️ Split UPI payment ke liye valid 12-digit UTR number required hai.');
                    return;
                }
                if (usedModes.includes('Bank Transfer') && !isValidTxnId(splitReferences['Bank Transfer'])) {
                    alert('⚠️ Split Bank payment Transaction ID valid hona chahiye (A-Z/0-9 only, length 10/12/15).');
                    return;
                }
                if (usedModes.includes('Card') && !isValidTxnId(splitReferences.Card)) {
                    alert('⚠️ Split Card payment Transaction ID valid hona chahiye (A-Z/0-9 only, length 10/12/15).');
                    return;
                }
            }
        }

        // Percentage discount validation
        if (discountType === 'PERCENTAGE' && parseFloat(discountValue) > 100) {
            if (!window.confirm(`⚠️ You have entered a ${discountValue}% discount, which is more than 100%. The grand total will be 0. Continue?`)) {
                return;
            }
        }

        const activeSplits = paymentType === 'Direct Payment' && isSplitPayment
            ? splitPaymentModes
                .map(modeName => ({
                    mode: modeName,
                    amount: parseFloat(splitAmounts[modeName]) || 0,
                    referenceId: modeName === 'UPI'
                        ? normalizeUtrInput(splitReferences.UPI)
                        : modeName === 'Bank Transfer'
                            ? normalizeTxnInput(splitReferences['Bank Transfer'])
                            : modeName === 'Card'
                                ? normalizeTxnInput(splitReferences.Card)
                                : '',
                }))
                .filter(s => s.amount > 0)
            : [];

        const paymentReference = paymentMode === 'UPI'
            ? normalizeUtrInput(upiUtr)
            : paymentMode === 'Bank Transfer'
                ? normalizeTxnInput(bankTransactionId)
                : paymentMode === 'Card'
                    ? normalizeTxnInput(cardTransactionId)
                    : '';

        const settledPaymentBreakup = activeSplits.length > 0
            ? activeSplits.map(split => ({ mode: split.mode, amount: Number(split.amount) || 0 }))
            : (paymentType === 'Direct Payment'
                ? [{ mode: paymentMode, amount: Number(effectiveReceivedAmount || netAfterDiscount) || 0 }]
                : []);

        // Trigger completion callback
        const settled = await onPaymentComplete(
            order.id,
            netAfterDiscount,
            activeSplits.length > 0 ? 'Mixed' : paymentMode,
            paymentType,
            targetRoom,
            targetFolioId,
            {
                subtotal: computedSubtotal,
                taxAmount: taxAmtComputed,
                serviceChargeAmount: svcAmtComputed,
                grandTotal: grandTotalComputed,
                discountAmount: discountAmt,
                discountType,
                discountValue,
                discountSource,
                paymentReference,
                splitReferences,
                netPayable: netAfterDiscount,
                sourceOrderCategory: order.type,
                sourceOrderName: order.name,
                items: (order.items || []).map(item => ({
                    name: item.name,
                    quantity: item.qty || item.quantity || 1,
                    amount: item.amount
                }))
            },
            activeSplits.length > 0 ? activeSplits : null,
            selectedBooking?._id || null
        );
        if (!settled) return;

        setLastPrintableBill({
            order: {
                ...order,
                items: Array.isArray(order.items) ? order.items.map(item => ({ ...item })) : []
            },
            subtotal: computedSubtotal,
            tax: taxAmtComputed,
            service: svcAmtComputed,
            grand: grandTotalComputed,
            discountAmt,
            discountType,
            discountValue,
            discountSource,
            paymentBreakup: settledPaymentBreakup,
            paymentReceivedTotal: settledPaymentBreakup.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
            net: netAfterDiscount,
        });

        setIsTendered(true);
        setPaymentSuccessNote('Payment successful');

        tenderResetTimerRef.current = setTimeout(() => {
            setShowPrintDropdown(false);
            setReceivedAmount('');
            setIsSplitPayment(false);
            setSplitAmounts(initialSplitAmounts);
            setSplitReferences(initialSplitReferences);
            setUpiUtr('');
            setBankTransactionId('');
            setCardTransactionId('');
            setReturnAmount(0);
            setDiscountType('PERCENTAGE');
            setDiscountValue('');
            setDiscountSource('');
            setTargetRoom('');
            setSelectedBooking(null);
            setTargetFolioId(0);
            onClearSelection?.();
            tenderResetTimerRef.current = null;
        }, 900);
    };

    // If no order is selected, show empty state with same structure
    const displayOrder = order || {
        name: 'Select Order',
        guest: '-',
        time: '-',
        amount: 0,
        items: [],
        billNo: '-',
        kotInfo: '-'
    };

    const isPlaceholder = !order;

    return (
        <>
            <div className={`side-note-toast ${showSideNote ? 'show' : ''}`}>
                {sideNoteText}
            </div>

            {/* CENTER PANEL: Bill Details */}
            <div className="pos-card bill-center-panel">
                <div className="bill-center-header">
                    <h2>Bill Details</h2>
                </div>

                {/* Selected Order Header */}
                <div className="selected-order-header-modern">
                    <div className="guest-profile">
                        <div className="avatar">👤</div>
                        <div className="guest-meta">
                            <h3>{displayOrder.name}</h3>
                            <p>Today 1 - </p>
                        </div>
                    </div>
                    <div className="bill-badge">
                        - | Bill <span>›</span>
                    </div>
                </div>

                {/* Items Table */}
                <div className="bill-items-container-modern">
                    {isPlaceholder ? (
                        <div className="empty-bill-state-modern">
                            <span className="empty-icon">📋</span>
                            <p>Select an order from the list to view items</p>
                        </div>
                    ) : (
                        <table className="items-table-modern">
                            <thead>
                                <tr>
                                    <th align="left">Item</th>
                                    <th align="center">Qty</th>
                                    <th align="right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!isPlaceholder && (displayOrder.items && displayOrder.items.length > 0) ? (
                                    displayOrder.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td align="left">{item.name}</td>
                                            <td align="center">× {item.qty}</td>
                                            <td align="right">{cs} {item.amount}</td>
                                        </tr>
                                    ))
                                ) : (
                                    !isPlaceholder && (
                                        <tr>
                                            <td colSpan="3" align="center" style={{ padding: '40px', color: '#94a3b8' }}>
                                                No items found in this order.
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Summary Totals */}
                <div className="bill-summary-panel">
                    <div className="summary-row-modern">
                        <span>Subtotal</span>
                        <span>{cs} {computedSubtotal.toFixed(0)}</span>
                    </div>
                    {!taxEnabled && (
                        <div className="summary-row-modern">
                            <span>Food GST</span>
                            <span style={{ color: '#94a3b8', fontWeight: 700 }}>Disabled</span>
                        </div>
                    )}
                    {foodGstPct > 0 && (
                        <div className="summary-row-modern">
                            <span>Food GST ({foodGstPct}%)</span>
                            <span>{cs} {taxAmtComputed.toFixed(0)}</span>
                        </div>
                    )}
                    {svcChargePct > 0 && (
                        <div className="summary-row-modern">
                            <span>Service Charge ({svcChargePct}%)</span>
                            <span>{cs} {svcAmtComputed.toFixed(0)}</span>
                        </div>
                    )}
                    <div className="summary-row-modern grand-total-highlight">
                        <span>Grand Total</span>
                        <span>{cs} {grandTotalComputed.toFixed(0)}</span>
                    </div>

                    {(paymentType === 'Direct Payment' && isSplitPayment && currentSplitBreakup.length > 0) && (
                        <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: '8px', paddingTop: '8px' }}>
                            <div className="summary-row-modern" style={{ fontWeight: 700 }}>
                                <span>Payment Breakup</span>
                                <span>{cs} {currentSplitBreakup.reduce((sum, row) => sum + row.amount, 0).toFixed(2)}</span>
                            </div>
                            {currentSplitBreakup.map(row => (
                                <div className="summary-row-modern" key={`split-row-${row.mode}`}>
                                    <span>{row.mode}</span>
                                    <span>{cs} {row.amount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Discount Section */}
                    {!isPlaceholder && (
                        <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '10px', marginTop: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                                <span style={{ fontWeight: 600, fontSize: '13px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    Discount
                                    {discountSource && (
                                        <span style={{ fontWeight: 400, fontSize: '10px', color: '#16a34a' }}>
                                            ✓ {discountSource}
                                        </span>
                                    )}
                                </span>
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: '4px', overflow: 'hidden' }}>
                                        <button type="button" onClick={() => setDiscountType('PERCENTAGE')}
                                            style={{ padding: '3px 8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px',
                                                background: discountType === 'PERCENTAGE' ? '#1d4ed8' : '#f9fafb',
                                                color: discountType === 'PERCENTAGE' ? '#fff' : '#374151' }}>%</button>
                                        <button type="button" onClick={() => setDiscountType('FLAT')}
                                            style={{ padding: '3px 8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px',
                                                background: discountType === 'FLAT' ? '#1d4ed8' : '#f9fafb',
                                                color: discountType === 'FLAT' ? '#fff' : '#374151' }}>{cs}</button>
                                    </div>
                                    <input
                                        type="number"
                                        value={discountValue}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || parseFloat(val) >= 0) {
                                                setDiscountValue(val);
                                                setDiscountSource(prev => val
                                                    ? (prev && !prev.endsWith('(Edited)') ? `${prev} (Edited)` : prev || 'Manual')
                                                    : '');
                                            }
                                        }}
                                        placeholder={discountType === 'PERCENTAGE' ? '0 %' : '0'}
                                        min="0"
                                        max={discountType === 'PERCENTAGE' ? '100' : undefined}
                                        style={{ width: '68px', padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                                    />
                                    {discountValue && (
                                        <button type="button" onClick={() => { setDiscountValue(''); setDiscountSource(''); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}>×</button>
                                    )}
                                </div>
                            </div>
                            {discountAmt > 0 && (
                                <div className="summary-row-modern" style={{ color: '#E31E24' }}>
                                    <span>Discount ({discountType === 'PERCENTAGE' ? `${discountValue}%` : `${cs}${discountValue}`})</span>
                                    <span>−{cs} {discountAmt.toFixed(0)}</span>
                                </div>
                            )}
                            <div className="summary-row-modern" style={{ fontWeight: 700, color: '#15803d', borderTop: '1.5px solid #e2e8f0', paddingTop: '6px', marginTop: '4px' }}>
                                <span>Grand Total</span>
                                <span>{cs} {netAfterDiscount.toFixed(0)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: Payment Section */}
            <div className="pos-card payment-right-panel">
                <h3 className="payment-section-title">Payment Section</h3>

                <div className="payment-modes-modern">
                    {settings.paymentModes?.cash !== false && (
                        <button
                            className={`mode-btn-modern ${(paymentType === 'Direct Payment' && !isSplitPayment && paymentMode === 'Cash') ? 'active' : ''}`}
                            onClick={() => { setPaymentType('Direct Payment'); setPaymentMode('Cash'); setIsSplitPayment(false); }}
                        >
                            💵 Cash
                        </button>
                    )}
                    {settings.paymentModes?.upi !== false && (
                        <button
                            className={`mode-btn-modern ${(paymentType === 'Direct Payment' && !isSplitPayment && paymentMode === 'UPI') ? 'active' : ''}`}
                            onClick={() => { setPaymentType('Direct Payment'); setPaymentMode('UPI'); setIsSplitPayment(false); }}
                        >
                            📱 UPI
                        </button>
                    )}
                    {settings.paymentModes?.card !== false && (
                        <button
                            className={`mode-btn-modern ${(paymentType === 'Direct Payment' && !isSplitPayment && paymentMode === 'Card') ? 'active' : ''}`}
                            onClick={() => { setPaymentType('Direct Payment'); setPaymentMode('Card'); setIsSplitPayment(false); }}
                        >
                            💳 Card
                        </button>
                    )}
                    {settings.paymentModes?.bankTransfer && (
                        <button
                            className={`mode-btn-modern ${(paymentType === 'Direct Payment' && !isSplitPayment && paymentMode === 'Bank Transfer') ? 'active' : ''}`}
                            onClick={() => { setPaymentType('Direct Payment'); setPaymentMode('Bank Transfer'); setIsSplitPayment(false); }}
                        >
                            🏦 Bank
                        </button>
                    )}
                    {paymentType === 'Direct Payment' && directPaymentModes.length > 1 && (
                        <button
                            className={`mode-btn-modern ${isSplitPayment ? 'active' : ''}`}
                            onClick={() => {
                                setIsSplitPayment(prev => {
                                    const next = !prev;
                                    if (!next) {
                                        setSplitAmounts(initialSplitAmounts);
                                        setSplitReferences(initialSplitReferences);
                                    }
                                    return next;
                                });
                            }}
                        >
                            🧩 Multiple Payment
                        </button>
                    )}
                    {settings.billingRules?.addToRoom && (
                        <button
                            className={`mode-btn-modern ${paymentType === 'Add to Room' ? 'active' : ''}`}
                            onClick={() => { setPaymentType('Add to Room'); setPaymentMode('Room'); setIsSplitPayment(false); }}
                        >
                            💼 Room Folio
                        </button>
                    )}
                </div>

                <div className="total-indicator-strip">
                    <span>Grand Total</span>
                    <span className="big-sum">{cs}{netAfterDiscount.toFixed(2)}</span>
                </div>

                {paymentType === 'Direct Payment' ? (
                    <>
                        {isSplitPayment ? (
                            <div className="payment-input-modern">
                                <label>Split Payment Amounts</label>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    {splitPaymentModes.map(modeName => {
                                        const icon = modeName === 'Cash' ? '💵' : modeName === 'UPI' ? '📱' : modeName === 'Card' ? '💳' : modeName === 'Bank Transfer' ? '🏦' : '💼';
                                        const splitAmountValue = parseFloat(splitAmounts[modeName]) || 0;
                                        return (
                                            <div key={modeName}>
                                                <div className="input-box-wrap">
                                                    <span>{icon}</span>
                                                    <input
                                                        type="number"
                                                        placeholder={`${modeName} amount`}
                                                        min="0"
                                                        value={splitAmounts[modeName] || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === '' || parseFloat(val) >= 0) {
                                                                const entered = val === '' ? 0 : (parseFloat(val) || 0);
                                                                const otherTotal = splitPaymentModes
                                                                    .filter(m => m !== modeName)
                                                                    .reduce((sum, m) => sum + (parseFloat(splitAmounts[m]) || 0), 0);
                                                                const maxForCurrent = Math.max(0, netAfterDiscount - otherTotal);
                                                                const nextVal = val === '' ? '' : String(Math.min(entered, maxForCurrent));
                                                                setSplitAmounts(prev => ({ ...prev, [modeName]: nextVal }));
                                                            }
                                                        }}
                                                        disabled={isPlaceholder}
                                                    />
                                                </div>

                                                {splitAmountValue > 0 && modeName === 'UPI' && (
                                                    <div className="input-box-wrap" style={{ marginTop: '6px' }}>
                                                        <span>🔢</span>
                                                        <input
                                                            type="text"
                                                            placeholder="Enter 12-digit UTR"
                                                            value={splitReferences.UPI}
                                                            inputMode="numeric"
                                                            maxLength={12}
                                                            onChange={(e) => setSplitReferences(prev => ({ ...prev, UPI: normalizeUtrInput(e.target.value) }))}
                                                            disabled={isPlaceholder}
                                                        />
                                                    </div>
                                                )}

                                                {splitAmountValue > 0 && modeName === 'Bank Transfer' && (
                                                    <div className="input-box-wrap" style={{ marginTop: '6px' }}>
                                                        <span>🔢</span>
                                                        <input
                                                            type="text"
                                                            placeholder="Bank Txn ID (10/12/15)"
                                                            value={splitReferences['Bank Transfer']}
                                                            maxLength={15}
                                                            onChange={(e) => setSplitReferences(prev => ({ ...prev, 'Bank Transfer': normalizeTxnInput(e.target.value) }))}
                                                            disabled={isPlaceholder}
                                                        />
                                                    </div>
                                                )}

                                                {splitAmountValue > 0 && modeName === 'Card' && (
                                                    <div className="input-box-wrap" style={{ marginTop: '6px' }}>
                                                        <span>🔢</span>
                                                        <input
                                                            type="text"
                                                            placeholder="Card Txn ID (10/12/15)"
                                                            value={splitReferences.Card}
                                                            maxLength={15}
                                                            onChange={(e) => setSplitReferences(prev => ({ ...prev, Card: normalizeTxnInput(e.target.value) }))}
                                                            disabled={isPlaceholder}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Total Received</span>
                                    <strong>{cs}{splitTotalReceived.toFixed(2)}</strong>
                                </div>
                                <div style={{ marginTop: '4px', fontSize: '0.82rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Used Modes: {splitUsedModesCount} (minimum 2)</span>
                                    <span>Remaining: {cs}{splitRemainingAmount.toFixed(2)}</span>
                                </div>
                                {splitHasMismatch && (
                                    <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#b91c1c', fontWeight: 700 }}>
                                        Split total must match Grand Total before Tender.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="payment-input-modern">
                                <label>Received Amount</label>
                                <div className="input-box-wrap">
                                    <span>{cs}</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        min="0"
                                        value={receivedAmount}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || parseFloat(val) >= 0) {
                                                const entered = val === '' ? '' : String(Math.min(parseFloat(val) || 0, netAfterDiscount));
                                                setReceivedAmount(entered);
                                            }
                                        }}
                                        disabled={isPlaceholder}
                                    />
                                </div>
                            </div>
                        )}

                        {!isSplitPayment && paymentMode === 'UPI' && (
                            <div className="payment-input-modern">
                                <label>UPI UTR Number</label>
                                <div className="input-box-wrap">
                                    <span>🔢</span>
                                    <input
                                        type="text"
                                        placeholder="Enter 12-digit UTR"
                                        value={upiUtr}
                                        inputMode="numeric"
                                        maxLength={12}
                                        onChange={(e) => setUpiUtr(normalizeUtrInput(e.target.value))}
                                        disabled={isPlaceholder}
                                    />
                                </div>
                            </div>
                        )}

                        {!isSplitPayment && paymentMode === 'Bank Transfer' && (
                            <div className="payment-input-modern">
                                <label>Bank Transaction ID</label>
                                <div className="input-box-wrap">
                                    <span>🔢</span>
                                    <input
                                        type="text"
                                        placeholder="Txn ID (10/12/15)"
                                        value={bankTransactionId}
                                        maxLength={15}
                                        onChange={(e) => setBankTransactionId(normalizeTxnInput(e.target.value))}
                                        disabled={isPlaceholder}
                                    />
                                </div>
                            </div>
                        )}

                        {!isSplitPayment && paymentMode === 'Card' && (
                            <div className="payment-input-modern">
                                <label>Card Transaction ID</label>
                                <div className="input-box-wrap">
                                    <span>🔢</span>
                                    <input
                                        type="text"
                                        placeholder="Card Txn ID (10/12/15)"
                                        value={cardTransactionId}
                                        maxLength={15}
                                        onChange={(e) => setCardTransactionId(normalizeTxnInput(e.target.value))}
                                        disabled={isPlaceholder}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="folio-transfer-form">
                        <div className="payment-input-modern">
                            <label>Room Number</label>
                            <div className="input-box-wrap">
                                <span>🏨</span>
                                <select
                                    className="folio-room-select"
                                    value={targetRoom}
                                    onChange={(e) => {
                                        setTargetRoom(e.target.value);
                                        const booking = checkedInRooms.find(b => b.roomNumber === e.target.value);
                                        setSelectedBooking(booking || null);
                                    }}
                                    disabled={isPlaceholder}
                                >
                                    <option value="">Select Room</option>
                                    {checkedInRooms.map(room => (
                                        <option key={room._id} value={room.roomNumber}>{room.roomNumber}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="payment-input-modern">
                            <label>Guest Name</label>
                            <div className="input-box-wrap read-only">
                                <input
                                    type="text"
                                    value={selectedBooking ? selectedBooking.guestName : ''}
                                    placeholder="Guest Name"
                                    readOnly
                                />
                            </div>
                        </div>

                        <div className="payment-input-modern">
                            <label>Booking ID</label>
                            <div className="input-box-wrap read-only">
                                <input
                                    type="text"
                                    value={selectedBooking ? (selectedBooking.bookingReferenceId || selectedBooking.bookingId || selectedBooking._id.substr(-6).toUpperCase()) : ''}
                                    placeholder="Booking ID"
                                    readOnly
                                />
                            </div>
                        </div>

                        {selectedBooking && availableFolios.length > 1 && (
                            <div className="payment-input-modern">
                                <label>Select Folio</label>
                                <div className="input-box-wrap">
                                    <span>📄</span>
                                    <select
                                        className="folio-select-pos"
                                        value={targetFolioId}
                                        onChange={(e) => setTargetFolioId(parseInt(e.target.value))}
                                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                    >
                                        {availableFolios.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {selectedBooking && (
                            <div className="folio-balance-info">
                                Outstanding Room Balance: {cs}{(selectedBooking.balanceAmount || 0).toFixed(2)}
                            </div>
                        )}

                        {selectedBooking && !isPlaceholder && (
                            <div className="folio-confirm-banner" style={{ background: netAfterDiscount === 0 ? '#fef2f2' : '#eff6ff', borderColor: netAfterDiscount === 0 ? '#fecaca' : '#bfdbfe' }}>
                                <span className="info-icon">{netAfterDiscount === 0 ? '⚠️' : 'ℹ️'}</span>
                                <p>
                                    Are you sure you want to transfer <strong>{cs}{netAfterDiscount.toFixed(2)}</strong> to 
                                    <strong> Room {targetRoom} ({availableFolios.find(f => f.id === targetFolioId)?.name})</strong>?
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <div className="return-amount-box-modern">
                    <span className="label">Return Amount</span>
                    <span className="value">{cs}{returnAmount.toFixed(2)}</span>
                </div>

                <div className="quick-actions-modern">
                    <div className="print-dropdown-wrapper" ref={printDropdownRef}>
                        <button
                            className={`q-btn print-btn-main ${!isPlaceholder ? 'print-ready' : ''}`}
                            onClick={() => {
                                if (!order && !lastPrintableBill) {
                                    showSimpleSideNote('No bill available to print');
                                    return;
                                }
                                setShowPrintDropdown(!showPrintDropdown);
                            }}
                            title={order || lastPrintableBill ? 'Select print format' : 'No bill available to print'}
                        >
                            🖨️ Print Bill {showPrintDropdown ? '▲' : '▼'}
                        </button>
                        {showPrintDropdown && (
                            <div className="print-format-dropdown">
                                <div className="print-dropdown-header">Select Print Format</div>
                                {printFormats.map(fmt => (
                                    <button
                                        key={fmt.key}
                                        className="print-format-option"
                                        onClick={() => handlePrintBill(fmt.key)}
                                    >
                                        <span className="pf-icon">{fmt.icon}</span>
                                        <span className="pf-label">{fmt.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button className="q-btn" onClick={() => {
                        setEditItems(order ? order.items.map(i => ({ ...i })) : []);
                        setPendingRemoveItemIndex(null);
                        setShowEditBill(true);
                    }} disabled={isPlaceholder}>✏️ Edit Bill</button>
                    <button className="q-btn" onClick={handleSendSMS} disabled={isPlaceholder}>💬 SMS</button>
                    <button className="q-btn" onClick={handleEmailBill} disabled={isPlaceholder}>📧 Email</button>
                </div>

                {/* Edit Bill Modal */}
                {showEditBill && order && (
                    <div className="edit-bill-overlay" onClick={() => {
                        setShowEditBill(false);
                        setPendingRemoveItemIndex(null);
                    }}>
                        <div className="edit-bill-modal" onClick={e => e.stopPropagation()}>
                            <div className="edit-bill-header">
                                <h3>✏️ Edit Bill - {order.billNo}</h3>
                                <button className="edit-bill-close" onClick={() => {
                                    setShowEditBill(false);
                                    setPendingRemoveItemIndex(null);
                                }}>✕</button>
                            </div>
                            <div className="edit-bill-body">
                                <table className="edit-bill-table">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Qty</th>
                                            <th>Rate</th>
                                            <th>Amount</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editItems.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{item.name}</td>
                                                <td>
                                                    <div className="edit-qty-controls">
                                                        <button onClick={() => {
                                                            const updated = [...editItems];
                                                            if (updated[idx].qty > 1) {
                                                                const rate = updated[idx].amount / updated[idx].qty;
                                                                updated[idx].qty -= 1;
                                                                updated[idx].amount = rate * updated[idx].qty;
                                                                setEditItems(updated);
                                                            }
                                                        }}>−</button>
                                                        <span>{item.qty}</span>
                                                        <button onClick={() => {
                                                            const updated = [...editItems];
                                                            const rate = updated[idx].amount / updated[idx].qty;
                                                            updated[idx].qty += 1;
                                                            updated[idx].amount = rate * updated[idx].qty;
                                                            setEditItems(updated);
                                                        }}>+</button>
                                                    </div>
                                                </td>
                                                <td>{cs}{(item.amount / item.qty).toFixed(2)}</td>
                                                <td>{cs}{item.amount.toFixed(2)}</td>
                                                <td>
                                                    <div className="edit-remove-wrap">
                                                        {pendingRemoveItemIndex === idx && (
                                                            <div className="edit-remove-warning-inline">
                                                                <span>Are you sure want to delete?</span>
                                                                <div className="edit-remove-warning-actions">
                                                                    <button
                                                                        type="button"
                                                                        className="edit-remove-warning-yes"
                                                                        onClick={() => {
                                                                            setEditItems(editItems.filter((_, i) => i !== idx));
                                                                            setPendingRemoveItemIndex(null);
                                                                        }}
                                                                        title="Yes"
                                                                    >
                                                                        Yes
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="edit-remove-warning-no"
                                                                        onClick={() => setPendingRemoveItemIndex(null)}
                                                                        title="No"
                                                                    >
                                                                        No
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <button className="edit-remove-btn" onClick={() => {
                                                            setPendingRemoveItemIndex(idx);
                                                        }}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="edit-bill-total">
                                    <span>New Total:</span>
                                    <span>{cs}{editItems.reduce((s, i) => s + i.amount, 0).toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="edit-bill-footer">
                                <button className="edit-bill-cancel" onClick={() => {
                                    setShowEditBill(false);
                                    setPendingRemoveItemIndex(null);
                                }}>Cancel</button>
                                <button className="edit-bill-save" onClick={() => {
                                    if (order) {
                                        order.items = editItems;
                                        const newSubtotal = editItems.reduce((s, i) => s + i.amount, 0);
                                        const fGstRaw = ((parseFloat(settings.cgst) || 0) + (parseFloat(settings.sgst) || 0)) || (parseFloat(settings.foodGst) || 0);
                                        const fGst = Boolean(settings.inclusiveTax) ? fGstRaw : 0;
                                        const sSvc = parseFloat(settings.roomServiceCharge) || 0;
                                        const newGrandTotal = newSubtotal + Math.round(newSubtotal * fGst / 100) + Math.round(newSubtotal * sSvc / 100);
                                        order.amount = newGrandTotal;
                                        setReceivedAmount(newGrandTotal.toString());
                                        setIsTendered(false);
                                        setPaymentSuccessNote('');
                                    }
                                    setPendingRemoveItemIndex(null);
                                    setShowEditBill(false);
                                }}>Save Changes</button>
                            </div>
                        </div>
                    </div>
                )}

                <button
                    className={`btn-tender-main ${isTendered ? 'tendered-success' : ''}`}
                    disabled={isPlaceholder || isTendered || (paymentType === 'Add to Room' && !selectedBooking)}
                    onClick={handleTender}
                >
                    {isTendered
                        ? 'Tendered'
                        : paymentType === 'Add to Room' ? 'Post to Room Folio' : `Tender ${cs} ${netAfterDiscount.toFixed(0)}`
                    }
                </button>

                {paymentSuccessNote && (
                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#16a34a', fontWeight: 700 }}>
                        {paymentSuccessNote}
                    </div>
                )}

            </div>
        </>
    );
};

export default CashierSection;




