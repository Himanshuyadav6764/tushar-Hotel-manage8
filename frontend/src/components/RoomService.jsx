import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ArrowLeft, Utensils, CheckCircle } from 'lucide-react';
import API_URL, { apiCall } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import OrderNotificationPanel from './OrderNotificationPanel';
import './RoomService.css';

const RoomService = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { settings } = useSettings();
    const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';
    const permissionLabels = Array.isArray(user?.permissions) ? user.permissions : [];
    const hasExplicitAssignments = !isSuperAdmin && permissionLabels.length > 0;
    const canOpenCashierRoomBilling = isSuperAdmin || (
        hasExplicitAssignments
            ? permissionLabels.includes('Cashier Section (Room Service)')
            : user?.role !== 'staff'
    );

    // Permission Check
    const hasAccess = user?.role !== 'staff' || (user?.permissions?.includes('Room Service') || user?.permissions?.includes('Rooms (Room Service)'));

    if (!hasAccess) {
        return (
            <div className="rs-container-error">
                <div className="rs-error-icon">🚫</div>
                <h2>Access Denied</h2>
                <p>You do not have permission to access Room Service.</p>
                <button className="rs-error-btn" onClick={() => navigate('/admin/dashboard')}>
                    Back to Dashboard
                </button>
            </div>
        );
    }

    const [rooms, setRooms] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const isFirstFetch = useRef(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    const fetchData = async () => {
        try {
            if (isFirstFetch.current) setLoading(true);
            const [roomsRes, allOrdersRes, bookingsRes] = await Promise.all([
                apiCall(`/api/rooms/list`),
                apiCall(`/api/guest-meal/orders`),
                apiCall(`/api/bookings/list`)
            ]);

            const roomsData = await roomsRes.json();
            const allOrdersData = await allOrdersRes.json();
            const bookingsData = await bookingsRes.json();

            if (roomsData.success && bookingsData.success) {
                const checkedInBookings = (bookingsData.data || []).filter(b =>
                    ['Checked-in', 'CheckedIn', 'IN_HOUSE'].includes(b.status)
                );
                const checkedInRoomNumbers = checkedInBookings.map(b => b.roomNumber);

                const inHouseRooms = (roomsData.data || []).filter(r =>
                    ['Occupied', 'In House', 'IN_HOUSE'].includes(r.status) ||
                    checkedInRoomNumbers.includes(r.roomNumber)
                );

                const mappedRooms = inHouseRooms.map(room => {
                    const activeBooking = checkedInBookings.find(b => b.roomNumber === room.roomNumber);
                    return {
                        ...room,
                        guestName: activeBooking?.guestName || activeBooking?.guest?.name || 'Occupied Room'
                    };
                });
                setRooms(mappedRooms);
            }

            if (allOrdersData.success) {
                const roomOrders = allOrdersData.data.filter(o =>
                    ['Post to Room', 'Room Order', 'Room Service'].includes(o.orderType) &&
                    !['Completed', 'Settled', 'Closed', 'Billed', 'Cancelled'].includes(o.status)
                );
                setOrders(roomOrders);
            }
        } catch (error) {
            console.error('Error fetching room service data:', error);
        } finally {
            if (isFirstFetch.current) {
                setLoading(false);
                isFirstFetch.current = false;
            }
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000); // Refresh every 15 seconds
        return () => clearInterval(interval);
    }, []);

    const filteredRooms = rooms.filter(room => {
        const roomOrder = orders.find(o => o.roomNumber === room.roomNumber);
        const matchesSearch =
            room.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (room.guestName || '').toLowerCase().includes(searchQuery.toLowerCase());

        const status = roomOrder?.status || '';
        let matchesFilter = true;
        if (activeFilter === 'pending') matchesFilter = (status === 'Pending' || status === 'Active');
        else if (activeFilter === 'preparing') matchesFilter = status === 'Preparing';
        else if (activeFilter === 'inservice') matchesFilter = status === 'Started';

        return matchesSearch && matchesFilter;
    });

    const formatCurrentDate = () => {
        const now = new Date();
        const options = { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
        return now.toLocaleString('en-US', options).replace(',', ' •').toUpperCase();
    };

    const getTimeDifference = (updatedAt) => {
        if (!updatedAt) return '';
        const diff = Math.floor((new Date() - new Date(updatedAt)) / (1000 * 60));
        return `${diff} mins ago`;
    };

    const handleStatusUpdate = async (orderId, newStatus) => {
        if (!orderId) return;
        try {
            const response = await apiCall(`/api/guest-meal/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await response.json();
            if (data.success) {
                // Instantly update local state for snappy feel
                setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: newStatus, updatedAt: new Date() } : o));
            } else {
                console.error("Status update failed:", data.message);
                alert("Failed to update status: " + data.message);
            }
        } catch (error) {
            console.error("Error updating order status:", error);
            alert("Network error updating status");
        }
    };

    const handleBillDetails = async (room, orderId, currentStatus) => {
        if (!orderId) {
            alert("No active order to bill");
            return;
        }

        if (!canOpenCashierRoomBilling) {
            alert('Role not assigned for Cashier Section (Room Service).');
            return;
        }

        // If already sent to cashier, open cashier directly.
        if (currentStatus === 'Pending Payment') {
            navigate('/admin/cashier-section', {
                state: {
                    activeMenu: 'cashier-section',
                    cashierMode: 'Room',
                    refresh: true,
                    room: { ...room, id: room._id, orderId }
                }
            });
            return;
        }

        try {
            // First send to cashier (updates status to 'Pending Payment')
            const response = await apiCall(`/api/guest-meal/orders/${orderId}/send-to-cashier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (data.success) {
                // Then navigate to cashier section
                navigate('/admin/cashier-section', {
                    state: {
                        activeMenu: 'cashier-section',
                        cashierMode: 'Room',
                        refresh: true,
                        room: { ...room, id: room._id, orderId: orderId }
                    }
                });
            } else {
                console.error("Failed to send to cashier:", data.message);
                alert("Error sending bill to cashier: " + data.message);
            }
        } catch (error) {
            console.error("Error sending to cashier:", error);
            alert("Network error sending bill to cashier");
        }
    };

    const renderStatusBar = (order) => {
        if (!order) return (
            <div className="rs-status-tracking-container">
                <div className="rs-tracking-header">
                    <span className="rs-tracking-label-wait">WAITING FOR ORDER ENTRY</span>
                </div>
            </div>
        );

        const status = order.status;
        const stages = [
            { label: 'PENDING', status: 'Pending' },
            { label: 'PREPARING', status: 'Preparing' },
            { label: 'READY', status: 'Ready' },
            { label: 'SERVICE', status: 'Started' }
        ];

        const statusMap = { 'Active': 0, 'Pending': 0, 'Preparing': 1, 'Ready': 2, 'Started': 3, 'Served': 3 };
        const currentIdx = statusMap[status] ?? -1;

        return (
            <div className="rs-status-tracking-container">
                <div className="rs-tracking-header">
                    <span className="rs-tracking-label-main">STATUS TRACKING</span>
                    {currentIdx >= 2 && <span className="rs-final-stage-badge">FINAL STAGE</span>}
                </div>
                <div className="rs-progress-bar-wrap">
                    {stages.map((stage, idx) => (
                        <div
                            key={stage.label}
                            className="rs-progress-segment-wrap"
                            onClick={() => handleStatusUpdate(order._id, stage.status)}
                            style={{ cursor: 'pointer' }}
                            title={`Mark as ${stage.label}`}
                        >
                            <div className={`rs-progress-segment ${idx <= currentIdx ? 'active' : ''}`} />
                            <span className={`rs-progress-label ${idx <= currentIdx ? 'active' : ''}`}>
                                {stage.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="rs-management-wrapper">
            {/* Top Bar Header */}
            <header className="rs-top-header">
                <div className="rs-header-main-left">
                    <button className="rs-back-circle-btn" onClick={() => navigate(-1)}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="rs-title-section">
                        <h1 className="rs-main-title">Room Service Management</h1>
                        <p className="rs-active-ops">ACTIVE OPERATIONS • {formatCurrentDate()}</p>
                    </div>
                </div>
                <div className="rs-header-main-right">
                    <div className="rs-orders-count-badge">
                        <Utensils size={16} />
                        <span>{orders.length} Active Orders</span>
                    </div>
                    <OrderNotificationPanel scope="room-service" className="rs-notification-panel" />
                </div>
            </header>

            {/* Controls Bar */}
            <div className="rs-controls-bar">
                <div className="rs-search-container">
                    <Search className="rs-search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Search rooms, guests or items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                        className="rs-search-field"
                    />
                    {searchQuery && (
                        <button
                            className="rs-search-clear"
                            onClick={() => setSearchQuery('')}
                        >✕</button>
                    )}
                </div>
                <div className="rs-filter-pills">
                    {[
                        { key: 'all', label: 'All Orders' },
                        { key: 'pending', label: 'Pending' },
                        { key: 'preparing', label: 'Preparing' },
                        { key: 'inservice', label: 'In Service' },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            className={`rs-pill-btn ${activeFilter === key ? 'active' : ''}`}
                            onClick={() => setActiveFilter(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Room Cards Grid */}
            <main className="rs-cards-grid">
                {loading ? (
                    <div className="rs-status-msg">Loading current operations...</div>
                ) : filteredRooms.length > 0 ? (
                    filteredRooms.map(room => {
                        const roomOrder = orders.find(o => o.roomNumber === room.roomNumber);
                        const status = roomOrder?.status || '';

                        return (
                            <div key={room._id} className="rs-operation-card">
                                <div className="rs-card-header">
                                    <div className="rs-room-basic-info">
                                        <div
                                            className="rs-room-num-box"
                                            style={{ cursor: roomOrder ? 'pointer' : 'default' }}
                                            onClick={() => roomOrder && navigate('/admin/dashboard', {
                                                state: {
                                                    activeMenu: 'view-order',
                                                    orderId: roomOrder._id,
                                                    source: 'room-service'
                                                }
                                            })}
                                            title={roomOrder ? "View Full Order Details" : ""}
                                        >
                                            {room.roomNumber}
                                        </div>
                                        <div className="rs-room-meta">
                                            <h3 className="rs-room-type-name">{room.roomType || 'Standard Room'}</h3>
                                            <button
                                                className="rs-add-order-plus"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate('/admin/dashboard', {
                                                        state: {
                                                            activeMenu: 'food-order',
                                                            orderMode: 'roomservice',
                                                            room: { ...room, id: room._id, source: 'room-service' },
                                                            source: 'room-service'
                                                        }
                                                    });
                                                }}
                                                title="Add Food Order"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="rs-order-status-tag">
                                        {status === 'Started' ? 'STARTED' : status.toUpperCase()}
                                    </div>
                                </div>

                                <div className="rs-card-body">
                                    <div className="rs-guest-display">
                                        <span className="rs-label-small">GUEST:</span>
                                        <span className="rs-guest-name-val">{room.guestName.toUpperCase()}</span>
                                    </div>

                                    {renderStatusBar(roomOrder)}

                                    <div className="rs-order-details-summary">
                                        <div className="rs-detail-column">
                                            <span className="rs-label-small">ORDER ITEMS</span>
                                            <span className="rs-detail-val">
                                                {roomOrder?.items?.length > 0
                                                    ? `${roomOrder.items[0].name}${roomOrder.items.length > 1 ? ` +${roomOrder.items.length - 1}` : ''}`
                                                    : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="rs-detail-column">
                                            <span className="rs-label-small">CATEGORY</span>
                                            <div className="rs-category-tag">
                                                <CheckCircle size={14} />
                                                <span>{roomOrder?.orderType || 'Post to Room'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rs-card-footer">
                                    <span className="rs-time-lapsed">
                                        🕒 {roomOrder ? getTimeDifference(roomOrder.updatedAt) : 'Ready for order'}
                                    </span>
                                    {roomOrder ? (
                                        <button
                                            className={`rs-bill-details-btn ${roomOrder?.status === 'Pending Payment' ? 'pending' : ''}`}
                                            onClick={() => handleBillDetails(room, roomOrder?._id, roomOrder?.status)}
                                            disabled={['Active', 'Pending', 'Preparing', 'Ready'].includes(roomOrder?.status)}
                                            title={['Active', 'Pending', 'Preparing', 'Ready'].includes(roomOrder?.status) ? "Please click 'Send' from KOT View to enable Bill Details" : ""}
                                        >
                                            {roomOrder?.status === 'Pending Payment' ? 'Pending Payment' : 'Bill Details'}
                                        </button>
                                    ) : (
                                        <button
                                            className="rs-place-order-footer-btn"
                                            onClick={() => {
                                                if (!settings.posEnabled) {
                                                    alert('POS is disabled. Cannot create orders. Enable POS from Company Settings.');
                                                    return;
                                                }
                                                navigate('/admin/dashboard', {
                                                    state: {
                                                        activeMenu: 'food-order',
                                                        orderMode: 'roomservice',
                                                        room: { ...room, id: room._id, source: 'room-service' },
                                                        source: 'room-service'
                                                    }
                                                });
                                            }}
                                        >
                                            Place Order
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="rs-status-msg">No matching operations found</div>
                )}
            </main>

            <footer className="rs-page-footer">
                Viewing {rooms.length} occupied rooms
            </footer>
        </div>
    );
};

export default RoomService;

