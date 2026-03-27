import React, { useState, useEffect } from 'react';
import './ComplimentaryService.css';
import API_URL, { apiCall } from '../../config/api';

const ComplimentaryService = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [currentService, setCurrentService] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: 'Food & Beverage',
        linkedWith: '',
        quantityLimit: ''
    });
    const [inlineNote, setInlineNote] = useState({ show: false, title: '', message: '', tone: 'success' });
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    useEffect(() => { fetchServices(); }, []);

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

    const fetchServices = async () => {
        try {
            setLoading(true);
            const res = await apiCall(`/api/complimentary-services/list`);
            const data = await res.json();
            if (data.success) {
                setServices(data.data);
            } else {
                showInlineNote('Load Failed', data.message || 'Unable to fetch services.', 'danger');
            }
        } catch (err) {
            showInlineNote('Load Failed', 'Error fetching data', 'danger');
        }
        finally { setLoading(false); }
    };

    const handleOpenModal = (mode, service = null) => {
        setModalMode(mode);
        if (mode === 'edit' && service) {
            setCurrentService(service);
            setFormData({
                name: service.name,
                category: service.category,
                linkedWith: service.linkedWith,
                quantityLimit: service.quantityLimit
            });
        } else {
            setCurrentService(null);
            setFormData({ name: '', category: 'Food & Beverage', linkedWith: '', quantityLimit: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = modalMode === 'add' ? `${API_URL}/api/complimentary-services/add` : `${API_URL}/api/complimentary-services/update/${currentService._id}`;
            const method = modalMode === 'add' ? 'POST' : 'PUT';
            const res = await apiCall(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setIsModalOpen(false);
                showInlineNote(modalMode === 'add' ? 'Service Added' : 'Service Updated', `${formData.name} saved successfully.`);
                fetchServices();
            } else {
                showInlineNote('Save Failed', data.message || 'Unable to save service.', 'danger');
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
            const res = await apiCall(`/api/complimentary-services/delete/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showInlineNote('Service Deleted', 'Complimentary service removed successfully.');
                fetchServices();
            } else {
                showInlineNote('Delete Failed', data.message || 'Unable to delete service.', 'danger');
            }
        } catch (error) {
            showInlineNote('Delete Failed', 'Error deleting', 'danger');
        } finally {
            setDeleteTargetId(null);
        }
    };

    return (
        <div className="complimentary-service-container">
            <header className="complimentary-service-header">
                <h2>Complimentary Services</h2>
                <button className="add-btn" onClick={() => handleOpenModal('add')}>+ Add Complimentary Service</button>
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
                    <div className="service-table-wrapper">
                        <table className="common-table service-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Service Name</th>
                                    <th>Category</th>
                                    <th>Linked With</th>
                                    <th>Quantity Limit</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {services.map((service, index) => {
                                    const quantityValue = String(service.quantityLimit || '').toLowerCase();
                                    const quantityBadgeClass = quantityValue === 'unlimited' ? 'green unlimited' : 'gray limited';

                                    return (
                                        <tr key={service._id}>
                                            <td data-label="ID">{index + 1}</td>
                                            <td data-label="Service">{service.name}</td>
                                            <td data-label="Category">
                                                <span className="badge blue">{service.category}</span>
                                            </td>
                                            <td data-label="Linked With">
                                                <span className="badge gray">{service.linkedWith}</span>
                                            </td>
                                            <td data-label="Quantity">
                                                <span className={`badge ${quantityBadgeClass}`}>{service.quantityLimit}</span>
                                            </td>
                                            <td data-label="Actions" className="service-actions-cell">
                                                <div className="action-btns" style={{ position: 'relative' }}>
                                                    <button className="icon-btn edit-btn" onClick={() => handleOpenModal('edit', service)}>✏️</button>
                                                    <button className="icon-btn delete-btn" onClick={() => handleDelete(service._id)}>🗑️</button>

                                                    {deleteTargetId === service._id && (
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
                                                                    onClick={() => confirmDelete(service._id)}
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
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-footer">Showing {services.length} Complimentary Services</div>
                </div>
            )}

            {/* Premium Modal */}
            {isModalOpen && (
                <div className="add-payment-overlay">
                    <div className="add-payment-modal add-service-premium">
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span style={{ fontSize: '20px' }}>🌟</span>
                            </div>
                            <div className="header-text">
                                <h3>{modalMode === 'add' ? 'Add Service' : 'Edit Service'}</h3>
                                <span>SERVICE SETUP</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            <div className="add-payment-body">
                                <div className="payment-field-group">
                                    <label className="field-label-premium">SERVICE NAME</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => {
                                                const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                setFormData({ ...formData, name: value });
                                            }}
                                            required
                                            placeholder="e.g. Breakfest, WiFi"
                                            className="premium-input"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">CATEGORY</label>
                                    <div className="premium-input-wrap">
                                        <select
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            className="premium-input"
                                        >
                                            <option value="Food & Beverage">Food & Beverage</option>
                                            <option value="Facility">Facility</option>
                                            <option value="Room Service">Room Service</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">LINKED WITH</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.linkedWith}
                                            onChange={e => {
                                                const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                setFormData({ ...formData, linkedWith: value });
                                            }}
                                            required
                                            placeholder="e.g. All Guests, CP"
                                            className="premium-input"
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">QUANTITY LIMIT</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.quantityLimit}
                                            onChange={e => {
                                                const value = e.target.value.replace(/\D/g, '');
                                                setFormData({ ...formData, quantityLimit: value });
                                            }}
                                            required
                                            placeholder="e.g. 1 per Stay"
                                            className="premium-input"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="payment-modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    CANCEL
                                </button>
                                <button type="submit" className="btn-primary">
                                    {modalMode === 'add' ? 'ADD SERVICE' : 'UPDATE SERVICE'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ComplimentaryService;
