import React, { useState, useEffect } from 'react';
import './MealType.css';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';

const MealType = () => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [mealTypes, setMealTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [currentMealType, setCurrentMealType] = useState(null);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        shortCode: '',
        includedMeals: [],
        chargeableMeals: [],
        price: ''
    });

    const standardMeals = ['Breakfast', 'Lunch', 'Dinner'];

    useEffect(() => {
        fetchMealTypes();
    }, []);

    const fetchMealTypes = async () => {
        try {
            setLoading(true);
            const response = await apiCall(`/api/meal-types/list`);
            const data = await response.json();
            if (data.success) {
                setMealTypes(data.data);
            } else {
                setError('Failed to fetch meal types');
            }
        } catch (err) {
            setError('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (mode, mealType = null) => {
        setModalMode(mode);
        if (mode === 'edit' && mealType) {
            setCurrentMealType(mealType);
            setFormData({
                name: mealType.name,
                shortCode: mealType.shortCode,
                includedMeals: mealType.includedMeals || [],
                chargeableMeals: mealType.chargeableMeals || [],
                price: mealType.price || ''
            });
        } else {
            setCurrentMealType(null);
            setFormData({
                name: '',
                shortCode: '',
                includedMeals: [],
                chargeableMeals: [],
                price: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCheckboxChange = (type, meal) => {
        setFormData(prev => {
            const list = prev[type];
            if (list.includes(meal)) {
                return { ...prev, [type]: list.filter(item => item !== meal) };
            } else {
                return { ...prev, [type]: [...list, meal] };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            ...formData,
            price: Number(formData.price) || 0
        };

        try {
            let response;
            if (modalMode === 'add') {
                response = await apiCall(`/api/meal-types/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await apiCall(`/api/meal-types/update/${currentMealType._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await response.json();
            if (data.success) {
                setIsModalOpen(false);
                fetchMealTypes();
            } else {
                alert(data.message || 'Operation failed');
            }
        } catch (error) {
            alert('Error submitting form');
        }
    };

    const handleDeleteClick = (id) => {
        setPendingDeleteId(prev => prev === id ? null : id);
    };

    const confirmDelete = async (id) => {
        setDeletingId(id);
        try {
            const response = await apiCall(`/api/meal-types/delete/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                fetchMealTypes();
            } else {
                setError('Failed to delete meal type');
            }
        } catch (error) {
            setError('Error deleting meal type');
        } finally {
            setDeletingId(null);
            setPendingDeleteId(null);
        }
    };

    return (
        <div className="meal-type-container">
            <header className="meal-type-header">
                <h2>Meal Type</h2>
                <button className="add-meal-btn" onClick={() => handleOpenModal('add')}>+ Add Meal Type</button>
            </header>

            <div className="meal-type-table-container">
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
                ) : (
                    <div className="meal-table-wrapper">
                        <table className="meal-type-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>ID</th>
                                    <th>Meal Type</th>
                                    <th>Short Code</th>
                                    <th>Price</th>
                                    <th>Included Meals</th>
                                    <th>Chargeable</th>
                                    <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mealTypes.map((meal, index) => (
                                    <tr key={meal._id}>
                                        <td data-label="ID">{index + 1}</td>
                                        <td data-label="Meal Type">{meal.name}</td>
                                        <td data-label="Short Code">{meal.shortCode}</td>
                                        <td data-label="Price">{cs} {meal.price || 0}</td>
                                        <td data-label="Included Meals">
                                            {(meal.includedMeals || []).length > 0 ? (
                                                <div className="meal-badges">
                                                    {meal.includedMeals.map((m) => (
                                                        <span key={m} className="meal-badge green">{m}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="meal-badges">
                                                    <span className="meal-badge neutral">No Meal</span>
                                                </div>
                                            )}
                                        </td>
                                        <td data-label="Chargeable">
                                            {(meal.chargeableMeals || []).length > 0 ? (
                                                <div className="meal-badges">
                                                    {meal.chargeableMeals.map((m) => (
                                                        <span key={m} className="meal-badge red">{m}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="meal-badges">
                                                    <span className="meal-badge red">No</span>
                                                </div>
                                            )}
                                        </td>
                                        <td data-label="Actions" className="meal-actions-cell">
                                            <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                                                <button className="icon-button" onClick={() => handleOpenModal('edit', meal)}>✏️</button>
                                                <div className="inline-delete-wrap">
                                                    <button className="icon-button" onClick={() => handleDeleteClick(meal._id)} disabled={deletingId === meal._id}>🗑️</button>
                                                    {pendingDeleteId === meal._id && (
                                                        <div className="inline-delete-confirm">
                                                            <span>Are you sure want to delete?</span>
                                                            <div className="inline-delete-actions">
                                                                <button className="inline-delete-yes" onClick={() => confirmDelete(meal._id)}>Yes</button>
                                                                <button className="inline-delete-no" onClick={() => setPendingDeleteId(null)}>No</button>
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
                <div className="table-footer">
                    <span>Showing {mealTypes.length} Meal Types</span>
                </div>
            </div>
                     {/* Premium Modal */}
            {isModalOpen && (
                <div className="add-payment-overlay">
                    <div className="add-payment-modal add-meal-premium">
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span style={{ fontSize: '20px' }}>🍽️</span>
                            </div>
                            <div className="header-text">
                                <h3>{modalMode === 'add' ? 'Add Meal Type' : 'Edit Meal Type'}</h3>
                                <span>MEAL SETUP</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            <div className="add-payment-body scrollable-modal-body">
                                <div className="payment-field-group">
                                    <label className="field-label-premium">MEAL TYPE NAME</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                setFormData({ ...formData, name: value });
                                            }}
                                            required
                                            placeholder="e.g. Continental Plan"
                                            className="premium-input"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">SHORT CODE</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.shortCode}
                                            onChange={(e) => setFormData({ ...formData, shortCode: e.target.value })}
                                            required
                                            placeholder="e.g. CP"
                                            className="premium-input"
                                            style={{ textTransform: 'uppercase' }}
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">PRICE</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="number"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            placeholder="Enter Price"
                                            className="premium-input"
                                            min="0"
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">INCLUDED MEALS</label>
                                    <div className="checkbox-group">
                                        {standardMeals.map(meal => (
                                            <label
                                                key={meal}
                                                className={`checkbox-card ${formData.includedMeals.includes(meal) ? 'selected' : ''}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.includedMeals.includes(meal)}
                                                    onChange={() => handleCheckboxChange('includedMeals', meal)}
                                                    style={{ display: 'none' }}
                                                />
                                                <span className="checkbox-icon">{formData.includedMeals.includes(meal) ? '✓' : ''}</span>
                                                {meal}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">CHARGEABLE MEALS</label>
                                    <div className="checkbox-group">
                                        {standardMeals.map(meal => (
                                            <label
                                                key={meal}
                                                className={`checkbox-card ${formData.chargeableMeals.includes(meal) ? 'selected' : ''}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.chargeableMeals.includes(meal)}
                                                    onChange={() => handleCheckboxChange('chargeableMeals', meal)}
                                                    style={{ display: 'none' }}
                                                />
                                                <span className="checkbox-icon">{formData.chargeableMeals.includes(meal) ? '✓' : ''}</span>
                                                {meal}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="payment-modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    CANCEL
                                </button>
                                <button type="submit" className="btn-primary">
                                    {modalMode === 'add' ? 'ADD MEAL' : 'UPDATE MEAL'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MealType;
