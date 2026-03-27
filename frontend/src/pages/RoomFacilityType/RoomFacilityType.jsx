import React, { useState, useEffect } from 'react';
import './RoomFacilityType.css';
import API_URL, { apiCall } from '../../config/api';

const RoomFacilityType = () => {
    const [facilityTypes, setFacilityTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [currentFacility, setCurrentFacility] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        fetchFacilityTypes();
    }, []);

    const fetchFacilityTypes = async () => {
        try {
            setLoading(true);
            const response = await apiCall(`/api/facility-types/list`);
            const data = await response.json();
            if (data.success) {
                setFacilityTypes(data.data);
            } else {
                setError('Failed to fetch facility types');
            }
        } catch (err) {
            setError('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (mode, facility = null) => {
        setModalMode(mode);
        if (mode === 'edit' && facility) {
            setCurrentFacility(facility);
            setFormData({ name: facility.name, description: facility.description || '' });
        } else {
            setCurrentFacility(null);
            setFormData({ name: '', description: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            let response;
            if (modalMode === 'add') {
                response = await apiCall(`/api/facility-types/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            } else {
                response = await apiCall(`/api/facility-types/update/${currentFacility._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            }

            const data = await response.json();
            if (data.success) {
                setIsModalOpen(false);
                fetchFacilityTypes();
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
            const response = await apiCall(`/api/facility-types/delete/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                fetchFacilityTypes();
            } else {
                setError('Failed to delete facility type');
            }
        } catch (error) {
            setError('Error deleting facility type');
        } finally {
            setDeletingId(null);
            setPendingDeleteId(null);
        }
    };

    return (
        <div className="room-facility-type-container">
            <header className="room-facility-type-header">
                <h2>Room Facilities Setup</h2>
                <button className="add-facility-btn" onClick={() => handleOpenModal('add')}>+ Add Facility</button>
            </header>

            <div className="facility-type-table-container">
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
                ) : (
                    <div className="facility-table-wrapper">
                        <table className="facility-type-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>ID</th>
                                    <th>FACILITY</th>
                                    <th>FACILITY TYPE</th>
                                    <th style={{ width: '150px', textAlign: 'right' }}>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {facilityTypes.map((facility, index) => {
                                    const parsedTags = (facility.description || '')
                                        .split(',')
                                        .map(tag => tag.trim())
                                        .filter(Boolean);

                                    return (
                                        <tr key={facility._id}>
                                            <td data-label="ID">{index + 1}</td>
                                            <td data-label="Facility">
                                                <span className="facility-name">{facility.name}</span>
                                            </td>
                                            <td data-label="Facility Type">
                                                {parsedTags.length > 0 ? (
                                                    <div className="facility-tags-wrap">
                                                        {parsedTags.map((tag, idx) => (
                                                            <span className="facility-tag" key={`${facility._id}-tag-${idx}`}>{tag}</span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted">-</span>
                                                )}
                                            </td>
                                            <td data-label="Action" className="facility-actions-cell">
                                                <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                                                    <button className="icon-button" onClick={() => handleOpenModal('edit', facility)}>✏️</button>
                                                    <div className="inline-delete-wrap">
                                                        <button className="icon-button" onClick={() => handleDeleteClick(facility._id)} disabled={deletingId === facility._id}>🗑️</button>
                                                        {pendingDeleteId === facility._id && (
                                                            <div className="inline-delete-confirm">
                                                                <span>Are you sure want to delete?</span>
                                                                <div className="inline-delete-actions">
                                                                    <button className="inline-delete-yes" onClick={() => confirmDelete(facility._id)}>Yes</button>
                                                                    <button className="inline-delete-no" onClick={() => setPendingDeleteId(null)}>No</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {facilityTypes.length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No facilities found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="table-footer">
                    <span>Showing {facilityTypes.length} Facility Types</span>
                </div>
            </div>

            {/* Premium Modal */}
            {isModalOpen && (
                <div className="add-payment-overlay">
                    <div className="add-payment-modal add-facility-premium">
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span style={{ fontSize: '20px' }}>🛋️</span>
                            </div>
                            <div className="header-text">
                                <h3>{modalMode === 'add' ? 'Add Facility' : 'Edit Facility'}</h3>
                                <span>FACILITY MANAGEMENT</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            <div className="add-payment-body">
                                <div className="payment-field-group">
                                    <label className="field-label-premium">FACILITY NAME</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                setFormData({ ...formData, name: value });
                                            }}
                                            required
                                            placeholder="e.g. Standard Room"
                                            className="premium-input"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">FACILITY DESCRIPTION</label>
                                    <div className="premium-input-wrap">
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="e.g. Double/Queen Bed, AC/Fan, TV..."
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
                                    {modalMode === 'add' ? 'ADD FACILITY' : 'UPDATE FACILITY'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomFacilityType;
