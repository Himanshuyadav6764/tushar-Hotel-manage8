// Simplified Food Menu Component for Dashboard Integration
import React, { useState, useEffect } from 'react';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';
import {
    FIXED_MENU_CATEGORIES,
    FIXED_CATEGORY_ICONS,
    normalizeCategoryName,
    mergeCategoryLists
} from '../../constants/menuCategories';

const CUSTOM_CATEGORY_STORAGE_KEY = 'foodMenuCustomCategories';

const FoodMenuDashboard = () => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All Categories');
    const [customCategories, setCustomCategories] = useState([]);
    const [addFormData, setAddFormData] = useState({ itemName: '', price: '', foodCode: '', description: '', category: '', image: '' });
    const [editFormData, setEditFormData] = useState({ itemName: '', price: '', foodCode: '', description: '', category: '', image: '' });
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [activeCategoryInputMode, setActiveCategoryInputMode] = useState('');
    const [newCategoryValue, setNewCategoryValue] = useState('');
    const [categoryInputError, setCategoryInputError] = useState('');
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const categories = [
        'All Categories',
        ...mergeCategoryLists(
            FIXED_MENU_CATEGORIES,
            customCategories,
            menuItems.map((item) => item.category)
        )
    ];

    // Category icons mapping
    const categoryIcons = FIXED_CATEGORY_ICONS;

    const inferCategoryIcon = (categoryName) => {
        const value = (categoryName || '').toLowerCase();

        if (value.includes('starter') || value.includes('snack')) return '🍴';
        if (value.includes('main')) return '🍛';
        if (value.includes('breakfast') || value.includes('tea') || value.includes('coffee')) return '☕';
        if (value.includes('rice') || value.includes('biryani')) return '🍚';
        if (value.includes('dessert') || value.includes('sweet') || value.includes('mithai')) return '🍨';
        if (value.includes('beverage') || value.includes('drink') || value.includes('juice')) return '🥤';
        if (value.includes('chinese')) return '🥡';
        if (value.includes('continental') || value.includes('pasta')) return '🍝';
        if (value.includes('pizza')) return '🍕';
        if (value.includes('bread') || value.includes('roti') || value.includes('naan')) return '🍞';
        if (value.includes('soup')) return '🥣';

        return '🍽️';
    };

    const getCategoryWithIcon = (categoryName) => {
        if (!categoryName) return '';

        const icon = categoryIcons[categoryName] || inferCategoryIcon(categoryName);
        return `${icon} ${categoryName}`;
    };

    const openCategoryInput = (mode = 'add') => {
        setActiveCategoryInputMode(mode);
        setNewCategoryValue('');
        setCategoryInputError('');
    };

    const closeCategoryInput = () => {
        setActiveCategoryInputMode('');
        setNewCategoryValue('');
        setCategoryInputError('');
    };

    const handleInlineCategoryAdd = () => {
        const formattedCategory = normalizeCategoryName(newCategoryValue);

        if (!formattedCategory) {
            setCategoryInputError('Please enter category name.');
            return;
        }

        const existingCategory = categories.find(cat =>
            cat !== 'All Categories' && cat.toLowerCase() === formattedCategory.toLowerCase()
        );

        const finalCategory = existingCategory || formattedCategory;

        if (!existingCategory) {
            setCustomCategories(prev => {
                if (prev.some(cat => cat.toLowerCase() === finalCategory.toLowerCase())) return prev;
                return [...prev, finalCategory];
            });
        }

        if (activeCategoryInputMode === 'add') {
            setAddFormData(prev => ({ ...prev, category: finalCategory }));
        } else if (activeCategoryInputMode === 'edit') {
            setEditFormData(prev => ({ ...prev, category: finalCategory }));
        }

        closeCategoryInput();
    };

    const normalizeImageUrl = (value) => {
        if (!value || typeof value !== 'string') return '';

        const trimmed = value.trim();
        if (!trimmed) return '';

        if (/^www\./i.test(trimmed)) {
            return `https://${trimmed}`;
        }

        if (/^\/\//.test(trimmed)) {
            return `https:${trimmed}`;
        }

        if (!/^https?:\/\//i.test(trimmed)) {
            return trimmed;
        }

        try {
            const parsed = new URL(trimmed);
            const host = parsed.hostname.toLowerCase();
            const mediaUrl = parsed.searchParams.get('mediaurl') || parsed.searchParams.get('imgurl');

            // If a search-result URL is pasted, persist the real image URL instead.
            if (mediaUrl && (host.includes('bing.com') || host.includes('google.'))) {
                return decodeURIComponent(mediaUrl);
            }
        } catch (error) {
            // If parsing fails, keep original input and let rendering fallback handle it.
        }

        return trimmed;
    };

    // Fetch menu items
    useEffect(() => {
        try {
            const storedCategories = JSON.parse(localStorage.getItem(CUSTOM_CATEGORY_STORAGE_KEY) || '[]');
            if (Array.isArray(storedCategories)) {
                setCustomCategories(storedCategories.map(normalizeCategoryName).filter(Boolean));
            }
        } catch (error) {
            console.error('Error loading custom categories:', error);
        }

        fetchMenuItems();
    }, []);

    useEffect(() => {
        localStorage.setItem(CUSTOM_CATEGORY_STORAGE_KEY, JSON.stringify(customCategories));
    }, [customCategories]);

    useEffect(() => {
        if (!pendingDeleteId) return;

        const timer = setTimeout(() => setPendingDeleteId(null), 5000);
        return () => clearTimeout(timer);
    }, [pendingDeleteId]);

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

    const handleAddItem = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Required by backend
        const foodCode = formData.get('foodCode') || `FC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

        const newItem = {
            itemName: addFormData.itemName,
            foodCode: addFormData.foodCode || foodCode, // Required by backend
            category: normalizeCategoryName(addFormData.category),
            price: parseFloat(addFormData.price),
            description: addFormData.description || '',
            image: normalizeImageUrl(addFormData.image),
            status: 'Active'
        };

        try {
            const response = await apiCall(`/api/menu/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem),
            });
            const data = await response.json();
            if (data.success) {
                await fetchMenuItems();
                setShowAddForm(false);
                closeCategoryInput();
                setAddFormData({ itemName: '', price: '', foodCode: '', description: '', category: '', image: '' });
            } else {
                alert(data.message || 'Failed to add item. Check if "Food Code" is unique.');
            }
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Network error while adding item.');
        }
    };

    const handleEditItem = (item) => {
        setEditingItem(item);
        setEditFormData({
            itemName: item.itemName,
            price: item.price.toString(),
            foodCode: item.foodCode,
            description: item.description || '',
            category: item.category,
            image: item.image || ''
        });
        closeCategoryInput();
        setShowEditModal(true);
    };

    const handleUpdateItem = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedItem = {
            itemName: editFormData.itemName,
            foodCode: editFormData.foodCode || editingItem.foodCode,
            category: normalizeCategoryName(editFormData.category),
            price: parseFloat(editFormData.price),
            description: editFormData.description || '',
            image: normalizeImageUrl(editFormData.image)
        };

        try {
            const response = await apiCall(`/api/menu/update/${editingItem._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedItem),
            });
            const data = await response.json();
            if (data.success) {
                await fetchMenuItems();
                setShowEditModal(false);
                closeCategoryInput();
                setEditingItem(null);
            }
        } catch (error) {
            console.error('Error updating item:', error);
        }
    };

    const handleToggleStatus = async (item) => {
        const newStatus = item.status === 'Active' ? 'Inactive' : 'Active';
        try {
            const response = await apiCall(`/api/menu/update/${item._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await response.json();
            if (data.success) {
                setMenuItems(menuItems.map(i =>
                    i._id === item._id ? { ...i, status: newStatus } : i
                ));
            }
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    const handleDeleteItem = async (id) => {
        try {
            const response = await apiCall(`/api/menu/delete/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                await fetchMenuItems();
            }
        } catch (error) {
            console.error('Error deleting item:', error);
        } finally {
            setPendingDeleteId(null);
        }
    };

    const filteredItems = menuItems.filter(item => {
        const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory =
            filterCategory === 'All Categories'
            || String(item.category || '').trim().toLowerCase() === String(filterCategory || '').trim().toLowerCase();
        return matchesSearch && matchesCategory;
    });

    return (
        <div style={{ padding: '5px 20px 20px 20px' }}>
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: isMobile ? '10px' : 0,
                marginBottom: '15px'
            }}>
                <h2 style={{ margin: 0 }}>🍽️ Food Menu Management</h2>
                <button
                    onClick={() => {
                        if (showAddForm) closeCategoryInput();
                        setShowAddForm(!showAddForm);
                    }}
                    style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        width: isMobile ? '100%' : 'auto'
                    }}
                >
                    {showAddForm ? 'Cancel' : '+ Add Item'}
                </button>
            </div>

            {showAddForm && (
                <form onSubmit={handleAddItem} style={{
                    backgroundColor: 'white',
                    padding: isMobile ? '14px' : '20px',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))',
                        columnGap: '15px',
                        rowGap: '15px'
                    }}>
                        <div style={{ minWidth: 0 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600 }}>Item ID</label>
                            <input name="foodCode" value={addFormData.foodCode} onChange={e => setAddFormData({ ...addFormData, foodCode: e.target.value })} placeholder="Optional" style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px'
                            }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600 }}>Item Name *</label>
                            <input name="itemName" value={addFormData.itemName} onChange={e => setAddFormData({ ...addFormData, itemName: e.target.value.replace(/[^A-Za-z\s]/g, '') })} required style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px'
                            }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600 }}>Category *</label>
                            <div style={{ position: 'relative' }}>
                                <select name="category" value={addFormData.category} onChange={e => setAddFormData({ ...addFormData, category: e.target.value })} required style={{
                                    width: '100%',
                                    padding: '10px 44px 10px 10px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px'
                                }}>
                                    <option value="">Select category</option>
                                    {categories.filter(c => c !== 'All Categories').map(cat => (
                                        <option key={cat} value={cat}>{getCategoryWithIcon(cat)}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => openCategoryInput('add')}
                                    title="Add category"
                                    style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '999px',
                                        border: '1px solid #f87171',
                                        background: '#fff1f2',
                                        color: '#be123c',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        lineHeight: '1'
                                    }}
                                >
                                    +
                                </button>
                            </div>
                            {addFormData.category && (
                                <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                    Selected: {getCategoryWithIcon(addFormData.category)}
                                </div>
                            )}
                            {activeCategoryInputMode === 'add' && (
                                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={newCategoryValue}
                                        onChange={(e) => {
                                            setNewCategoryValue(e.target.value);
                                            if (categoryInputError) setCategoryInputError('');
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleInlineCategoryAdd();
                                            }
                                        }}
                                        placeholder="Type new category"
                                        style={{
                                            width: '100%',
                                            padding: '9px 10px',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '6px'
                                        }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={handleInlineCategoryAdd}
                                            style={{
                                                backgroundColor: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 600
                                            }}
                                        >
                                            Add
                                        </button>
                                        <button
                                            type="button"
                                            onClick={closeCategoryInput}
                                            style={{
                                                backgroundColor: '#f8fafc',
                                                color: '#334155',
                                                border: '1px solid #e2e8f0',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 600
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    {categoryInputError && (
                                        <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>
                                            {categoryInputError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600 }}>Price ({cs}) *</label>
                            <input name="price" type="number" value={addFormData.price} onChange={e => {
                                const val = e.target.value;
                                if (val === '' || parseFloat(val) >= 0) {
                                    setAddFormData({ ...addFormData, price: val });
                                }
                            }} required style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px'
                            }} />
                        </div>
                    </div>
                    <div style={{ marginTop: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600 }}>Image URL (Optional)</label>
                        <input
                            name="image"
                            type="url"
                            value={addFormData.image}
                            onChange={e => setAddFormData({ ...addFormData, image: e.target.value })}
                            placeholder="https://example.com/food-image.jpg"
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px'
                            }}
                        />
                    </div>
                    <div style={{ marginTop: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600 }}>Description</label>
                        <textarea name="description" value={addFormData.description} onChange={e => setAddFormData({ ...addFormData, description: e.target.value })} rows="3" style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px'
                        }} />
                    </div>
                    <button type="submit" style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '10px 24px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginTop: '15px'
                    }}>
                        Add Item
                    </button>
                </form>
            )}

            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    padding: '15px 20px',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    <div style={{ fontWeight: 600 }}>📋 ITEMS LIST</div>
                </div>

                <div style={{ padding: '20px' }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        justifyContent: 'space-between',
                        gap: '10px',
                        marginBottom: '15px'
                    }}>
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px'
                            }}
                        />
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            style={{
                                width: isMobile ? '100%' : '260px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                background: '#fff'
                            }}
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat === 'All Categories' ? '🍽️ All Categories' : getCategoryWithIcon(cat)}</option>
                            ))}
                        </select>
                    </div>

                    {filteredItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                            <p style={{ fontSize: '18px', marginBottom: '10px' }}>📋 No items found</p>
                            <p>Click "+ Add Item" to add your first menu item</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                display: isMobile ? 'block' : 'table'
                            }}>
                                <thead style={{ display: isMobile ? 'none' : 'table-header-group' }}>
                                    <tr style={{ backgroundColor: '#fef2f2', textAlign: 'left' }}>
                                        <th style={{ padding: '12px' }}>#</th>
                                        <th style={{ padding: '12px' }}>Item Name</th>
                                        <th style={{ padding: '12px' }}>Category</th>
                                        <th style={{ padding: '12px' }}>Description</th>
                                        <th style={{ padding: '12px' }}>Price</th>
                                        <th style={{ padding: '12px' }}>Status</th>
                                        <th style={{ padding: '12px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody style={{ display: isMobile ? 'block' : 'table-row-group' }}>
                                    {filteredItems.map((item, index) => (
                                        <tr
                                            key={item._id}
                                            style={isMobile ? {
                                                display: 'block',
                                                width: '100%',
                                                marginBottom: '12px',
                                                borderRadius: '12px',
                                                padding: '12px',
                                                border: '1px solid #fecaca',
                                                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                                                background: '#fff'
                                            } : { borderBottom: '1px solid #f3f4f6' }}
                                        >
                                            <td data-label="#" style={isMobile ? {
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 0',
                                                borderBottom: '1px solid #eee'
                                            } : { padding: '12px' }}>
                                                {isMobile && <span style={{ fontWeight: 700, color: '#555' }}>#</span>}
                                                <span>{index + 1}</span>
                                            </td>
                                            <td data-label="Item" style={isMobile ? {
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 0',
                                                borderBottom: '1px solid #eee'
                                            } : { padding: '12px' }}>
                                                {isMobile && <span style={{ fontWeight: 700, color: '#555' }}>Item</span>}
                                                <span>{item.itemName}</span>
                                            </td>
                                            <td data-label="Category" style={isMobile ? {
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 0',
                                                borderBottom: '1px solid #eee'
                                            } : { padding: '12px' }}>
                                                {isMobile && <span style={{ fontWeight: 700, color: '#555' }}>Category</span>}
                                                <span>{getCategoryWithIcon(item.category)}</span>
                                            </td>
                                            <td data-label="Description" style={isMobile ? {
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-start',
                                                padding: '8px 0',
                                                borderBottom: '1px solid #eee',
                                                gap: '4px'
                                            } : { padding: '12px' }}>
                                                {isMobile && <span style={{ fontWeight: 700, color: '#555' }}>Description</span>}
                                                <span>{item.description || '---'}</span>
                                            </td>
                                            <td data-label="Price" style={isMobile ? {
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 0',
                                                borderBottom: '1px solid #eee',
                                                fontWeight: 700,
                                                color: '#2e7d32'
                                            } : { padding: '12px', fontWeight: 700, color: '#2e7d32' }}>
                                                {isMobile && <span style={{ fontWeight: 700, color: '#555' }}>Price</span>}
                                                <span>{cs}{item.price}</span>
                                            </td>
                                            <td data-label="Status" style={isMobile ? {
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 0',
                                                borderBottom: '1px solid #eee'
                                            } : { padding: '12px' }}>
                                                {isMobile && <span style={{ fontWeight: 700, color: '#555' }}>Status</span>}
                                                <span style={{
                                                    backgroundColor: item.status === 'Active' ? '#d1fae5' : '#fee2e2',
                                                    color: item.status === 'Active' ? '#065f46' : '#991b1b',
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: 600
                                                }}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td data-label="Actions" style={isMobile ? {
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'flex-start',
                                                padding: '8px 0',
                                                borderBottom: 'none'
                                            } : { padding: '12px' }}>
                                                {isMobile && <span style={{ fontWeight: 700, color: '#555' }}>Actions</span>}
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        onClick={() => handleEditItem(item)}
                                                        title="Edit"
                                                        style={{
                                                            backgroundColor: '#fef3c7',
                                                            border: 'none',
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '16px'
                                                        }}
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(item)}
                                                        title={item.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                        style={{
                                                            backgroundColor: item.status === 'Active' ? '#dcfce7' : '#fee2e2',
                                                            border: 'none',
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '16px'
                                                        }}
                                                    >
                                                        {item.status === 'Active' ? '✓' : '✗'}
                                                    </button>
                                                    <div style={{ position: 'relative' }}>
                                                        <button
                                                            onClick={() => setPendingDeleteId(item._id)}
                                                            title="Delete"
                                                            style={{
                                                                backgroundColor: '#fef2f2',
                                                                border: 'none',
                                                                padding: '6px 12px',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '16px'
                                                            }}
                                                        >
                                                            🗑️
                                                        </button>

                                                        {pendingDeleteId === item._id && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: 'calc(100% + 8px)',
                                                                right: 0,
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
                                                                boxShadow: '0 8px 16px rgba(239, 68, 68, 0.18)',
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
                                                                            background: '#dc2626',
                                                                            color: '#fff',
                                                                            cursor: 'pointer',
                                                                            fontWeight: 700,
                                                                            fontSize: '12px'
                                                                        }}
                                                                        title="Yes"
                                                                    >
                                                                        Yes
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPendingDeleteId(null)}
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
                                                                        title="No"
                                                                    >
                                                                        No
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal - Slide Drawer */}
            {showEditModal && editingItem && (
                <div onClick={() => {
                    closeCategoryInput();
                    setShowEditModal(false);
                }} style={{
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
                        <div style={{
                            background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
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
                                onClick={() => {
                                    closeCategoryInput();
                                    setShowEditModal(false);
                                }}
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

                        <form onSubmit={handleUpdateItem} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
                                        ITEM ID (Food Code)
                                    </label>
                                    <input
                                        name="foodCode"
                                        value={editFormData.foodCode}
                                        onChange={e => setEditFormData({ ...editFormData, foodCode: e.target.value })}
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
                                        ITEM NAME
                                    </label>
                                    <input
                                        name="itemName"
                                        value={editFormData.itemName}
                                        onChange={e => setEditFormData({ ...editFormData, itemName: e.target.value.replace(/[^A-Za-z\s]/g, '') })}
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
                                        CATEGORY <span style={{ color: '#e11d48' }}>*</span>
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            name="category"
                                            value={editFormData.category}
                                            onChange={e => setEditFormData({ ...editFormData, category: e.target.value })}
                                            required
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '10px 44px 10px 14px',
                                                border: '2px solid #f1f5f9',
                                                borderRadius: '10px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                backgroundColor: 'white',
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
                                        >
                                            {categories.filter(c => c !== 'All Categories').map(cat => (
                                                <option key={cat} value={cat}>{getCategoryWithIcon(cat)}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => openCategoryInput('edit')}
                                            title="Add category"
                                            style={{
                                                position: 'absolute',
                                                right: '12px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '8px',
                                                border: '1px solid #e11d48',
                                                background: '#fff1f2',
                                                color: '#e11d48',
                                                cursor: 'pointer',
                                                fontWeight: 800,
                                                fontSize: '16px',
                                                lineHeight: '1'
                                            }}
                                        >
                                            +
                                        </button>
                                    </div>
                                    {editFormData.category && (
                                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                            Selected: {getCategoryWithIcon(editFormData.category)}
                                        </div>
                                    )}
                                    {activeCategoryInputMode === 'edit' && (
                                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <input
                                                type="text"
                                                value={newCategoryValue}
                                                onChange={(e) => {
                                                    setNewCategoryValue(e.target.value);
                                                    if (categoryInputError) setCategoryInputError('');
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleInlineCategoryAdd();
                                                    }
                                                }}
                                                placeholder="Type new category"
                                                style={{
                                                    width: '100%',
                                                    boxSizing: 'border-box',
                                                    padding: '10px 14px',
                                                    border: '2px solid #f1f5f9',
                                                    borderRadius: '10px',
                                                    fontSize: '13px',
                                                    fontWeight: 600
                                                }}
                                            />
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={handleInlineCategoryAdd}
                                                    style={{
                                                        backgroundColor: '#e11d48',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '8px 12px',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        fontWeight: 700,
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    Add
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={closeCategoryInput}
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        color: '#475569',
                                                        border: '1px solid #cbd5e1',
                                                        padding: '8px 12px',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        fontWeight: 700,
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                            {categoryInputError && (
                                                <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: 700 }}>
                                                    {categoryInputError}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '2px' }}>
                                        PRICE ({cs})
                                    </label>
                                    <input
                                        name="price"
                                        type="number"
                                        value={editFormData.price}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === '' || parseFloat(val) >= 0) {
                                                setEditFormData({ ...editFormData, price: val });
                                            }
                                        }}
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
                                        IMAGE URL (Optional)
                                    </label>
                                    <input
                                        name="image"
                                        type="url"
                                        value={editFormData.image}
                                        onChange={e => setEditFormData({ ...editFormData, image: e.target.value })}
                                        placeholder="https://example.com/food-image.jpg"
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
                                        name="description"
                                        rows="3"
                                        value={editFormData.description}
                                        onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                                        placeholder="Brief description of the item"
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
                                            e.target.style.background = '#fff';
                                            e.target.style.boxShadow = '0 0 0 4px rgba(244, 63, 94, 0.08)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#f1f5f9';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                    />
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
                                    onClick={() => {
                                        closeCategoryInput();
                                        setShowEditModal(false);
                                    }}
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
                                        background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
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
                                    <span>✏️</span> Update Item
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FoodMenuDashboard;

