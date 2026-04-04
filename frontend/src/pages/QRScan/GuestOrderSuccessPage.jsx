import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';
import './GuestOrderSuccessPage.css';

const GuestOrderSuccessPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();

    const [orderStatus, setOrderStatus] = useState(location.state?.orderStatus || 'Pending');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [latestOrder, setLatestOrder] = useState(location.state?.order || null);

    const room = location.state?.room || (() => {
        try {
            return JSON.parse(localStorage.getItem('guestRoomContext') || 'null');
        } catch (_) {
            return null;
        }
    })();
    const order = latestOrder;

    const canCancel = useMemo(() => {
        return ['Pending', 'Active', 'Preparing'].includes(String(orderStatus || '').trim());
    }, [orderStatus]);

    useEffect(() => {
        const loadLatestOrder = async () => {
            try {
                const response = await apiCall('/api/guest-meal/orders/guest/latest');
                const data = await response.json();
                if (data.success && data.data) {
                    const mapped = {
                        id: data.data._id,
                        items: data.data.items || []
                    };
                    setLatestOrder(mapped);
                    setOrderStatus(data.data.status || 'Pending');
                } else if (data.success) {
                    setLatestOrder(null);
                    setOrderStatus('Pending');
                }
            } catch (_) {
                // keep current state when API fails
            }
        };

        loadLatestOrder();
        const id = setInterval(loadLatestOrder, 10000);
        return () => clearInterval(id);
    }, []);

    if (!room) {
        return (
            <div className="guest-order-success-page">
                <div className="guest-order-card">
                    <h2>Room details not found</h2>
                    <button className="guest-order-btn primary" onClick={() => navigate('/')}>Go Home</button>
                </div>
            </div>
        );
    }

    const handleTrack = async () => {
        if (!order?.id) {
            setMessage('No order found yet. Tap New Food Order to create one.');
            return;
        }
        setLoading(true);
        setMessage('');
        try {
            const response = await apiCall(`/api/guest-meal/orders/${order.id}`);
            const data = await response.json();
            if (data.success && data.data) {
                setOrderStatus(data.data.status || 'Pending');
                setMessage(`Current Status: ${data.data.status || 'Pending'}`);
            } else {
                setMessage(data.message || 'Unable to fetch order status');
            }
        } catch (error) {
            setMessage('Unable to track order right now.');
        } finally {
            setLoading(false);
        }
    };

    const handleManage = () => {
        if (!order?.id) {
            setMessage('No order found yet. Tap New Food Order to create one.');
            return;
        }
        navigate('/food-order', {
            state: {
                source: 'qr-room',
                orderMode: 'online',
                guestQrFlow: true,
                room,
                orderId: order.id
            }
        });
    };

    const handleOrderAgain = () => {
        navigate('/food-order', {
            state: {
                source: 'qr-room',
                orderMode: 'online',
                guestQrFlow: true,
                room
            }
        });
    };

    const handleCancel = async () => {
        if (!order?.id) {
            setMessage('No order found to cancel.');
            return;
        }
        setLoading(true);
        setMessage('');
        try {
            const response = await apiCall(`/api/guest-meal/orders/${order.id}/cancel-by-guest`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                setOrderStatus('Cancelled');
                setMessage('Order cancelled successfully.');
                setLatestOrder({ ...order });
            } else {
                setMessage(data.message || 'Order cannot be cancelled now.');
            }
        } catch (error) {
            setMessage('Unable to cancel order right now.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="guest-order-success-page">
            <div className="guest-order-card">
                <div className="guest-order-header">
                    <h1>Food Order Placed</h1>
                    <p>Track, manage, cancel, and place your room food orders from here.</p>
                </div>

                <div className="guest-order-summary">
                    <p><strong>Room:</strong> {room.roomNumber}</p>
                    <p><strong>Booking ID:</strong> {room.bookingId || '-'}</p>
                    <p><strong>Order ID:</strong> {order?.id ? order.id?.slice(-6)?.toUpperCase() : 'Not placed yet'}</p>
                    <p><strong>Status:</strong> <span className={`status-tag ${String(orderStatus || '').toLowerCase()}`}>{orderStatus}</span></p>
                    <div className="line-items">
                        {(order?.items || []).slice(0, 3).map((item, idx) => (
                            <div key={`${item.name}-${idx}`} className="line-item">
                                <span>{item.name} x{item.quantity}</span>
                                <span>{cs}{(item.price || 0) * (item.quantity || 1)}</span>
                            </div>
                        ))}
                        {!order?.id && (
                            <div className="line-item">
                                <span>No active order. Tap New Food Order below.</span>
                                <span>-</span>
                            </div>
                        )}
                    </div>
                </div>

                {message && <div className="guest-order-message">{message}</div>}

                <div className="guest-order-actions">
                    <button className="guest-order-btn primary" onClick={handleOrderAgain}>New Food Order</button>
                    <button className="guest-order-btn" onClick={handleTrack} disabled={loading}>Track Order</button>
                    <button className="guest-order-btn" onClick={handleManage}>Manage Order</button>
                    <button className="guest-order-btn" onClick={handleOrderAgain}>Order Again</button>
                    <button className="guest-order-btn danger" onClick={handleCancel} disabled={loading || !canCancel}>Cancel Order</button>
                </div>

                {!canCancel && (
                    <p className="cancel-note">
                        Cancellation is allowed only till Preparing stage. Ready/Served orders cannot be cancelled.
                    </p>
                )}
            </div>
        </div>
    );
};

export default GuestOrderSuccessPage;
