import React, { useState, useEffect } from 'react';
import './CustomerIdentity.css';
import API_URL, { apiCall } from '../../config/api';

const CustomerIdentity = () => {
    const [identities, setIdentities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [currentIdentity, setCurrentIdentity] = useState(null);
    const [formData, setFormData] = useState({ name: '', requiredByLaw: false, usedForReservations: false });
    const [inlineNote, setInlineNote] = useState({ show: false, title: '', message: '', tone: 'success' });
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    useEffect(() => { fetchIdentities(); }, []);

    useEffect(() => {
        if (!inlineNote.show) return;
        const timer = setTimeout(() => {
            setInlineNote(prev => ({ ...prev, show: false }));
        }, 2600);
        return () => clearTimeout(timer);
    }, [inlineNote.show]);

    const showInlineNote = (title, message, tone = 'success') => {
        setInlineNote({ show: true, title, message, tone });
    };

    const fetchIdentities = async () => {
        try {
            setLoading(true);
            const res = await apiCall(`/api/customer-identities/list`);
            const data = await res.json();
            if (data.success) {
                setIdentities(data.data);
            } else {
                showInlineNote('Load Failed', data.message || 'Unable to fetch identity types.', 'danger');
            }
        } catch (err) {
            showInlineNote('Load Failed', 'Error fetching data', 'danger');
        }
        finally { setLoading(false); }
    };

    const handleOpenModal = (mode, identity = null) => {
        setModalMode(mode);
        if (mode === 'edit' && identity) {
            setCurrentIdentity(identity);
            setFormData({
                name: identity.name,
                requiredByLaw: identity.requiredByLaw,
                usedForReservations: identity.usedForReservations
            });
        } else {
            setCurrentIdentity(null);
            setFormData({ name: '', requiredByLaw: false, usedForReservations: false });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = modalMode === 'add' ? `${API_URL}/api/customer-identities/add` : `${API_URL}/api/customer-identities/update/${currentIdentity._id}`;
            const method = modalMode === 'add' ? 'POST' : 'PUT';
            const res = await apiCall(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setIsModalOpen(false);
                showInlineNote(modalMode === 'add' ? 'Identity Added' : 'Identity Updated', `${formData.name} saved successfully.`);
                fetchIdentities();
            } else {
                showInlineNote('Save Failed', data.message || 'Unable to save identity type.', 'danger');
            }
        } catch (error) {
            showInlineNote('Save Failed', 'Error submitting', 'danger');
        }
    };

    const handleDelete = (id) => {
        setDeleteTargetId(id);
    };

    const confirmDelete = async (id) => {
        try {
            const res = await apiCall(`/api/customer-identities/delete/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showInlineNote('Identity Deleted', 'Identity type removed successfully.');
                fetchIdentities();
            } else {
                showInlineNote('Delete Failed', data.message || 'Unable to delete identity type.', 'danger');
            }
        } catch (error) {
            showInlineNote('Delete Failed', 'Error deleting', 'danger');
        } finally {
            setDeleteTargetId(null);
        }
    };

    return (
        <div className="customer-identity-container">
            <header className="customer-identity-header">
                <h2>Customer Identity</h2>
                <button className="add-btn" onClick={() => handleOpenModal('add')}>+ Add ID Type</button>
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

            {loading ? <div>Loading...</div> : (
                <div className="table-container">
                    <div className="identity-table-wrapper">
                        <table className="common-table identity-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Identity Type</th>
                                <th>Required by Law?</th>
                                <th>Used for Reservations?</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {identities.map((item, index) => (
                                <tr key={item._id}>
                                    <td data-label="ID">{index + 1}</td>
                                    <td data-label="Identity Type">{item.name}</td>
                                    <td data-label="Required" className="identity-status-cell">
                                        <div className="checkbox-display desktop-checkbox">
                                            <input type="checkbox" checked={item.requiredByLaw} readOnly />
                                        </div>
                                        <span className={`status-badge mobile-badge ${item.requiredByLaw ? 'yes' : 'no'}`}>
                                            {item.requiredByLaw ? '✔ Yes' : '❌ No'}
                                        </span>
                                    </td>
                                    <td data-label="Reservation" className="identity-status-cell">
                                        <div className="checkbox-display desktop-checkbox">
                                            <input type="checkbox" checked={item.usedForReservations} readOnly />
                                        </div>
                                        <span className={`status-badge mobile-badge ${item.usedForReservations ? 'yes' : 'no'}`}>
                                            {item.usedForReservations ? '✔ Yes' : '❌ No'}
                                        </span>
                                    </td>
                                    <td data-label="Actions" className="text-right identity-actions-cell">
                                        <div className="action-btns" style={{ position: 'relative' }}>
                                            <button className="icon-btn edit-btn" onClick={() => handleOpenModal('edit', item)}>✏️</button>
                                            <button className="icon-btn delete-btn" onClick={() => handleDelete(item._id)}>🗑️</button>

                                            {deleteTargetId === item._id && (
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
                                                            onClick={() => confirmDelete(item._id)}
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
                    <div className="table-footer">Showing {identities.length} Identity Types</div>
                </div>
            )}

            {/* Premium Modal */}
            {isModalOpen && (
                <div className="add-payment-overlay">
                    <div className="add-payment-modal add-id-premium">
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span style={{ fontSize: '20px' }}>🆔</span>
                            </div>
                            <div className="header-text">
                                <h3>{modalMode === 'add' ? 'Add ID Type' : 'Edit ID Type'}</h3>
                                <span>IDENTITY SETUP</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            <div className="add-payment-body">
                                <div className="payment-field-group">
                                    <label className="field-label-premium">IDENTITY TYPE</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => {
                                                const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                setFormData({ ...formData, name: value });
                                            }}
                                            required
                                            placeholder="e.g. Aadhaar, Passport, Driving License"
                                            className="premium-input"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">LAW & REGULATIONS</label>
                                    <div 
                                        className={`modern-checkbox-card ${formData.requiredByLaw ? 'active' : ''}`}
                                        onClick={() => setFormData({ ...formData, requiredByLaw: !formData.requiredByLaw })}
                                    >
                                        <div className="checkbox-card-info">
                                            <span className="checkbox-card-title">Required by Law?</span>
                                            <span className="checkbox-card-sub">This ID is mandatory for check-in</span>
                                        </div>
                                        <div className={`checkbox-custom-wrap ${formData.requiredByLaw ? 'checked' : ''}`}>
                                            {formData.requiredByLaw && <span className="check-icon">✓</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">RESERVATION SETTINGS</label>
                                    <div 
                                        className={`modern-checkbox-card ${formData.usedForReservations ? 'active' : ''}`}
                                        onClick={() => setFormData({ ...formData, usedForReservations: !formData.usedForReservations })}
                                    >
                                        <div className="checkbox-card-info">
                                            <span className="checkbox-card-title">Used for Reservations?</span>
                                            <span className="checkbox-card-sub">Allow this ID for making reservations</span>
                                        </div>
                                        <div className={`checkbox-custom-wrap ${formData.usedForReservations ? 'checked' : ''}`}>
                                            {formData.usedForReservations && <span className="check-icon">✓</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="payment-modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    CANCEL
                                </button>
                                <button type="submit" className="btn-primary">
                                    {modalMode === 'add' ? 'ADD ID TYPE' : 'UPDATE ID TYPE'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default CustomerIdentity;
