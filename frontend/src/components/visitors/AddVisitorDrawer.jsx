import React, { useState } from 'react';
import Drawer from '../Drawer';
import Toast from '../Toast';
import { User } from 'lucide-react';
import { addVisitor } from '../../services/visitorService';
import { sanitizeIdProofInput, validateIdProofNumber } from '../../utils/idProofValidation';
import './AddVisitorDrawer.css';

const AddVisitorDrawer = ({ isOpen, onClose, reservationId, booking, onVisitorAdded }) => {
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        idType: 'Aadhaar',
        idNumber: '',
        inTime: new Date().toISOString().slice(0, 16), // Default to now
        outTime: ''
    });
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: name === 'idNumber'
                ? sanitizeIdProofInput(prev.idType, value)
                : value,
            ...(name === 'idType' ? { idNumber: sanitizeIdProofInput(value, prev.idNumber) } : {})
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.mobile.trim()) {
            setToast({ message: 'Name and Mobile are required', type: 'error' });
            return;
        }

        if (!formData.idNumber.trim()) {
            setToast({ message: 'ID number is required', type: 'error' });
            return;
        }

        const idValidation = validateIdProofNumber(formData.idType, formData.idNumber);
        if (!idValidation.isValid) {
            setToast({ message: idValidation.message, type: 'error' });
            return;
        }

        setLoading(true);
        try {
            console.log('SENDING VISITOR DATA:', {
                ...formData,
                reservationId,
                purpose: 'Visitor',
                chargeAmount: 0
            });

            await addVisitor({
                ...formData,
                reservationId,
                purpose: 'Visitor', // Default purpose
                chargeAmount: 0     // Default charge
            });

            setToast({ message: 'Visitor added successfully', type: 'success' });

            // Allow parent to refresh data
            if (onVisitorAdded) {
                onVisitorAdded();
            }

            // Reset form
            setFormData({
                name: '',
                mobile: '',
                idType: 'Aadhaar',
                idNumber: '',
                inTime: new Date().toISOString().slice(0, 16),
                outTime: ''
            });

            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (error) {
            console.error('ADD VISITOR ERROR:', error);
            // Check for specific error message structure
            const msg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to add visitor';
            setToast({ message: msg, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Drawer
                isOpen={isOpen}
                onClose={onClose}
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={20} />
                        <span>Add Visitor</span>
                    </div>
                }
                subtitle="PROCESS REQUEST"
                icon="⚙"
                height="premium"
            >
                <div className="add-visitor-shell">
                    <form onSubmit={handleSubmit} className="add-visitor-form">
                        <div className="add-visitor-card">
                            <div className="visitor-field-group">
                                <label className="visitor-label">Visitor Name:</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter visitor's name"
                                    className="visitor-input"
                                />
                            </div>

                            <div className="visitor-field-group">
                                <label className="visitor-label">Mobile Number</label>
                                <div className="visitor-mobile-row">
                                    <div className="visitor-country-code">
                                        +91
                                        <span className="visitor-country-arrow">▼</span>
                                    </div>
                                    <input
                                        type="tel"
                                        name="mobile"
                                        value={formData.mobile}
                                        onChange={handleChange}
                                        placeholder="Enter mobile number"
                                        maxLength="10"
                                        className="visitor-input"
                                    />
                                </div>
                            </div>

                            <div className="visitor-field-group">
                                <label className="visitor-label">ID Type:</label>
                                <div className="visitor-select-wrap">
                                    <select
                                        name="idType"
                                        value={formData.idType}
                                        onChange={handleChange}
                                        className="visitor-input visitor-select"
                                    >
                                        <option value="Aadhaar">Aadhaar Card</option>
                                        <option value="Passport">Passport</option>
                                        <option value="Driving License">Driving License</option>
                                        <option value="Voter ID">Voter ID</option>
                                        <option value="PAN Card">PAN Card</option>
                                    </select>
                                    <span className="visitor-select-arrow">›</span>
                                </div>
                            </div>

                            <div className="visitor-field-group">
                                <label className="visitor-label">ID Number:</label>
                                <input
                                    type="text"
                                    name="idNumber"
                                    value={formData.idNumber}
                                    onChange={handleChange}
                                    placeholder="Enter ID number"
                                    className="visitor-input"
                                />
                            </div>

                            <div className="visitor-field-group">
                                <label className="visitor-label">In Time:</label>
                                <input
                                    type="datetime-local"
                                    name="inTime"
                                    value={formData.inTime}
                                    onChange={handleChange}
                                    className="visitor-input"
                                />
                            </div>

                            <div className="visitor-field-group">
                                <label className="visitor-label">Out Time:</label>
                                <input
                                    type="datetime-local"
                                    name="outTime"
                                    value={formData.outTime}
                                    onChange={handleChange}
                                    className="visitor-input"
                                />
                            </div>
                        </div>

                        <div className="visitor-footer-note">
                            <span className="visitor-note-id">Reservation ID: {reservationId?.substring(0, 16)}...</span>
                            <span>Room Num: <b>{booking?.roomNumber || 'N/A'}</b></span>
                        </div>

                        <div className="visitor-actions">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="visitor-btn visitor-btn-cancel"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="visitor-btn visitor-btn-save"
                            >
                                {loading ? 'Saving...' : 'Save Visitor'}
                            </button>
                        </div>
                    </form>
                </div>
            </Drawer>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
};

export default AddVisitorDrawer;
