import { Bell, Scissors, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import './OrderNotificationPanel.css';

const formatTime = (value) => {
    try {
        return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
        return '--:--';
    }
};

const OrderNotificationPanel = ({ scope, className = '' }) => {
    const {
        notifications,
        unreadCount,
        panelOpen,
        togglePanel,
        closePanel,
        forceRefresh,
        removeNotification,
        clearAllForScope,
    } = useOrderNotifications(scope);
    const [ringing, setRinging] = useState(false);
    const [removingId, setRemovingId] = useState(null);
    const prevUnreadRef = useRef(unreadCount);

    useEffect(() => {
        if (unreadCount > prevUnreadRef.current) {
            setRinging(true);
            const id = setTimeout(() => setRinging(false), 1400);
            return () => clearTimeout(id);
        }

        prevUnreadRef.current = unreadCount;
    }, [unreadCount]);

    useEffect(() => {
        prevUnreadRef.current = unreadCount;
    }, [unreadCount]);

    useEffect(() => {
        if (panelOpen) {
            forceRefresh();
        }
    }, [panelOpen, forceRefresh]);

    const handleCut = (id) => {
        setRemovingId(id);
        setTimeout(() => {
            removeNotification(id);
            setRemovingId((prev) => (prev === id ? null : prev));
        }, 220);
    };

    return (
        <div className={`order-notify-root ${className}`.trim()}>
            <button className={`order-notify-bell ${ringing ? 'ringing' : ''}`} onClick={togglePanel} title="Notifications">
                <Bell size={18} />
                {unreadCount > 0 && <span className="order-notify-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>

            {panelOpen && <div className="order-notify-overlay" onClick={closePanel} />}

            <aside className={`order-notify-drawer ${panelOpen ? 'open' : ''}`}>
                <div className="order-notify-head">
                    <h4>Order Notifications</h4>
                    <div className="order-notify-head-actions">
                        {notifications.length > 0 && (
                            <button className="order-notify-clear-all" onClick={clearAllForScope}>
                                Clear All
                            </button>
                        )}
                        <button className="order-notify-close" onClick={closePanel}>
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="order-notify-list">
                    {notifications.length === 0 ? (
                        <div className="order-notify-empty">No alerts yet.</div>
                    ) : (
                        notifications.map((item) => (
                            <div key={item.id} className={`order-notify-item ${removingId === item.id ? 'swipe-out' : ''}`}>
                                <button
                                    className="order-notify-cut"
                                    title="Cut notification"
                                    onClick={() => handleCut(item.id)}
                                >
                                    <Scissors size={14} />
                                </button>
                                <div className="order-notify-title">{item.title}</div>
                                <div className="order-notify-msg">{item.message}</div>
                                <div className="order-notify-meta">
                                    <span>{item.orderType || 'Order'}</span>
                                    <span>{formatTime(item.eventTime)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </aside>
        </div>
    );
};

export default OrderNotificationPanel;
