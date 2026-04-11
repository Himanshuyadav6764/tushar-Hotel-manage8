import React, { useState, useEffect } from 'react';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';
import './FoodMenu.css';

// Food Menu Management - Updated with Icons
const FoodMenu = () => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [showAddForm, setShowAddForm] = useState(false);
    const [menuItems, setMenuItems] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All Categories');
    const [currentPage, setCurrentPage] = useState(1);
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

    const handleAddItem = async (newItem) => {
        try {
            const response = await apiCall(`/api/menu/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newItem),
            });
            const data = await response.json();
            if (data.success) {
                setMenuItems([data.data, ...menuItems]);
                setFilterCategory('All Categories');
                setCurrentPage(1);
                setShowAddForm(false);
                alert('Item added successfully!');
            } else {
                alert(data.message || 'Failed to add item');
            }
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Error adding item. Please try again.');
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
        if (window.confirm('Are you sure you want to delete this item?')) {
            try {
                const response = await apiCall(`/api/menu/delete/${id}`, {
                    method: 'DELETE',
                });
                const data = await response.json();
                if (data.success) {
                    setMenuItems(menuItems.filter(item => item._id !== id));
                    alert('Item deleted successfully!');
                } else {
                    alert(data.message || 'Failed to delete item');
                }
            } catch (error) {
                console.error('Error deleting item:', error);
                alert('Error deleting item. Please try again.');
            }
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
        <div className="food-menu-container">
            {/* Header */}
            <div className="food-menu-header">
                <div className="header-left">
                    <span className="menu-icon">🎁</span>
                    <h1>Food Menu</h1>
                </div>
                <div className="header-right">
                    <div className="search-box">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                        />
                    </div>
                    <div className="notification-icon">
                        <span>🔔</span>
                        <span className="badge">3</span>
                    </div>
                    <div className="mail-icon">✉️</div>
                    <div className="profile-menu">
                        <img src="/api/placeholder/40/40" alt="Profile" />
                        <span>▼</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="food-menu-content">
                <div className="content-header">
                    <h2>Food Menu</h2>
                    <div className="header-actions">
                        <button
                            className="btn-add-item"
                            onClick={() => setShowAddForm(!showAddForm)}
                        >
                            + Add Item
                        </button>
                        <button className="btn-show-menu">
                            🎁 Show Menu
                        </button>
                    </div>
                </div>

                {/* Add Item Form */}
                {showAddForm && (
                    <AddItemForm
                        onSubmit={handleAddItem}
                        onCancel={() => setShowAddForm(false)}
                    />
                )}

                {/* Items List */}
                <div className="items-list-card">
                    <div className="list-header">
                        <div className="list-title">
                            ☰ ITEMS LIST
                        </div>
                        <div className="filter-section">
                            <label>Filter by Category.</label>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="category-filter"
                            >
                                {categories.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="table-container">
                        <table className="items-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Code</th>
                                    <th>Item Name</th>
                                    <th>Category</th>
                                    <th>Description</th>
                                    <th>Price</th>
                                    <th>Status</th>
                                    <th>Actions</th>
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
                                            <span className={`status-badge ${item.status.toLowerCase()}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="action-btn edit-btn"
                                                    onClick={() => setEditingItem(item)}
                                                    title="Edit"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="action-btn link-btn"
                                                    title="Link"
                                                >
                                                    🔗
                                                </button>
                                                <button
                                                    className="action-btn copy-btn"
                                                    title="Copy"
                                                >
                                                    📋
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
                                                    onClick={() => handleDeleteItem(item._id)}
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

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

// Add Item Form Component
const AddItemForm = ({ onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        itemName: '',
        foodCode: '',
        category: '',
        price: '',
        description: '',
        quantity: 0,
        status: 'Active'
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

        // Basic validation check
        if (!formData.itemName || !formData.category || !formData.price) {
            alert('Please fill in all required fields (Item Name, Category, Price)');
            return;
        }

        // Generate a random food code if not provided
        const generatedFoodCode = `FC-${Math.floor(1000 + Math.random() * 9000)}`;

        onSubmit({
            ...formData,
            foodCode: generatedFoodCode,
            price: parseFloat(formData.price)
        });
        setFormData({
            itemName: '',
            foodCode: '',
            category: '',
            price: '',
            description: '',
            status: 'Active'
        });
    };

    return (
        <div className="add-item-form-card">
            <div className="form-header">
                <span className="form-icon">➕</span>
                <h3>Add New Item</h3>
            </div>
            <form onSubmit={handleSubmit}>
                <div className="form-row">
                    <div className="form-group">
                        <label>ITEM NAME <span className="required">*</span></label>
                        <input
                            type="text"
                            placeholder="e.g. Paneer Butter Masala"
                            value={formData.itemName}
                            onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                            required
                        />
                    </div>
                    {/* Food Code is auto-generated */}
                    <div className="form-group">
                        <label>CATEGORY <span className="required">*</span></label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            required
                        >
                            <option value="">🎁 Select category</option>
                            {categories.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>PRICE ({cs})</label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>DAILY STOCK (QTY)</label>
                        <input
                            type="number"
                            placeholder="0"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                            required
                        />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group full-width">
                        <label>DESCRIPTION</label>
                        <textarea
                            rows="4"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                </div>
                <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-submit">
                        ➕ Add Item
                    </button>
                </div>
            </form>
        </div>
    );
};

// Edit Item Modal Component
const EditItemModal = ({ item, onSave, onCancel }) => {
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

export default FoodMenu;

