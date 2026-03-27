import React, { useState, useEffect } from 'react';
import './ReservationType.css';
import API_URL, { apiCall } from '../../config/api';

const ReservationType = () => {
    const [reservationTypes, setReservationTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [currentReservationType, setCurrentReservationType] = useState(null);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });

    useEffect(() => {
        fetchReservationTypes();
    }, []);

    const fetchReservationTypes = async () => {
        try {
            setLoading(true);
            const response = await apiCall(`/api/reservation-types/list`);
            const data = await response.json();
            if (data.success) {
                setReservationTypes(data.data);
            } else {
                setError('Failed to fetch reservation types');
            }
        } catch (err) {
            setError('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (mode, type = null) => {
        setModalMode(mode);
        if (mode === 'edit' && type) {
            setCurrentReservationType(type);
            setFormData({
                name: type.name,
                description: type.description || ''
            });
        } else {
            setCurrentReservationType(null);
            setFormData({
                name: '',
                description: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            let response;
            if (modalMode === 'add') {
                response = await apiCall(`/api/reservation-types/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            } else {
                response = await apiCall(`/api/reservation-types/update/${currentReservationType._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            }

            const data = await response.json();
            if (data.success) {
                setIsModalOpen(false);
                fetchReservationTypes();
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
            const response = await apiCall(`/api/reservation-types/delete/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                fetchReservationTypes();
            } else {
                setError('Failed to delete reservation type');
            }
        } catch (error) {
            setError('Error deleting reservation type');
        } finally {
            setDeletingId(null);
            setPendingDeleteId(null);
        }
    };

    return (
        <div className="reservation-type-container">
            <header className="reservation-type-header">
                <h2>Reservation Type</h2>
                <button className="add-reservation-btn" onClick={() => handleOpenModal('add')}>+ Add Reservation Type</button>
            </header>

            <div className="reservation-type-table-container">
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
                ) : (
                    <div className="reservation-table-wrapper">
                        <table className="reservation-type-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>ID</th>
                                    <th>Reservation Type</th>
                                    <th>Description</th>
                                    <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reservationTypes.map((type, index) => (
                                    <tr key={type._id}>
                                        <td data-label="ID">{index + 1}</td>
                                        <td data-label="Reservation Type">{type.name}</td>
                                        <td data-label="Description" className="reservation-description-cell">{type.description || '-'}</td>
                                        <td data-label="Actions" className="reservation-actions-cell">
                                            <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                                                <button className="icon-button" onClick={() => handleOpenModal('edit', type)}>✏️</button>
                                                <div className="inline-delete-wrap">
                                                    <button className="icon-button" onClick={() => handleDeleteClick(type._id)} disabled={deletingId === type._id}>🗑️</button>
                                                    {pendingDeleteId === type._id && (
                                                        <div className="inline-delete-confirm">
                                                            <span>Are you sure want to delete?</span>
                                                            <div className="inline-delete-actions">
                                                                <button className="inline-delete-yes" onClick={() => confirmDelete(type._id)}>Yes</button>
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
                    <span>Showing {reservationTypes.length} Reservation Types</span>
                </div>
            </div>

            {/* Premium Modal */}
            {isModalOpen && (
                <div className="add-payment-overlay">
                    <div className="add-payment-modal add-reservation-premium">
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span style={{ fontSize: '20px' }}>🔖</span>
                            </div>
                            <div className="header-text">
                                <h3>{modalMode === 'add' ? 'Add Reservation Type' : 'Edit Reservation Type'}</h3>
                                <span>RESERVATION SETUP</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            <div className="add-payment-body">
                                <div className="payment-field-group">
                                    <label className="field-label-premium">RESERVATION TYPE</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                setFormData({ ...formData, name: value });
                                            }}
                                            required
                                            placeholder="e.g. Walk-In, Online Booking"
                                            className="premium-input"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">DESCRIPTION</label>
                                    <div className="premium-input-wrap">
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Brief description..."
                                            className="premium-input premium-textarea"
                                            rows="3"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="payment-modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    CANCEL
                                </button>
                                <button type="submit" className="btn-primary">
                                    {modalMode === 'add' ? 'ADD TYPE' : 'UPDATE TYPE'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReservationType;
