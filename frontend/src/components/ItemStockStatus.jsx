import React, { useState, useEffect } from 'react';
import API_URL, { apiCall } from '../config/api';
import '../pages/FoodMenu/FoodMenu.css'; // Import FoodMenu styles
import './ItemStockStatus.css';
import { useSettings } from '../context/SettingsContext';

// Replaced ItemStockStatus with Food Menu Management features
const ItemStockStatus = () => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();

    const [menuItems, setMenuItems] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All Categories');
    const [currentPage, setCurrentPage] = useState(1);
    const [pendingDeleteItemId, setPendingDeleteItemId] = useState(null);
    const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768);
    const itemsPerPage = 7;

    const categories = [
        { value: 'All Categories', label: '🍽️ All Categories', icon: '🍽️' },
        { value: 'Starters', label: '🍴 Starters', icon: '🍴' },
        { value: 'Main Course', label: '🍛 Main Course', icon: '🍛' },
        { value: 'Breakfast', label: '☕ Breakfast', icon: '☕' },
        { value: 'Rice', label: '🍚 Rice', icon: '🍚' },
        { value: 'Desserts', label: '🍨 Desserts', icon: '🍨' },
        { value: 'Beverages', label: '🥤 Beverages', icon: '🥤' },
        { value: 'Chinese', label: '🥡 Chinese', icon: '🥡' },
        { value: 'Continental', label: '🍝 Continental', icon: '🍝' }
    ];

    // Get category with icon
    const getCategoryWithIcon = (categoryName) => {
        const category = categories.find(cat => cat.value === categoryName);
        return category ? category.label : categoryName;
    };

    // Fetch menu items on component mount
    useEffect(() => {
        fetchMenuItems();
    }, []);

    useEffect(() => {
        if (!pendingDeleteItemId) return;

        const timer = setTimeout(() => setPendingDeleteItemId(null), 5000);
        return () => clearTimeout(timer);
    }, [pendingDeleteItemId]);

    useEffect(() => {
        const onResize = () => setIsMobileView(window.innerWidth <= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const fetchMenuItems = async () => {
        try {
            const response = await apiCall(`/api/menu/list`);
            const data = await response.json();
            if (data.success) {
                setMenuItems(data.data);
            }
        } catch (error) {
            console.error('Error fetching menu items:', error);
        }
    };



    const handleUpdateItem = async (id, updatedItem) => {
        try {
            const response = await apiCall(`/api/menu/update/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedItem),
            });
            const data = await response.json();
            if (data.success) {
                setMenuItems(menuItems.map(item => item._id === id ? data.data : item));
                setEditingItem(null);
                alert('Item updated successfully!');
            } else {
                alert(data.message || 'Failed to update item');
            }
        } catch (error) {
            console.error('Error updating item:', error);
            alert('Error updating item. Please try again.');
        }
    };

    const handleDeleteItem = async (id) => {
        try {
            const response = await apiCall(`/api/menu/delete/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (data.success) {
                setMenuItems(menuItems.filter(item => item._id !== id));
                setPendingDeleteItemId(null);
            } else {
                console.error(data.message || 'Failed to delete item');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
        try {
            const response = await apiCall(`/api/menu/toggle-status/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();
            if (data.success) {
                setMenuItems(menuItems.map(item => item._id === id ? { ...item, status: newStatus } : item));
            } else {
                alert(data.message || 'Failed to toggle status');
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            alert('Error toggling status. Please try again.');
        }
    };

    // Filter and search logic
    const filteredItems = menuItems.filter(item => {
        const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'All Categories' || item.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    return (
        <div className="food-menu-container item-stock-status-page">
            {/* Header - Compact */}
            <div className="food-menu-header" style={{ padding: '10px 20px', marginBottom: '10px' }}>
                <div className="header-left">
                    <span className="menu-icon" style={{ fontSize: '1.2rem' }}>🎁</span>
                    <h1 style={{ fontSize: '1.2rem' }}>Current Item Stock</h1>
                </div>
                <div className="header-right" style={{ gap: '10px' }}>
                    <div className="search-box" style={{ padding: '4px 8px' }}>
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                            style={{ fontSize: '0.9rem' }}
                        />
                    </div>

                </div>
            </div>

            {/* Main Content - Compact */}
            <div className="food-menu-content" style={{ padding: '0 20px' }}>
                {/* Removed separate content-header with "Item Stock List" text */}



                {/* Items List */}
                {/* Items List - Compact */}
                <div className="items-list-card" style={{ padding: '0', borderRadius: '8px', overflow: 'hidden' }}>
                    <div className="list-header" style={{ padding: '8px 15px', justifyContent: 'flex-end', background: '#f8f9fa' }}>
                        <div className="filter-section">
                            <label style={{ fontSize: '0.85rem', marginRight: '8px' }}>Filter by Category:</label>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="category-filter"
                                style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                            >
                                {categories.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Table / Mobile Cards */}
                    {isMobileView ? (
                        <div className="item-stock-mobile-list">
                            {currentItems.map((item, index) => (
                                <div key={item._id} className="item-stock-mobile-card">
                                    <div className="item-stock-mobile-top">
                                        <span className="item-stock-mobile-index">#{indexOfFirstItem + index + 1}</span>
                                        <span className={`status-badge ${item.status.toLowerCase()}`}>{item.status}</span>
                                    </div>
                                    <div className="item-stock-mobile-name">{item.itemName}</div>
                                    <div className="item-stock-mobile-grid">
                                        <div><strong>Code:</strong> {item.foodCode || '-'}</div>
                                        <div><strong>Category:</strong> {getCategoryWithIcon(item.category)}</div>
                                        <div><strong>Price:</strong> {cs}{item.price.toFixed(2)}</div>
                                        <div>
                                            <strong>Stock:</strong>{' '}
                                            <span className={`stock-badge ${item.quantity > 0 ? 'in-stock' : 'out-of-stock-text'}`}>
                                                {item.quantity || 0}
                                            </span>
                                        </div>
                                        <div className="item-stock-mobile-desc"><strong>Description:</strong> {item.description || '---'}</div>
                                    </div>
                                    <div className="item-stock-mobile-actions">
                                        <button
                                            className="action-btn edit-btn"
                                            onClick={() => setEditingItem(item)}
                                            title="Edit"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="action-btn toggle-btn"
                                            onClick={() => handleToggleStatus(item._id, item.status)}
                                            title="Toggle Status"
                                        >
                                            🔄
                                        </button>
                                        <button
                                            className="action-btn delete-btn"
                                            onClick={() => setPendingDeleteItemId(item._id)}
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </div>

                                    {pendingDeleteItemId === item._id && (
                                        <div className="item-stock-mobile-confirm">
                                            <span>Are you sure want to delete?</span>
                                            <div className="item-stock-mobile-confirm-actions">
                                                <button type="button" onClick={() => handleDeleteItem(item._id)}>Yes</button>
                                                <button type="button" onClick={() => setPendingDeleteItemId(null)}>No</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="items-table" style={{ fontSize: '0.85rem', width: '100%' }}>
                                <thead>
                                    <tr style={{ background: '#f1f1f1' }}>
                                        <th style={{ padding: '8px' }}>#</th>
                                        <th style={{ padding: '8px' }}>Code</th>
                                        <th style={{ padding: '8px' }}>Item Name</th>
                                        <th style={{ padding: '8px' }}>Category</th>
                                        <th style={{ padding: '8px' }}>Description</th>
                                        <th style={{ padding: '8px' }}>Price</th>
                                        <th style={{ padding: '8px' }}>Stock</th>
                                        <th style={{ padding: '8px' }}>Status</th>
                                        <th style={{ padding: '8px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentItems.map((item, index) => (
                                        <tr key={item._id}>
                                            <td>{indexOfFirstItem + index + 1}</td>
                                            <td><span className="code-badge">{item.foodCode || '-'}</span></td>
                                            <td>{item.itemName}</td>
                                            <td>{getCategoryWithIcon(item.category)}</td>
                                            <td>{item.description || '---'}</td>
                                            <td>{cs}{item.price.toFixed(2)}</td>
                                            <td>
                                                <span className={`stock-badge ${item.quantity > 0 ? 'in-stock' : 'out-of-stock-text'}`}>
                                                    {item.quantity || 0}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${item.status.toLowerCase()}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons" style={{ position: 'relative' }}>
                                                    <button
                                                        className="action-btn edit-btn"
                                                        onClick={() => setEditingItem(item)}
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className="action-btn toggle-btn"
                                                        onClick={() => handleToggleStatus(item._id, item.status)}
                                                        title="Toggle Status"
                                                    >
                                                        🔄
                                                    </button>
                                                    <button
                                                        className="action-btn delete-btn"
                                                        onClick={() => setPendingDeleteItemId(item._id)}
                                                        title="Delete"
                                                    >
                                                        🗑️
                                                    </button>

                                                    {pendingDeleteItemId === item._id && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            right: 0,
                                                            bottom: 'calc(100% + 8px)',
                                                            padding: '8px 10px',
                                                            borderRadius: '10px',
                                                            border: '1px solid #fecaca',
                                                            background: '#fff1f2',
                                                            color: '#b40f1d',
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
                                                                    onClick={() => handleDeleteItem(item._id)}
                                                                    style={{
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        padding: '4px 10px',
                                                                        background: '#d41424',
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
                                                                    onClick={() => setPendingDeleteItemId(null)}
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
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="pagination">
                        <div className="showing-text">
                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredItems.length)} of {filteredItems.length} entries
                        </div>
                        <div className="pagination-controls">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </button>
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i + 1}
                                    className={currentPage === i + 1 ? 'active' : ''}
                                    onClick={() => setCurrentPage(i + 1)}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {editingItem && (
                <EditItemModal
                    item={editingItem}
                    onSave={handleUpdateItem}
                    onCancel={() => setEditingItem(null)}
                />
            )}
        </div>
    );
};

// Edit Item Modal Component
const EditItemModal = ({ item, onSave, onCancel }) => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [formData, setFormData] = useState({
        itemName: item.itemName,
        foodCode: item.foodCode || '',
        category: item.category,
        price: item.price,
        quantity: item.quantity || 0,
        description: item.description || '',
        status: item.status
    });

    const categories = [
        { value: 'Starters', label: '🍴 Starters', icon: '🍴' },
        { value: 'Main Course', label: '🍛 Main Course', icon: '🍛' },
        { value: 'Breakfast', label: '☕ Breakfast', icon: '☕' },
        { value: 'Rice', label: '🍚 Rice', icon: '🍚' },
        { value: 'Desserts', label: '🍨 Desserts', icon: '🍨' },
        { value: 'Beverages', label: '🥤 Beverages', icon: '🥤' },
        { value: 'Chinese', label: '🥡 Chinese', icon: '🥡' },
        { value: 'Continental', label: '🍝 Continental', icon: '🍝' }
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(item._id, {
            ...formData,
            price: parseFloat(formData.price)
        });
    };

    return (
        <div onClick={onCancel} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'flex-end',
            zIndex: 10000,
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.4s ease-out'
        }}>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%) scale(0.95);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0) scale(1);
                        opacity: 1;
                    }
                }
            `}</style>
            <div onClick={(e) => e.stopPropagation()} style={{
                background: '#ffffff',
                width: '380px',
                maxWidth: '90vw',
                boxShadow: '-15px 0 45px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100% - 32px)',
                margin: '16px',
                position: 'relative',
                borderRadius: '32px',
                overflow: 'hidden',
                animation: 'slideInRight 0.5s cubic-bezier(0.19, 1, 0.22, 1)'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #f43f5e 0%, #d41424 100%)',
                    padding: '20px 18px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(4px)'
                    }}>
                        <span style={{ fontSize: '18px' }}>✏️</span>
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Edit Menu Item</h3>
                        <span style={{ fontSize: '10px', opacity: 0.9, textTransform: 'uppercase' }}>Food Menu Management</span>
                    </div>
                    <button
                        onClick={onCancel}
                        style={{
                            marginLeft: 'auto',
                            backgroundColor: 'rgba(0, 0, 0, 0.1)',
                            border: 'none',
                            color: 'white',
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '20px'
                        }}
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <div style={{
                        padding: '24px 16px 24px 16px',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        flex: 1,
                        boxSizing: 'border-box'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '2px' }}>
                                ITEM NAME <span style={{ color: '#d41424' }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.itemName}
                                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 14px',
                                    border: '2px solid #f1f5f9',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    transition: 'all 0.3s ease'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#f43f5e';
                                    e.target.style.boxShadow = '0 0 0 4px rgba(244, 63, 94, 0.08)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#f1f5f9';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '2px' }}>
                                FOOD CODE <span style={{ color: '#d41424' }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.foodCode}
                                onChange={(e) => setFormData({ ...formData, foodCode: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 14px',
                                    border: '2px solid #f1f5f9',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    transition: 'all 0.3s ease'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#f43f5e';
                                    e.target.style.boxShadow = '0 0 0 4px rgba(244, 63, 94, 0.08)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#f1f5f9';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '2px' }}>
                                CATEGORY <span style={{ color: '#d41424' }}>*</span>
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 14px',
                                    border: '2px solid #f1f5f9',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    backgroundColor: 'white',
                                    transition: 'all 0.3s ease'
                                }}
                                onFocus={(e) => {
                                    e.style.borderColor = '#f43f5e';
                                    e.style.boxShadow = '0 0 0 4px rgba(244, 63, 94, 0.08)';
                                }}
                                onBlur={(e) => {
                                    e.style.borderColor = '#f1f5f9';
                                    e.style.boxShadow = 'none';
                                }}
                            >
                                {categories.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '2px' }}>
                                PRICE ({cs})
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 14px',
                                    border: '2px solid #f1f5f9',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    transition: 'all 0.3s ease'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#f43f5e';
                                    e.target.style.boxShadow = '0 0 0 4px rgba(244, 63, 94, 0.08)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#f1f5f9';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '2px' }}>
                                DAILY STOCK (QTY)
                            </label>
                            <input
                                type="number"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                required
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 14px',
                                    border: '2px solid #f1f5f9',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    transition: 'all 0.3s ease'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#f43f5e';
                                    e.target.style.boxShadow = '0 0 0 4px rgba(244, 63, 94, 0.08)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#f1f5f9';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '2px' }}>
                                DESCRIPTION
                            </label>
                            <textarea
                                rows="3"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 14px',
                                    border: '2px solid #f1f5f9',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    resize: 'none',
                                    transition: 'all 0.3s ease'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#f43f5e';
                                    e.target.style.boxShadow = '0 0 0 4px rgba(244, 63, 94, 0.08)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#f1f5f9';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '2px' }}>
                                STATUS
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 14px',
                                    border: '2px solid #f1f5f9',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    backgroundColor: 'white',
                                    transition: 'all 0.3s ease'
                                }}
                                onFocus={(e) => {
                                    e.style.borderColor = '#f43f5e';
                                    e.style.boxShadow = '0 0 0 4px rgba(244, 63, 94, 0.08)';
                                }}
                                onBlur={(e) => {
                                    e.style.borderColor = '#f1f5f9';
                                    e.style.boxShadow = 'none';
                                }}
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div style={{
                        padding: '20px 32px 20px 16px',
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '12px',
                        background: '#f8fafc'
                    }}>
                        <button
                            type="button"
                            onClick={onCancel}
                            style={{
                                flex: 1,
                                height: '48px',
                                borderRadius: '12px',
                                border: '2px solid #e2e8f0',
                                background: '#ffffff',
                                color: '#64748b',
                                fontWeight: 800,
                                cursor: 'pointer',
                                fontSize: '13px',
                                textTransform: 'uppercase',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseDown={(e) => e.target.style.transform = 'scale(0.96)'}
                            onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            style={{
                                flex: 1.5,
                                height: '48px',
                                borderRadius: '12px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #f43f5e 0%, #d41424 100%)',
                                color: 'white',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                boxShadow: '0 8px 20px -5px rgba(225, 29, 72, 0.35)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 12px 25px -5px rgba(225, 29, 72, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 8px 20px -5px rgba(225, 29, 72, 0.35)';
                            }}
                            onMouseDown={(e) => e.target.style.transform = 'translateY(0)'}
                        >
                            <span>💾</span> SAVE CHANGES
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ItemStockStatus;

