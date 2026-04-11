import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ReservationDetailsView.css';
import { useSettings } from '../context/SettingsContext';
import AddPayment from './AddPayment';

const ReservationDetailsView = ({ reservation, onClose, onUpdate }) => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('roomCharges');
    const [showPrintMenu, setShowPrintMenu] = useState(false);
    const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

    const handlePrintAction = (action) => {
        setShowPrintMenu(false);
        // Trigger the action via onUpdate
        // Assuming onUpdate can handle action requests
        if (onUpdate) {
            onUpdate({ type: 'OPEN_ACTION', action, reservation });
        } else {
            console.warn('onUpdate prop is missing in ReservationDetailsView');
        }
    };
    const [charges, setCharges] = useState([
        {
            id: 1,
            day: '03-02-2026 Tue',
            particulars: 'Room Tariff',
            description: `Room Charges: 2000.0 for 03-02-2026 Room No ${reservation?.roomNumber || '102'}`,
            amount: 2000,
            user: 'superadmin#7729080895'
        }
    ]);

    const tabs = [
        { id: 'folioOperations', label: 'Folio Operations' },
        { id: 'bookingDetails', label: 'Booking Details' },
        { id: 'guestDetails', label: 'Guest Details' },
        { id: 'roomCharges', label: 'Room Charges' },
        { id: 'auditTrail', label: 'Audit Trail' }
    ];

    const handleAddPayment = () => {
        setShowAddPaymentModal(true);
    };

    const handleAddCharges = () => {
        // Add charges logic
        alert('Add Charges functionality');
    };

    const handleApplyDiscount = () => {
        // Apply discount logic
        alert('Apply Discount functionality');
    };

    const calculateTotals = () => {
        const subTotal = charges.reduce((sum, charge) => sum + charge.amount, 0);
        const grandTotal = subTotal;
        const balance = grandTotal;

        return { subTotal, grandTotal, balance, paid: 0 };
    };

    const totals = calculateTotals();

    return (
        <div className="reservation-details-overlay">
            <div className="reservation-details-container">
                {/* Header */}
                <div className="reservation-header">
                    <div className="header-left">
                        <button className="back-btn" onClick={onClose}>
                            ← Back
                        </button>
                        <h2 className="guest-name">
                            👤 {reservation?.guestName || 'Mr. Shahrukh Ahmed'}
                        </h2>
                    </div>
                    <div className="header-actions relative">
                        <div className="relative">
                            <button
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 16px', background: 'linear-gradient(135deg, #E31E24 0%, #b40f1d 100%)',
                                    color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700',
                                    fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(220,38,38,0.3)'
                                }}
                                onClick={() => setShowPrintMenu(!showPrintMenu)}
                            >
                                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                Print / Send
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {showPrintMenu && (
                                <div style={{
                                    position:'absolute', right:0, top:'calc(100% + 6px)',
                                    background:'#fff', borderRadius:'12px', boxShadow:'0 10px 40px rgba(0,0,0,0.15)',
                                    border:'1px solid #f1f5f9', zIndex:50, minWidth:'200px', overflow:'hidden', padding:'6px'
                                }}>
                                    {[
                                        { action: 'print-summary', icon: '📄', label: 'Print Summary', color: '#2563eb' },
                                        { action: 'print-invoice', icon: '🧾', label: 'Print Invoice', color: '#16a34a' },
                                        { action: 'print-grc', icon: '📋', label: 'Print GRC', color: '#9333ea' },
                                        { action: 'print-grc-all', icon: '🗂️', label: 'Print GRC All', color: '#b45309' },
                                    ].map((item) => (
                                        <button key={item.action}
                                            style={{
                                                display:'flex', alignItems:'center', gap:'10px',
                                                width:'100%', padding:'10px 12px', border:'none',
                                                background:'transparent', cursor:'pointer', borderRadius:'8px',
                                                fontSize:'13px', fontWeight:'600', color:'#374151',
                                                transition:'background 0.15s', textAlign:'left'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                                            onMouseLeave={e => e.currentTarget.style.background='transparent'}
                                            onClick={() => handlePrintAction(item.action)}
                                        >
                                            <span style={{
                                                width:'28px', height:'28px', borderRadius:'8px',
                                                background:`${item.color}15`, display:'flex',
                                                alignItems:'center', justifyContent:'center', fontSize:'14px', flexShrink:0
                                            }}>{item.icon}</span>
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button className="close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* Booking Info Bar */}
                <div className="booking-info-bar">
                    <div className="info-item">
                        <label>Booking Date</label>
                        <div className="info-value">
                            {reservation?.checkInDate ?
                                new Date(reservation.checkInDate).toLocaleDateString('en-GB') + ' ' +
                                new Date(reservation.checkInDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                : '03-02-2026 01:32 PM'}
                        </div>
                    </div>
                    <div className="info-item">
                        <label>Arrival</label>
                        <div className="info-value">
                            {reservation?.checkInDate ?
                                new Date(reservation.checkInDate).toLocaleDateString('en-GB') + ' ' +
                                new Date(reservation.checkInDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                : '03-02-2026 01:28 PM'}
                        </div>
                    </div>
                    <div className="info-item">
                        <label>Departure</label>
                        <div className="info-value">
                            {reservation?.checkOutDate ?
                                new Date(reservation.checkOutDate).toLocaleDateString('en-GB') + ' 12:00 PM'
                                : '04-02-2026 12:00 PM'}
                        </div>
                    </div>
                    <div className="info-item">
                        <label>Nights</label>
                        <div className="info-value">1</div>
                    </div>
                    <div className="info-item">
                        <label>Room / Room Type</label>
                        <div className="info-value">
                            {reservation?.roomNumber || '102'} - {reservation?.roomType || 'Deluxe'}
                            {/* PHASE 3 UPGRADE: Display enterprise room details */}
                            {(reservation?.roomViewType || reservation?.smokingPolicy || reservation?.roomSize) && (
                                <span className="room-details-extra">
                                    {reservation?.roomViewType && ` | ${reservation.roomViewType}`}
                                    {reservation?.smokingPolicy && ` | ${reservation.smokingPolicy}`}
                                    {reservation?.roomSize > 0 && ` | ${reservation.roomSize} sq ft`}
                                    {reservation?.isSmartRoom && ' ⚡'}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="info-item">
                        <label>Reservation No</label>
                        <div className="info-value">{reservation?.bookingId || '51'}</div>
                    </div>
                    <div className="info-item">
                        <label>Reservation Status</label>
                        <div className="status-badge confirmed">CONFIRMED</div>
                    </div>
                    <div className="info-item">
                        <button className="checkout-btn">Checkout</button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="content-area">
                    {/* Sidebar */}
                    <div className="sidebar">
                        <div className="room-folio-section">
                            <div className="folio-header">Room / Folio</div>
                            <div className="folio-card selected">
                                <div className="room-number">{reservation?.roomNumber || '102'}</div>
                                <div className="guest-info">
                                    <div className="guest-icon">👤</div>
                                    <span>{reservation?.guestName || 'Mr. Shahrukh Ahmed'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="main-content">
                        {/* Tabs */}
                        <div className="tabs-container">
                            <div className="tabs">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="tab-actions">
                                <button className="tab-action-btn" onClick={handleAddPayment}>
                                    Add Payment
                                </button>
                                <button className="tab-action-btn" onClick={handleAddCharges}>
                                    Add Charges
                                </button>
                                <button className="tab-action-btn" onClick={handleApplyDiscount}>
                                    Apply Discount
                                </button>
                                <button className="tab-action-btn">Folio Operations</button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="tab-content">
                            {activeTab === 'roomCharges' && (
                                <div className="room-charges-content">
                                    <div className="charges-filters">
                                        <div className="filter-buttons">
                                            <button className="filter-btn">📋 Unposted</button>
                                            <button className="filter-btn active">✅ Posted</button>
                                            <button className="filter-btn">📝 All</button>
                                            <button className="filter-btn">📞 Contact</button>
                                            <button className="filter-btn">📧 Email</button>
                                        </div>
                                    </div>

                                    <table className="charges-table">
                                        <thead>
                                            <tr>
                                                <th>Day</th>
                                                <th>Particulars</th>
                                                <th>Description</th>
                                                <th>Amount</th>
                                                <th>User</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {charges.map(charge => (
                                                <tr key={charge.id}>
                                                    <td>{charge.day}</td>
                                                    <td>{charge.particulars}</td>
                                                    <td>{charge.description}</td>
                                                    <td>{cs} {charge.amount}</td>
                                                    <td>{charge.user}</td>
                                                    <td>
                                                        <button className="action-icon-btn">⋮</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeTab === 'bookingDetails' && (
                                <div className="booking-details-content">
                                    <h3>Booking Information</h3>
                                    <div className="details-grid">
                                        <div className="detail-item">
                                            <label>Booking ID:</label>
                                            <span>{reservation?.bookingId || 'BKG123456'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Guest Name:</label>
                                            <span>{reservation?.guestName || 'Mr. Shahrukh Ahmed'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Room Number:</label>
                                            <span>{reservation?.roomNumber || '102'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Room Type:</label>
                                            <span>{reservation?.roomType || 'Deluxe'}</span>
                                        </div>
                                        {/* PHASE 3 UPGRADE: Show enterprise room details in booking details */}
                                        {reservation?.roomViewType && (
                                            <div className="detail-item">
                                                <label>View Type:</label>
                                                <span>{reservation.roomViewType}</span>
                                            </div>
                                        )}
                                        {reservation?.smokingPolicy && (
                                            <div className="detail-item">
                                                <label>Smoking Policy:</label>
                                                <span>{reservation.smokingPolicy}</span>
                                            </div>
                                        )}
                                        {reservation?.roomSize > 0 && (
                                            <div className="detail-item">
                                                <label>Room Size:</label>
                                                <span>{reservation.roomSize} sq ft</span>
                                            </div>
                                        )}
                                        {reservation?.isSmartRoom && (
                                            <div className="detail-item">
                                                <label>Smart Room:</label>
                                                <span>⚡ Yes</span>
                                            </div>
                                        )}
                                        {reservation?.dynamicRateEnabled && (
                                            <div className="detail-item">
                                                <label>Pricing:</label>
                                                <span className="dynamic-badge">Dynamic Rate</span>
                                            </div>
                                        )}
                                        <div className="detail-item">
                                            <label>Check-in Date:</label>
                                            <span>{reservation?.checkInDate || '03-02-2026'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Check-out Date:</label>
                                            <span>{reservation?.checkOutDate || '04-02-2026'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Status:</label>
                                            <span className="status-badge confirmed">
                                                {reservation?.status || 'CONFIRMED'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'guestDetails' && (
                                <div className="guest-details-content">
                                    <h3>Guest Information</h3>
                                    <div className="details-grid">
                                        <div className="detail-item">
                                            <label>Name:</label>
                                            <span>{reservation?.guestName || 'Mr. Shahrukh Ahmed'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Mobile:</label>
                                            <span>{reservation?.mobileNumber || '+91 9876543210'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Email:</label>
                                            <span>guest@example.com</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Address:</label>
                                            <span>Mumbai, Maharashtra</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'folioOperations' && (
                                <div className="folio-operations-content">
                                    <h3>Folio Operations</h3>
                                    <p>Manage payments, transfers, and folio operations here.</p>
                                </div>
                            )}

                            {activeTab === 'auditTrail' && (
                                <div className="audit-trail-content">
                                    <h3>Audit Trail</h3>
                                    <p>View all activities and changes made to this reservation.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Summary */}
                <div className="summary-footer">
                    <div className="summary-item">
                        <label>Sub Total</label>
                        <span>{cs} {totals.subTotal}</span>
                    </div>
                    <div className="summary-item">
                        <label>Grand Total</label>
                        <span>{cs} {totals.grandTotal}</span>
                    </div>
                    <div className="summary-item">
                        <label>Paid</label>
                        <span className="paid-amount">{cs} {totals.paid}</span>
                    </div>
                    <div className="summary-item">
                        <label>Sub Total</label>
                        <span>{cs} {totals.subTotal}</span>
                    </div>
                    <div className="summary-item">
                        <label>Grand Total</label>
                        <span>{cs} {totals.grandTotal}</span>
                    </div>
                    <div className="summary-item highlight">
                        <label>Balance</label>
                        <span>{cs} {totals.balance}</span>
                    </div>
                    <div className="summary-item">
                        <label>Paid</label>
                        <span className="paid-amount">{cs} {totals.paid}</span>
                    </div>
                </div>
            </div>
            {showAddPaymentModal && (
                <AddPayment 
                    reservation={reservation}
                    onClose={() => setShowAddPaymentModal(false)}
                    onAdd={async (data) => {
                        console.log('Payment Added in View:', data);
                        // Mock success
                        alert('Payment processed successfully!');
                        setShowAddPaymentModal(false);
                        if (onUpdate) onUpdate({ type: 'PAYMENT_ADDED', data });
                    }}
                />
            )}
        </div >
    );
};

export default ReservationDetailsView;
