import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';
import './GuestMealOrderPage.css';

const DEFAULT_MENU_CATEGORIES = ['Starters', 'Main Course', 'Breads', 'Breakfast', 'Rice', 'Desserts', 'Beverages', 'Chinese', 'Continental'];
const CUSTOM_CATEGORY_STORAGE_KEY = 'foodMenuCustomCategories';
const DEFAULT_CATEGORY_ICONS = {
    'Starters': '🍴',
    'Main Course': '🍛',
    'Breads': '🍞',
    'Breakfast': '☕',
    'Rice': '🍚',
    'Desserts': '🍨',
    'Beverages': '🥤',
    'Chinese': '🥡',
    'Continental': '🍝'
};

const GuestMealOrderPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { settings, getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [order, setOrder] = useState(null);
    const [table, setTable] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cart, setCart] = useState([]);
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [isProcessing, setIsProcessing] = useState(false);
    const [notification, setNotification] = useState(null);
    const [customCategories, setCustomCategories] = useState([]);
    const [groupedItems, setGroupedItems] = useState({});

    const inferCategoryIcon = (categoryName) => {
        const value = (categoryName || '').toLowerCase();

        if (value.includes('starter') || value.includes('snack')) return '🍴';
        if (value.includes('main')) return '🍛';
        if (value.includes('bread') || value.includes('roti') || value.includes('naan')) return '🍞';
        if (value.includes('breakfast') || value.includes('tea') || value.includes('coffee')) return '☕';
        if (value.includes('rice') || value.includes('biryani')) return '🍚';
        if (value.includes('dessert') || value.includes('sweet') || value.includes('mithai')) return '🍨';
        if (value.includes('beverage') || value.includes('drink') || value.includes('juice')) return '🥤';
        if (value.includes('chinese')) return '🥡';
        if (value.includes('continental') || value.includes('pasta')) return '🍝';
        if (value.includes('pizza')) return '🍕';
        if (value.includes('soup')) return '🥣';

        return '🍽️';
    };

    const getItemIcon = (category) => DEFAULT_CATEGORY_ICONS[category] || inferCategoryIcon(category);

    const categories = useMemo(() => {
        const merged = Array.from(new Set([
            ...DEFAULT_MENU_CATEGORIES,
            ...customCategories,
            ...Object.keys(groupedItems)
        ]));

        return merged.map(name => ({ id: name, name, icon: getItemIcon(name) }));
    }, [customCategories, groupedItems]);

    useEffect(() => {
        try {
            const storedCategories = JSON.parse(localStorage.getItem(CUSTOM_CATEGORY_STORAGE_KEY) || '[]');
            if (Array.isArray(storedCategories)) {
                setCustomCategories(storedCategories.map(c => (c || '').trim()).filter(Boolean));
            }
        } catch (error) {
            console.error('Error loading custom categories for guest meal:', error);
        }
    }, []);

    // Fetch menu items from API
    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const response = await apiCall(`/api/menu/list`);
                const data = await response.json();
                if (data.success) {
                    const groups = {};
                    data.data.forEach(item => {
                        // Map API data to UI format
                        const mappedItem = {
                            id: item._id,
                            name: item.itemName,
                            price: item.price,
                            category: item.category,
                            description: item.description,
                            status: item.status, // 'Active' or 'Inactive'
                            image: item.image || '',
                            fallbackIcon: getItemIcon(item.category)
                        };

                        if (!groups[item.category]) groups[item.category] = [];
                        groups[item.category].push(mappedItem);
                    });
                    setGroupedItems(groups);
                }
            } catch (err) {
                console.error('Error fetching menu:', err);
                showNotification('Failed to load menu items', 'error');
            }
        };
        fetchMenu();
    }, []);

    const resolveMenuImage = (image) => {
        if (!image || typeof image !== 'string') return '';

        const trimmedImage = image.trim();
        if (!trimmedImage) return '';

        if (/^www\./i.test(trimmedImage)) {
            return `https://${trimmedImage}`;
        }

        if (/^\/\//.test(trimmedImage)) {
            return `https:${trimmedImage}`;
        }

        if (/^https?:\/\//i.test(trimmedImage) || /^data:image\//i.test(trimmedImage) || /^blob:/i.test(trimmedImage)) {
            if (/^https?:\/\//i.test(trimmedImage)) {
                try {
                    const parsed = new URL(trimmedImage);
                    const host = parsed.hostname.toLowerCase();
                    const mediaUrl = parsed.searchParams.get('mediaurl') || parsed.searchParams.get('imgurl');

                    // Common case: users paste Bing/Google image-result URL instead of direct image URL.
                    if (mediaUrl && (host.includes('bing.com') || host.includes('google.'))) {
                        return decodeURIComponent(mediaUrl);
                    }
                } catch (error) {
                    // Keep original URL on parse failure.
                }
            }
            return trimmedImage;
        }

        const normalizedPath = trimmedImage.startsWith('/') ? trimmedImage : `/${trimmedImage}`;
        return `${API_URL}${normalizedPath}`;
    };

    // Show notification
    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // Load order on mount
    useEffect(() => {
        const loadOrder = async () => {
            try {
                setLoading(true);
                const { tableId, orderId, existingOrder } = location.state || {};

                if (!tableId || !orderId) {
                    setError('Missing table or order information');
                    return;
                }

                // If existing order passed in state, use it
                if (existingOrder) {
                    setOrder(existingOrder);
                    setCart(existingOrder.items || []);
                } else {
                    // Fetch order from API
                    const response = await apiCall(`/api/guest-meal/orders/${orderId}`);
                    const data = await response.json();

                    if (data.success) {
                        setOrder(data.data);
                        setCart(data.data.items || []);
                    } else {
                        setError('Failed to load order');
                    }
                }

                // Fetch table info
                const tableResponse = await apiCall(`/api/guest-meal/tables/${tableId}`);
                const tableData = await tableResponse.json();
                if (tableData.success) {
                    setTable(tableData.data);
                }
            } catch (err) {
                console.error('Error loading order:', err);
                setError('Error connecting to server');
            } finally {
                setLoading(false);
            }
        };

        loadOrder();
    }, [location.state]);

    // Add item to cart
    const addToCart = (item) => {
        const existingItem = cart.find(i => i.id === item.id);
        if (existingItem) {
            updateQuantity(item.id, 1);
        } else {
            setCart([...cart, { ...item, quantity: 1, subtotal: item.price }]);
            showNotification(`${item.name} added!`, 'success');
        }
    };

    // Update quantity
    const updateQuantity = (itemId, change) => {
        setCart(cart.map(item => {
            if (item.id === itemId) {
                const newQuantity = item.quantity + change;
                if (newQuantity > 0) {
                    return { ...item, quantity: newQuantity, subtotal: item.price * newQuantity };
                }
                return null;
            }
            return item;
        }).filter(Boolean));
    };

    // Remove from cart
    const removeFromCart = (itemId) => {
        const item = cart.find(i => i.id === itemId);
        setCart(cart.filter(i => i.id !== itemId));
        if (item) {
            showNotification(`${item.name} removed`, 'info');
        }
    };

    // Save order to backend
    const handleSaveOrder = async () => {
        if (cart.length === 0) {
            showNotification('Cart is empty!', 'error');
            return;
        }

        try {
            setIsProcessing(true);
            const { orderId } = location.state;

            const response = await apiCall(`/api/guest-meal/orders/${orderId}/items`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cart })
            });

            const data = await response.json();
            if (data.success) {
                setOrder(data.data);
                showNotification('Order saved successfully!', 'success');
            } else {
                showNotification('Error saving order', 'error');
            }
        } catch (err) {
            console.error('Error saving order:', err);
            showNotification('Error saving order', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Process billing
    const handleBilling = async () => {
        if (cart.length === 0) {
            showNotification('Cart is empty!', 'error');
            return;
        }

        try {
            setIsProcessing(true);
            const { orderId } = location.state;

            // First save items
            let saveResponse = await apiCall(`/api/guest-meal/orders/${orderId}/items`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cart })
            });

            if (!saveResponse.ok) throw new Error('Failed to save items');

            // Then bill the order
            const billResponse = await apiCall(`/api/guest-meal/orders/${orderId}/bill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentMethod })
            });

            const billData = await billResponse.json();
            if (billData.success) {
                showNotification('Order billed successfully!', 'success');
                setShowBillingModal(false);

                // Close order after 1.5 seconds
                setTimeout(() => {
                    closeOrder();
                }, 1500);
            } else {
                showNotification(billData.message || 'Error billing order', 'error');
            }
        } catch (err) {
            console.error('Error billing order:', err);
            showNotification('Error billing order', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Close order and reset table
    const closeOrder = async () => {
        try {
            const { orderId } = location.state;

            const response = await apiCall(`/api/guest-meal/orders/${orderId}/close`, {
                method: 'POST'
            });

            const data = await response.json();
            if (data.success) {
                showNotification('Table reset successfully!', 'success');
                // Navigate back to guest meal service after 1 second
                setTimeout(() => {
                    navigate('/admin/guests-meal-service');
                }, 1000);
            } else {
                showNotification('Error closing order', 'error');
            }
        } catch (err) {
            console.error('Error closing order:', err);
            showNotification('Error closing order', 'error');
        }
    };

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const taxRate = (parseFloat(settings.foodGst) || 5) / 100;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    const taxLabel = `${settings.taxType || 'GST'} (${parseFloat(settings.foodGst) || 5}%)`;

    if (loading) {
        return <div className="gmo-loading">Loading order...</div>;
    }

    if (error) {
        return (
            <div className="gmo-error">
                <p>{error}</p>
                <button onClick={() => navigate('/admin/guests-meal-service')}>Back to Tables</button>
            </div>
        );
    }

    return (
        <div className="guest-meal-order-page">
            {/* Header */}
            <div className="gmo-header">
                <div className="gmo-header-info">
                    <h1>🍽️ Table {table?.tableNumber} - Order Management</h1>
                    <button className="gmo-back-btn" onClick={() => navigate('/admin/guests-meal-service')}>
                        ← Back to Tables
                    </button>
                </div>
                <div className="gmo-header-details">
                    <span className="detail-badge">Order Type: {order?.orderType}</span>
                    {order?.roomNumber && <span className="detail-badge">Room: {order.roomNumber}</span>}
                </div>
            </div>

            {/* Main Layout */}
            <div className="gmo-container">
                {/* Menu Section */}
                <div className="gmo-menu-section">
                    <h2>Select Items</h2>
                    <div className="gmo-categories">
                        {categories.map(cat => {
                            const items = groupedItems[cat.name] || [];
                            if (items.length === 0) return null;

                            return (
                                <div key={cat.id} className="gmo-category">
                                    <h3>{cat.icon} {cat.name}</h3>
                                    <div className="gmo-items-grid">
                                        {items.map(item => (
                                            <div key={item.id} className={`gmo-item-card ${item.status === 'Inactive' ? 'out-of-stock' : ''}`}>
                                                <div className="item-image">
                                                    {item.image ? (
                                                        <img
                                                            src={resolveMenuImage(item.image)}
                                                            alt={item.name}
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                const fallback = e.currentTarget.nextElementSibling;
                                                                if (fallback) fallback.style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <span className="item-icon-fallback" style={item.image ? { display: 'none' } : {}}>
                                                        {item.fallbackIcon}
                                                    </span>
                                                </div>
                                                <div className="item-name">{item.name}</div>
                                                <div className="item-price">{cs}{item.price.toFixed(2)}</div>
                                                {item.status === 'Inactive' ? (
                                                    <button className="item-add-btn disabled" disabled style={{ background: '#ccc', cursor: 'not-allowed' }}>
                                                        🚫 Out of Stock
                                                    </button>
                                                ) : (
                                                    <button className="item-add-btn" onClick={() => addToCart(item)}>
                                                        + Add
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Cart Section */}
                <div className="gmo-cart-section">
                    <h2>Order Summary</h2>

                    {notification && (
                        <div className={`notification ${notification.type}`}>
                            {notification.message}
                        </div>
                    )}

                    <div className="gmo-cart">
                        {cart.length === 0 ? (
                            <div className="gmo-empty-cart">
                                <p>🛒 No items added yet</p>
                            </div>
                        ) : (
                            <>
                                <div className="gmo-items-list">
                                    {cart.map(item => (
                                        <div key={item.id} className="gmo-cart-item">
                                            <div className="item-info">
                                                <span className="item-name">{item.name}</span>
                                                <span className="item-price">{cs}{item.price}</span>
                                            </div>
                                            <div className="item-controls">
                                                <button onClick={() => updateQuantity(item.id, -1)}>−</button>
                                                <span className="quantity">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                                            </div>
                                            <div className="item-total">{cs}{item.subtotal}</div>
                                            <button className="item-remove" onClick={() => removeFromCart(item.id)}>
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="gmo-totals">
                                    <div className="total-row">
                                        <span>Subtotal:</span>
                                        <span>{cs}{subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="total-row">
                                        <span>{taxLabel}:</span>
                                        <span>{cs}{tax.toFixed(2)}</span>
                                    </div>
                                    <div className="total-row-final">
                                        <span>Total:</span>
                                        <span>{cs}{total.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="gmo-actions">
                                    <button
                                        className="btn-save"
                                        onClick={handleSaveOrder}
                                        disabled={isProcessing}
                                    >
                                        💾 Save Order
                                    </button>
                                    <button
                                        className="btn-bill"
                                        onClick={() => setShowBillingModal(true)}
                                        disabled={isProcessing}
                                    >
                                        💳 Process Billing
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Billing Modal */}
            {
                showBillingModal && (
                    <div className="modal-overlay" onClick={() => setShowBillingModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Process Payment</h2>
                                <button className="modal-close" onClick={() => setShowBillingModal(false)}>✕</button>
                            </div>

                            <div className="modal-body">
                                <div className="billing-summary">
                                    <div className="summary-row">
                                        <span>Subtotal:</span>
                                        <span>{cs}{subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="summary-row">
                                        <span>{taxLabel}:</span>
                                        <span>{cs}{tax.toFixed(2)}</span>
                                    </div>
                                    <div className="summary-row-total">
                                        <span>Total Amount:</span>
                                        <span>{cs}{total.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="payment-options">
                                    <label className="payment-option">
                                        <input
                                            type="radio"
                                            value="Cash"
                                            checked={paymentMethod === 'Cash'}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                        />
                                        <span>💵 Cash Payment</span>
                                    </label>
                                    <label className="payment-option">
                                        <input
                                            type="radio"
                                            value="Card"
                                            checked={paymentMethod === 'Card'}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                        />
                                        <span>💳 Card Payment</span>
                                    </label>
                                    <label className="payment-option">
                                        <input
                                            type="radio"
                                            value="Online"
                                            checked={paymentMethod === 'Online'}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                        />
                                        <span>📱 Online Payment</span>
                                    </label>
                                    {order?.orderType === 'Post to Room' && (
                                        <label className="payment-option">
                                            <input
                                                type="radio"
                                                value="Room Billing"
                                                checked={paymentMethod === 'Room Billing'}
                                                onChange={(e) => setPaymentMethod(e.target.value)}
                                            />
                                            <span>🏨 Post to Room</span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    className="btn-cancel"
                                    onClick={() => setShowBillingModal(false)}
                                    disabled={isProcessing}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-confirm"
                                    onClick={handleBilling}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? 'Processing...' : `Confirm Payment - ${cs}${total.toFixed(2)}`}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default GuestMealOrderPage;
