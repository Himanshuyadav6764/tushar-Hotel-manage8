import React, { useState, useEffect } from 'react';
import './BusinessSource.css';
import API_URL, { apiCall } from '../../config/api';

const BusinessSource = () => {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [currentSource, setCurrentSource] = useState(null);
    const [formData, setFormData] = useState({ name: '' });
    const [inlineNote, setInlineNote] = useState({ show: false, title: '', message: '', tone: 'success' });
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    useEffect(() => { fetchSources(); }, []);

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

    const fetchSources = async () => {
        try {
            setLoading(true);
            const res = await apiCall(`/api/business-sources/list`);
            const data = await res.json();
            if (data.success) {
                setSources(data.data);
            } else {
                showInlineNote('Load Failed', data.message || 'Unable to fetch business sources.', 'danger');
            }
        } catch (err) {
            showInlineNote('Load Failed', 'Error fetching data', 'danger');
        }
        finally { setLoading(false); }
    };

    const handleOpenModal = (mode, source = null) => {
        setModalMode(mode);
        if (mode === 'edit' && source) {
            setCurrentSource(source);
            setFormData({ name: source.name });
        } else {
            setCurrentSource(null);
            setFormData({ name: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = modalMode === 'add' ? `${API_URL}/api/business-sources/add` : `${API_URL}/api/business-sources/update/${currentSource._id}`;
            const method = modalMode === 'add' ? 'POST' : 'PUT';
            const res = await apiCall(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setIsModalOpen(false);
                showInlineNote(modalMode === 'add' ? 'Source Added' : 'Source Updated', `${formData.name} saved successfully.`);
                fetchSources();
            } else {
                showInlineNote('Save Failed', data.message || 'Unable to save business source.', 'danger');
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
            const res = await apiCall(`/api/business-sources/delete/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showInlineNote('Source Deleted', 'Business source removed successfully.');
                fetchSources();
            } else {
                showInlineNote('Delete Failed', data.message || 'Unable to delete business source.', 'danger');
            }
        } catch (error) {
            showInlineNote('Delete Failed', 'Error deleting', 'danger');
        } finally {
            setDeleteTargetId(null);
        }
    };

    return (
        <div className="business-source-container">
            <header className="business-source-header">
                <h2>Business Source</h2>
                <button className="add-btn" onClick={() => handleOpenModal('add')}>+ Add Business Source</button>
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
                    <div className="business-table-wrapper">
                        <table className="common-table business-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Business Source</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sources.map((source, index) => (
                                    <tr key={source._id}>
                                        <td data-label="ID">{index + 1}</td>
                                        <td data-label="Business Source">{source.name}</td>
                                        <td data-label="Actions" className="business-actions-cell">
                                            <div className="action-btns" style={{ position: 'relative' }}>
                                                <button className="icon-btn edit-btn" onClick={() => handleOpenModal('edit', source)}>✏️</button>
                                                <button className="icon-btn delete-btn" onClick={() => handleDelete(source._id)}>🗑️</button>

                                                {deleteTargetId === source._id && (
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
                                                                onClick={() => confirmDelete(source._id)}
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
                    <div className="table-footer">Showing {sources.length} Business Sources</div>
                </div>
            )}

            {/* Premium Modal */}
            {isModalOpen && (
                <div className="add-payment-overlay">
                    <div className="add-payment-modal add-business-premium">
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span style={{ fontSize: '20px' }}>💼</span>
                            </div>
                            <div className="header-text">
                                <h3>{modalMode === 'add' ? 'Add Business Source' : 'Edit Business Source'}</h3>
                                <span>BUSINESS SETUP</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            <div className="add-payment-body">
                                <div className="payment-field-group">
                                    <label className="field-label-premium">BUSINESS SOURCE</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => {
                                                const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                setFormData({ ...formData, name: value });
                                            }}
                                            required
                                            placeholder="e.g. Corporate, Agency"
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
                                    {modalMode === 'add' ? 'ADD SOURCE' : 'UPDATE SOURCE'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default BusinessSource;
