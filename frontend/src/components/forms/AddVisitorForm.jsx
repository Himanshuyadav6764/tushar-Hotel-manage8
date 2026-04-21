import { useState } from 'react';
import { sanitizeIdProofInput, validateIdProofNumber } from '../../utils/idProofValidation';

const AddVisitorForm = ({ booking, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        visitorName: '',
        mobileNumber: '',
        idProofType: 'Aadhaar',
        idProofNumber: '',
        visitPurpose: '',
        inTime: new Date().toISOString().slice(0, 16),
        outTime: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => {
            if (name === 'idProofType') {
                return {
                    ...prev,
                    idProofType: value,
                    idProofNumber: sanitizeIdProofInput(value, prev.idProofNumber)
                };
            }

            if (name === 'idProofNumber') {
                return {
                    ...prev,
                    idProofNumber: sanitizeIdProofInput(prev.idProofType, value)
                };
            }

            return { ...prev, [name]: value };
        });
        if (errors[name]) setErrors(prev => { const u = { ...prev }; delete u[name]; return u; });
        if (name === 'idProofType' && errors.idProofNumber) {
            setErrors(prev => { const u = { ...prev }; delete u.idProofNumber; return u; });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErrors = {};
        if (!formData.visitorName.trim()) newErrors.visitorName = 'Visitor name is required';
        if (!formData.mobileNumber.trim()) newErrors.mobileNumber = 'Mobile number is required';
        if (!formData.idProofNumber.trim()) newErrors.idProofNumber = 'ID number is required';
        if (formData.idProofNumber.trim()) {
            const validation = validateIdProofNumber(formData.idProofType, formData.idProofNumber);
            if (!validation.isValid) {
                newErrors.idProofNumber = validation.message;
            }
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        setIsSubmitting(true);
        try {
            await onSubmit(formData);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px', display: 'block' };
    const boxStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px' };
    const errorStyle = { color: '#d41424', fontSize: '11px', marginTop: '4px', fontWeight: '600' };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#F8FAFC', color: '#1E293B', width: '100%', boxSizing: 'border-box' }}>
            <div className="flex-1 overflow-y-auto p-6" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '16px', paddingRight: '32px' }}>

                {/* Guest Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block' }}>GUEST</span>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>{booking.guestName}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', display: 'block' }}>ROOM</span>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>{booking.roomNumber || 'N/A'}</span>
                    </div>
                </div>

                {/* Visitor Name */}
                <div>
                    <label style={labelStyle}>Visitor Name *</label>
                    <input type="text" name="visitorName" value={formData.visitorName} onChange={handleChange} placeholder="Enter visitor's full name" style={{ ...boxStyle, width: '100%', fontWeight: '700', borderColor: errors.visitorName ? '#d41424' : '#E2E8F0' }} />
                    {errors.visitorName && <div style={errorStyle}>{errors.visitorName}</div>}
                </div>

                {/* Mobile Number */}
                <div>
                    <label style={labelStyle}>Mobile Number *</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ ...boxStyle, display: 'flex', alignItems: 'center', fontWeight: '700', color: '#64748B', padding: '12px', minWidth: '60px', justifyContent: 'center' }}>+91</div>
                        <input type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange} placeholder="Enter mobile number" style={{ ...boxStyle, flex: 1, fontWeight: '700', borderColor: errors.mobileNumber ? '#d41424' : '#E2E8F0' }} />
                    </div>
                    {errors.mobileNumber && <div style={errorStyle}>{errors.mobileNumber}</div>}
                </div>

                {/* ID Proof Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                        <label style={labelStyle}>ID Type</label>
                        <select name="idProofType" value={formData.idProofType} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700', appearance: 'none', cursor: 'pointer' }}>
                            <option value="Aadhaar">Aadhaar Card</option>
                            <option value="Passport">Passport</option>
                            <option value="Driving License">Driving License</option>
                            <option value="Voter ID">Voter ID</option>
                            <option value="PAN Card">PAN Card</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>ID Number *</label>
                        <input type="text" name="idProofNumber" value={formData.idProofNumber} onChange={handleChange} placeholder="Enter ID number" style={{ ...boxStyle, width: '100%', fontWeight: '700', borderColor: errors.idProofNumber ? '#d41424' : '#E2E8F0' }} />
                        {errors.idProofNumber && <div style={errorStyle}>{errors.idProofNumber}</div>}
                    </div>
                </div>

                {/* Purpose */}
                <div>
                    <label style={labelStyle}>Purpose of Visit</label>
                    <input type="text" name="visitPurpose" value={formData.visitPurpose} onChange={handleChange} placeholder="e.g. Business meeting, Family visit..." style={{ ...boxStyle, width: '100%', fontWeight: '600' }} />
                </div>

                {/* In/Out Time */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                        <label style={labelStyle}>In Time</label>
                        <input type="datetime-local" name="inTime" value={formData.inTime} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700' }} />
                    </div>
                    <div>
                        <label style={labelStyle}>Out Time</label>
                        <input type="datetime-local" name="outTime" value={formData.outTime} onChange={handleChange} style={{ ...boxStyle, width: '100%', fontWeight: '700' }} />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 32px 20px 16px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={onCancel} style={{ flex: 1, padding: '14px', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#64748B', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #d41424, #b40f1d)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', opacity: isSubmitting ? 0.5 : 1, boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)' }}>
                    {isSubmitting ? 'Adding...' : 'Add Visitor'}
                </button>
            </div>
        </form>
    );
};

export default AddVisitorForm;
