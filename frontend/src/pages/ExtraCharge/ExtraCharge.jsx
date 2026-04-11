import React, { useState, useEffect } from 'react';
import './ExtraCharge.css';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';

const ExtraCharge = () => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [charges, setCharges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [currentCharge, setCurrentCharge] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        chargeType: 'Fixed',
        amount: '',
        taxApplicable: true
    });
    const [inlineNote, setInlineNote] = useState({ show: false, title: '', message: '', tone: 'success' });
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    useEffect(() => { fetchCharges(); }, []);

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

    const fetchCharges = async () => {
        try {
            setLoading(true);
            const res = await apiCall(`/api/extra-charges/list`);
            const data = await res.json();
            if (data.success) {
                setCharges(data.data);
            } else {
                showInlineNote('Load Failed', data.message || 'Unable to fetch extra charges.', 'danger');
            }
        } catch (err) {
            showInlineNote('Load Failed', 'Error fetching data', 'danger');
        }
        finally { setLoading(false); }
    };

    const handleOpenModal = (mode, charge = null) => {
        setModalMode(mode);
        if (mode === 'edit' && charge) {
            setCurrentCharge(charge);
            setFormData({
                name: charge.name,
                chargeType: charge.chargeType,
                amount: charge.amount,
                taxApplicable: charge.taxApplicable
            });
        } else {
            setCurrentCharge(null);
            setFormData({ name: '', chargeType: 'Fixed', amount: '', taxApplicable: true });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = modalMode === 'add' ? `${API_URL}/api/extra-charges/add` : `${API_URL}/api/extra-charges/update/${currentCharge._id}`;
            const method = modalMode === 'add' ? 'POST' : 'PUT';
            const res = await apiCall(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setIsModalOpen(false);
                showInlineNote(modalMode === 'add' ? 'Charge Added' : 'Charge Updated', `${formData.name} saved successfully.`);
                fetchCharges();
            } else {
                showInlineNote('Save Failed', data.message || 'Unable to save extra charge.', 'danger');
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
            const res = await apiCall(`/api/extra-charges/delete/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showInlineNote('Charge Deleted', 'Extra charge removed successfully.');
                fetchCharges();
            } else {
                showInlineNote('Delete Failed', data.message || 'Unable to delete extra charge.', 'danger');
            }
        } catch (error) {
            showInlineNote('Delete Failed', 'Error deleting', 'danger');
        } finally {
            setDeleteTargetId(null);
        }
    };

    return (
        <div className="extra-charge-container">
            <header className="extra-charge-header">
                <h2>Extra Charges</h2>
                <button className="add-btn" onClick={() => handleOpenModal('add')}>+ Add Extra Charge</button>
            </header>

            {inlineNote.show && (
                <div
                    style={{
                        marginBottom: '14px',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        border: `1px solid ${inlineNote.tone === 'danger' ? '#fecaca' : '#dcfce7'}`,
                        background: inlineNote.tone === 'danger' ? '#fef2f2' : '#f0fdf4',
                        color: inlineNote.tone === 'danger' ? '#b40f1d' : '#14532d',
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
                    <div className="extra-table-wrapper">
                        <table className="common-table extra-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Charge Name</th>
                                    <th>Charge Type</th>
                                    <th>Amount</th>
                                    <th>Tax Applicable</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {charges.map((charge, index) => (
                                    <tr key={charge._id}>
                                        <td data-label="ID">{index + 1}</td>
                                        <td data-label="Charge Name">{charge.name}</td>
                                        <td data-label="Charge Type">{charge.chargeType}</td>
                                        <td data-label="Amount" className="amount-cell">{cs} {charge.amount}</td>
                                        <td data-label="Tax Applicable">
                                            <span className={`badge gst ${charge.taxApplicable ? 'active' : 'inactive'}`}>
                                                {charge.taxApplicable ? 'GST' : 'No GST'}
                                            </span>
                                        </td>
                                        <td data-label="Actions" className="extra-actions-cell">
                                            <div className="action-btns" style={{ position: 'relative' }}>
                                                <button className="icon-btn edit-btn" onClick={() => handleOpenModal('edit', charge)}>✏️</button>
                                                <button className="icon-btn delete-btn" onClick={() => handleDelete(charge._id)}>🗑️</button>

                                                {deleteTargetId === charge._id && (
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
                                                        <div style={{ color: '#b40f1d', fontWeight: 700, fontSize: '0.8rem', marginBottom: '8px' }}>
                                                            Are you sure want to delete?
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmDelete(charge._id)}
                                                                style={{ flex: 1, border: 'none', borderRadius: '6px', background: '#d41424', color: '#fff', padding: '6px 8px', fontWeight: 700, cursor: 'pointer' }}
                                                            >
                                                                Yes
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeleteTargetId(null)}
                                                                style={{ flex: 1, border: '1px solid #fca5a5', borderRadius: '6px', background: '#fff', color: '#b40f1d', padding: '6px 8px', fontWeight: 700, cursor: 'pointer' }}
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
                    <div className="table-footer">Showing {charges.length} Extra Charges</div>
                </div>
            )}

            {/* Premium Modal */}
            {isModalOpen && (
                <div className="add-payment-overlay">
                    <div className="add-payment-modal add-charge-premium">
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span style={{ fontSize: '20px' }}>💰</span>
                            </div>
                            <div className="header-text">
                                <h3>{modalMode === 'add' ? 'Add Charge' : 'Edit Charge'}</h3>
                                <span>BILLING SETUP</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            <div className="add-payment-body">
                                <div className="payment-field-group">
                                    <label className="field-label-premium">CHARGE NAME</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => {
                                                const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                setFormData({ ...formData, name: value });
                                            }}
                                            required
                                            placeholder="e.g. Service Charge, Extra Bed"
                                            className="premium-input"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">CHARGE TYPE</label>
                                    <div className="premium-input-wrap">
                                        <select
                                            value={formData.chargeType}
                                            onChange={e => setFormData({ ...formData, chargeType: e.target.value })}
                                            className="premium-input"
                                        >
                                            <option value="Fixed">Fixed</option>
                                            <option value="Per Night">Per Night</option>
                                            <option value="Per Item">Per Item</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">AMOUNT ({cs})</label>
                                    <div className="premium-input-wrap">
                                        <input
                                            type="number"
                                            value={formData.amount}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === '' || Number(val) >= 0) {
                                                    setFormData({ ...formData, amount: val });
                                                }
                                            }}
                                            min="0"
                                            placeholder="0.00"
                                            required
                                            className="premium-input"
                                        />
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">TAX CONFIGURATION</label>
                                    <div
                                        className={`modern-checkbox-card ${formData.taxApplicable ? 'active' : ''}`}
                                        onClick={() => setFormData({ ...formData, taxApplicable: !formData.taxApplicable })}
                                    >
                                        <div className="checkbox-card-info">
                                            <span className="checkbox-card-title">Tax Applicable (GST)</span>
                                            <span className="checkbox-card-sub">Enable GST calculation for this charge</span>
                                        </div>
                                        <div className={`checkbox-custom-wrap ${formData.taxApplicable ? 'checked' : ''}`}>
                                            {formData.taxApplicable && <span className="check-icon">✓</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="payment-modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    CANCEL
                                </button>
                                <button type="submit" className="btn-primary">
                                    {modalMode === 'add' ? 'ADD CHARGE' : 'UPDATE CHARGE'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ExtraCharge;
