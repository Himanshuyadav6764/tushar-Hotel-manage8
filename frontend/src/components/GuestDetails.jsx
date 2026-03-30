import React from 'react';
import './EditReservationModal.css';
import VisitorList from './visitors/VisitorList';

const GuestProfileCard = ({ guest, label, index }) => {
    // Normalise address — stored as object on primary guest from API, as flat fields on additionalGuests
    const addressLine = (typeof guest.address === 'object' ? guest.address?.line : guest.address) || '';
    const city    = guest.city    || (typeof guest.address === 'object' ? guest.address?.city    : '') || '';
    const state   = guest.state   || (typeof guest.address === 'object' ? guest.address?.state   : '') || '';
    const country = guest.country || (typeof guest.address === 'object' ? guest.address?.country : '') || '';
    const pinCode = guest.pinCode || (typeof guest.address === 'object' ? guest.address?.pinCode : '') || '';
    const fullAddress = [addressLine, city, state, pinCode, country].filter(Boolean).join(', ');

    // Normalise ID proof — nested on primary (idProof.type/number), flat on additionalGuests
    const idType   = guest.idProof?.type   || guest.idProofType   || '-';
    const idNumber = guest.idProof?.number || guest.idProofNumber || '-';

    return (
        <div className="guest-profile-card">
            <div className="guest-profile-card-header">
                <span className="guest-profile-avatar">
                    {(guest.name || guest.guestName || '?').charAt(0).toUpperCase()}
                </span>
                <span className="guest-profile-label">{label}</span>
            </div>
            <div className="details-grid">
                <div className="detail-item">
                    <span className="detail-label">Guest Name</span>
                    <span className="detail-value">{guest.name || guest.guestName || '-'}</span>
                </div>
                <div className="detail-item">
                    <span className="detail-label">Mobile Number</span>
                    <span className="detail-value">{guest.mobile || guest.guestPhone || '-'}</span>
                </div>
                <div className="detail-item">
                    <span className="detail-label">Email Address</span>
                    <span className="detail-value">{guest.email || guest.guestEmail || '-'}</span>
                </div>
                <div className="detail-item">
                    <span className="detail-label">Gender</span>
                    <span className="detail-value">{guest.gender || '-'}</span>
                </div>
                <div className="detail-item">
                    <span className="detail-label">Nationality</span>
                    <span className="detail-value">{guest.nationality || 'Indian'}</span>
                </div>
                <div className="detail-item">
                    <span className="detail-label">ID Proof Type</span>
                    <span className="detail-value">{idType}</span>
                </div>
                <div className="detail-item">
                    <span className="detail-label">ID Proof Number</span>
                    <span className="detail-value">{idNumber}</span>
                </div>
                <div className="detail-item">
                    <span className="detail-label">Vehicle Number</span>
                    <span className="detail-value">{guest.vehicleNumber || '-'}</span>
                </div>
                {guest.companyName && (
                    <div className="detail-item">
                        <span className="detail-label">Company</span>
                        <span className="detail-value">{guest.companyName}</span>
                    </div>
                )}
                <div className="detail-item detail-item-full">
                    <span className="detail-label">Address</span>
                    <span className="detail-value">{fullAddress || '-'}</span>
                </div>
            </div>
        </div>
    );
};

const GuestDetails = ({ reservation }) => {
    if (!reservation) return null;

    const primaryGuest = {
        name: reservation.guestName,
        mobile: reservation.guestPhone,
        email: reservation.guestEmail,
        gender: reservation.gender,
        nationality: reservation.nationality,
        dob: reservation.dob,
        address: reservation.address,
        city: reservation.city,
        state: reservation.state,
        country: reservation.country,
        pinCode: reservation.pinCode,
        idProofType: reservation.idProofType,
        idProofNumber: reservation.idProofNumber,
        vehicleNumber: reservation.vehicleNumber,
        companyName: reservation.companyName
    };

    const additionalGuests = reservation.additionalGuests || [];
    const totalGuests = 1 + additionalGuests.length;

    return (
        <div className="booking-details-container">
            <div className="guest-profile-section-header">
                <h3 className="details-section-title">Guest Profile</h3>
                <span className="guest-count-badge">{totalGuests} Guest{totalGuests !== 1 ? 's' : ''}</span>
            </div>

            {/* Primary Guest */}
            <GuestProfileCard guest={primaryGuest} label="Primary Guest" index={0} />

            {/* Additional Guests */}
            {additionalGuests.map((guest, idx) => (
                <GuestProfileCard
                    key={idx}
                    guest={guest}
                    label={`Guest ${idx + 2}`}
                    index={idx + 1}
                />
            ))}

            {/* Additional Information (notes / special requests) */}
            <h3 className="details-section-title" style={{ marginTop: '24px' }}>Additional Information</h3>
            <div className="details-grid">
                <div className="detail-item detail-item-full">
                    <span className="detail-label">Special Requests / Notes</span>
                    <span className="detail-value">{reservation.notes || reservation.specialRequests || '-'}</span>
                </div>
            </div>

            {/* Visitors Section */}
            <div style={{ marginTop: '24px', borderTop: '1px solid #f3f4f6', paddingTop: '24px' }}>
                <h3 className="details-section-title">
                    Visitors ({reservation.visitors?.length || 0})
                </h3>
                <VisitorList reservationId={reservation._id || reservation.id} refreshTrigger={reservation.updatedAt} />
            </div>
        </div>
    );
};

export default GuestDetails;
