import React, { useState, useEffect } from 'react';
import './FloorSetup.css';
import API_URL, { apiCall } from '../../config/api';

const FloorSetup = () => {
    const [floors, setFloors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [currentFloor, setCurrentFloor] = useState(null);
    const [formData, setFormData] = useState({ name: '', roomCount: '' });
    const [inlineNote, setInlineNote] = useState({ show: false, title: '', message: '', tone: 'success' });
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    useEffect(() => {
        fetchFloors();
    }, []);

    useEffect(() => {
        if (!inlineNote.show) return;
        const timer = setTimeout(() => {
            setInlineNote(prev => ({ ...prev, show: false }));
        }, 2600);
        return () => clearTimeout(timer);
    }, [inlineNote.show]);

    const fetchFloors = async () => {
        try {
            setLoading(true);
            const response = await apiCall(`/api/floors/list`);
            const data = await response.json();
            if (data.success) {
                setFloors(data.data);
            } else {
                setError('Failed to fetch floors');
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

    const handleOpenModal = (mode, floor = null) => {
        setModalMode(mode);
        if (mode === 'edit' && floor) {
            setCurrentFloor(floor);
            setFormData({
                name: floor.name,
                roomCount: floor.roomCount || ''
            });
        } else {
            setCurrentFloor(null);
            setFormData({ name: '', roomCount: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            name: formData.name,
            roomCount: Number(formData.roomCount) || 0
        };

        try {
            let response;
            if (modalMode === 'add') {
                response = await apiCall(`/api/floors/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await apiCall(`/api/floors/update/${currentFloor._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await response.json();
            if (data.success) {
                setIsModalOpen(false);
                showInlineNote(modalMode === 'add' ? 'Floor Added' : 'Floor Updated', `${payload.name} saved successfully.`);
                fetchFloors();
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
            const response = await apiCall(`/api/floors/delete/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                showInlineNote('Floor Deleted', 'Floor removed successfully.');
                fetchFloors();
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
        <div className="floor-setup-container">
            <header className="floor-setup-header">
                <h2>Floor Setup</h2>
                <button className="add-floor-btn" onClick={() => handleOpenModal('add')}>+ Add Floor</button>
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

            <div className="floor-table-container">
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
                ) : (
                    <div className="floor-table-wrapper">
                        <table className="floor-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>ID</th>
                                    <th>Floor Name</th>
                                    <th>Room Count</th>
                                    <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {floors.map((floor, index) => (
                                    <tr key={floor._id}>
                                        <td data-label="ID">{index + 1}</td>
                                        <td data-label="Floor Name">{floor.name}</td>
                                        <td data-label="Room Count">{floor.roomCount || 0}</td>
                                        <td data-label="Actions" className="floor-actions-cell">
                                            <div className="action-btns" style={{ justifyContent: 'flex-end', position: 'relative' }}>
                                                <button className="icon-button" onClick={() => handleOpenModal('edit', floor)}>✏️</button>
                                                <button className="icon-button" onClick={() => handleDelete(floor._id)}>🗑️</button>

                                                {deleteTargetId === floor._id && (
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
                                                                onClick={() => confirmDelete(floor._id)}
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
                    </div>
                )}
                <div className="table-footer">
                    <span>Showing {floors.length} Floors</span>
                </div>
            </div>

            {/* Premium Modal */}
            {isModalOpen && (
                <div className="add-payment-overlay">
                    <div className="add-payment-modal add-floor-premium">
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span style={{ fontSize: '20px' }}>🏢</span>
                            </div>
                            <div className="header-text">
                                <h3>{modalMode === 'add' ? 'Add New Floor' : 'Edit Floor'}</h3>
                                <span>FLOOR MANAGEMENT</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            <div className="add-payment-body">
                                <div className="payment-field-group">
                                    <label className="field-label-premium">FLOOR NAME</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (/^[a-zA-Z\s]*$/.test(val)) {
                                                    setFormData({ ...formData, name: val });
                                                }
                                            }}
                                            required
                                            placeholder="e.g. Ground Floor"
                                            className="premium-input"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">ROOM COUNT</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="number"
                                            value={formData.roomCount}
                                            onChange={(e) => setFormData({ ...formData, roomCount: e.target.value })}
                                            required
                                            placeholder="e.g. 10"
                                            className="premium-input"
                                            min="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="payment-modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    CANCEL
                                </button>
                                <button type="submit" className="btn-primary">
                                    {modalMode === 'add' ? 'ADD FLOOR' : 'UPDATE FLOOR'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FloorSetup;
