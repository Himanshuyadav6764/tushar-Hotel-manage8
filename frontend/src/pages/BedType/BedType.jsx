import React, { useState, useEffect } from 'react';
import './BedType.css';
import API_URL, { apiCall } from '../../config/api';

const BedType = () => {
    const [bedTypes, setBedTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [currentBedType, setCurrentBedType] = useState(null);
    const [formData, setFormData] = useState({ name: '' });
    const [inlineNote, setInlineNote] = useState({ show: false, title: '', message: '', tone: 'success' });
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    useEffect(() => {
        fetchBedTypes();
    }, []);

    useEffect(() => {
        if (!inlineNote.show) return;
        const timer = setTimeout(() => {
            setInlineNote(prev => ({ ...prev, show: false }));
        }, 2600);
        return () => clearTimeout(timer);
    }, [inlineNote.show]);

    const fetchBedTypes = async () => {
        try {
            setLoading(true);
            const response = await apiCall(`/api/bed-types/list`);
            const data = await response.json();
            if (data.success) {
                setBedTypes(data.data);
            } else {
                setError('Failed to fetch bed types');
            }
        } catch (err) {
            setError('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const showInlineNote = (title, message, tone = 'success') => {
        setInlineNote({ show: true, title, message, tone });
    };

    const handleOpenModal = (mode, bed = null) => {
        setModalMode(mode);
        if (mode === 'edit' && bed) {
            setCurrentBedType(bed);
            setFormData({ name: bed.name });
        } else {
            setCurrentBedType(null);
            setFormData({ name: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let response;
            if (modalMode === 'add') {
                response = await apiCall(`/api/bed-types/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            } else {
                response = await apiCall(`/api/bed-types/update/${currentBedType._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            }

            const data = await response.json();
            if (data.success) {
                setIsModalOpen(false);
                showInlineNote(modalMode === 'add' ? 'Bed Type Added' : 'Bed Type Updated', `${formData.name} saved successfully.`);
                fetchBedTypes();
            } else {
                showInlineNote('Save Failed', data.message || 'Operation failed', 'danger');
            }
        } catch (error) {
            showInlineNote('Save Failed', 'Error submitting form', 'danger');
        }
    };

    const handleDelete = (id) => {
        setDeleteTargetId(id);
    };

    const confirmDelete = async (id) => {
        try {
            const response = await apiCall(`/api/bed-types/delete/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                showInlineNote('Bed Type Deleted', 'Bed type removed successfully.');
                fetchBedTypes();
            } else {
                showInlineNote('Delete Failed', 'Failed to delete', 'danger');
            }
        } catch (error) {
            showInlineNote('Delete Failed', 'Error deleting', 'danger');
        } finally {
            setDeleteTargetId(null);
        }
    };

    return (
        <div className="bed-type-container">
            <header className="bed-type-header">
                <h2>Bed Type Setup</h2>
                <button className="add-bed-btn" onClick={() => handleOpenModal('add')}>+ Add Bed Type</button>
            </header>

            {inlineNote.show && (
                <div
                    style={{
                        marginBottom: '14px',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        border: `1px solid ${inlineNote.tone === 'danger' ? '#fecaca' : '#dcfce7'}`,
                        background: inlineNote.tone === 'danger' ? '#fef2f2' : '#f0fdf4',
                        color: inlineNote.tone === 'danger' ? '#991b1b' : '#14532d',
                        fontWeight: 600,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '10px'
                    }}
                >
                    <div>
                        <div style={{ fontWeight: 800 }}>{inlineNote.title}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{inlineNote.message}</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setInlineNote(prev => ({ ...prev, show: false }))}
                        style={{ border: 'none', background: 'transparent', color: 'inherit', fontSize: '1.1rem', cursor: 'pointer' }}
                    >
                        x
                    </button>
                </div>
            )}

            <div className="bed-type-table-container">
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
                ) : (
                    <table className="bed-type-table">
                        <thead>
                            <tr>
                                <th style={{ width: '80px' }}>ID</th>
                                <th>Bed Type</th>
                                <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bedTypes.map((bed, index) => (
                                <tr key={bed._id}>
                                    <td>{index + 1}</td>
                                    <td>{bed.name}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div className="action-btns" style={{ justifyContent: 'flex-end', position: 'relative' }}>
                                            <button className="icon-button" onClick={() => handleOpenModal('edit', bed)}>✏️</button>
                                            <button className="icon-button" onClick={() => handleDelete(bed._id)}>🗑️</button>

                                            {deleteTargetId === bed._id && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        top: '110%',
                                                        right: 0,
                                                        zIndex: 20,
                                                        width: '220px',
                                                        padding: '10px',
                                                        borderRadius: '10px',
                                                        border: '1px solid #fecaca',
                                                        background: '#fff5f5',
                                                        boxShadow: '0 10px 20px rgba(153, 27, 27, 0.15)',
                                                        textAlign: 'left'
                                                    }}
                                                >
                                                    <div style={{ color: '#991b1b', fontWeight: 700, fontSize: '0.8rem', marginBottom: '8px' }}>
                                                        Are you sure want to delete?
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => confirmDelete(bed._id)}
                                                            style={{ flex: 1, border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', padding: '6px 8px', fontWeight: 700, cursor: 'pointer' }}
                                                        >
                                                            Yes
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteTargetId(null)}
                                                            style={{ flex: 1, border: '1px solid #fca5a5', borderRadius: '6px', background: '#fff', color: '#991b1b', padding: '6px 8px', fontWeight: 700, cursor: 'pointer' }}
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
                )}
                <div className="table-footer">
                    <span>Showing {bedTypes.length} Bed Types</span>
                    {/* Pagination can be added later */}
                </div>
            </div>

            {/* Premium Modal */}
            {isModalOpen && (
                <div className="add-payment-overlay">
                    <div className="add-payment-modal add-bed-premium">
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span style={{ fontSize: '20px' }}>🛏️</span>
                            </div>
                            <div className="header-text">
                                <h3>{modalMode === 'add' ? 'Add New Bed Type' : 'Edit Bed Type'}</h3>
                                <span>ROOM SETUP</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            <div className="add-payment-body">
                                <div className="payment-field-group">
                                    <label className="field-label-premium">BED TYPE NAME</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="e.g. King Size, Single Bed"
                                            className="premium-input"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="payment-modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    CANCEL
                                </button>
                                <button type="submit" className="btn-primary">
                                    {modalMode === 'add' ? 'ADD BED' : 'UPDATE BED'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BedType;
