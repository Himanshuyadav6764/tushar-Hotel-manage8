import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';

const ReservationListModal = ({ table, onClose, onCancel, onAdd }) => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [searchQuery, setSearchQuery] = useState('');
    const [cancelDraft, setCancelDraft] = useState({
        reservationId: '',
        reason: '',
        charge: '0',
        note: ''
    });
    const reservations = table.reservations || [];

    const parseReservationDateTime = (dateValue, timeValue) => {
        if (!dateValue || !timeValue) return null;
        const [year, month, day] = String(dateValue).split('-').map(Number);
        const [hour, minute] = String(timeValue).split(':').map(Number);
        if ([year, month, day, hour, minute].some(Number.isNaN)) return null;
        return new Date(year, month - 1, day, hour, minute, 0, 0);
    };

    const getTimeline = (reservation) => {
        const nowTs = Date.now();
        const retentionCutoffTs = nowTs - (24 * 60 * 60 * 1000);
        const startDateTime = parseReservationDateTime(reservation.date, reservation.startTime);
        const endDateTime = parseReservationDateTime(reservation.date, reservation.endTime || reservation.startTime);

        const startTs = startDateTime ? startDateTime.getTime() : 0;
        const endTs = endDateTime ? endDateTime.getTime() : startTs;
        const normalizedStatus = String(reservation.status || 'Upcoming').toLowerCase();
        const isCancelled = normalizedStatus === 'cancelled';
        const isExpiredFromView = endTs > 0 && endTs < retentionCutoffTs;
        const isFuture = startTs > nowTs;
        const isInSession = startTs > 0 && endTs > 0 && nowTs >= startTs && nowTs <= endTs;
        const isPast = endTs > 0 && endTs < nowTs;

        const sortGroup = isFuture || isInSession ? 0 : 1;
        const sortValue = sortGroup === 0 ? startTs : -endTs;
        const canCancel = !isCancelled && !isPast;

        return { isExpiredFromView, isFuture, isInSession, isPast, isCancelled, sortGroup, sortValue, canCancel };
    };

    const isSearchMatch = (res) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
            String(res.name || res.guestName || '').toLowerCase().includes(q) ||
            String(res.phone || '').includes(searchQuery)
        );
    };

    // Filter and Sort reservations
    const filteredReservations = reservations
        .filter(res => isSearchMatch(res) && !getTimeline(res).isExpiredFromView)
        .sort((a, b) => {
            const timelineA = getTimeline(a);
            const timelineB = getTimeline(b);

            if (timelineA.sortGroup !== timelineB.sortGroup) {
                return timelineA.sortGroup - timelineB.sortGroup;
            }
            return timelineA.sortValue - timelineB.sortValue;
        });

    const openCancelForm = (reservation) => {
        setCancelDraft({
            reservationId: String(reservation._id || reservation.id || ''),
            reason: '',
            charge: '0',
            note: ''
        });
    };

    const closeCancelForm = () => {
        setCancelDraft({ reservationId: '', reason: '', charge: '0', note: '' });
    };

    const submitCancellation = async (reservation) => {
        const reason = String(cancelDraft.reason || '').trim();
        if (!reason) return;

        await onCancel?.(reservation, {
            reason,
            charge: Number(cancelDraft.charge || 0),
            note: String(cancelDraft.note || '').trim(),
            source: 'Reservation List'
        });

        closeCancelForm();
    };

    return (
        <div className="add-payment-overlay" onClick={onClose}>
            <div className="add-payment-modal reservation-list-premium" onClick={(e) => e.stopPropagation()}>
                {/* Modern Premium Header */}
                <div className="premium-payment-header">
                    <div className="header-icon-wrap">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div className="header-text">
                        <h3>Reservations - {table.tableName}</h3>
                        <span>Upcoming dining schedule</span>
                    </div>
                    <button className="premium-close-btn" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="add-payment-body">
                    {/* Search Box */}
                    <div className="payment-field-group">
                        <div className="input-with-icon-premium">
                            <span className="field-icon" style={{ color: '#3b82f6' }}>🔍</span>
                            <input
                                type="text"
                                placeholder="Search by name or phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                                className="premium-input-field"
                            />
                        </div>
                    </div>

                    <div className="reservations-scroll-area">
                        {filteredReservations.length === 0 ? (
                            <div className="empty-reservations">
                                <div className="empty-calendar-icon">
                                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="3" y="4" width="18" height="18" rx="4" fill="#60A5FA" fillOpacity="0.2" stroke="#3B82F6" strokeWidth="1.5" />
                                        <path d="M3 10H21" stroke="#3B82F6" strokeWidth="1.5" />
                                        <path d="M8 2V6" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
                                        <path d="M16 2V6" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
                                        <rect x="7" y="13" width="2" height="2" rx="0.5" fill="#3B82F6" />
                                        <rect x="11" y="13" width="2" height="2" rx="0.5" fill="#3B82F6" />
                                        <rect x="15" y="13" width="2" height="2" rx="0.5" fill="#3B82F6" />
                                        <rect x="7" y="17" width="2" height="2" rx="0.5" fill="#3B82F6" />
                                        <rect x="11" y="17" width="2" height="2" rx="0.5" fill="#F43F5E" />
                                    </svg>
                                </div>
                                <p>No reservations found for this table.</p>
                            </div>
                        ) : (
                            <div className="reservations-list-premium-grid">
                                {filteredReservations.map(res => (
                                    <div key={res._id || res.id} className="reservation-item-premium">
                                        {(() => {
                                            const timeline = getTimeline(res);
                                            const isCancelFormOpen = cancelDraft.reservationId === String(res._id || res.id);

                                            return (
                                                <>
                                                    <div className="res-time-block">
                                                        <span className="res-time">{res.startTime}</span>
                                                        <span className="res-date">{res.date}</span>
                                                    </div>
                                                    <div className="res-info-block">
                                                        <div className="res-guest-name">{res.name || res.guestName}</div>
                                                        <div className="res-guest-meta">
                                                            {res.guests} Guests • {res.phone}
                                                        </div>
                                                        {res.advancePayment > 0 && (
                                                            <div className="res-advance-tag">
                                                                Advance: {cs}{res.advancePayment}
                                                            </div>
                                                        )}
                                                        {res.status === 'Cancelled' && (
                                                            <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#b40f1d', fontWeight: 700 }}>
                                                                Cancelled: {res.cancellationReason || 'Reason not captured'}
                                                                {Number(res.cancellationCharge || 0) > 0 ? ` • Charge ${cs}${Number(res.cancellationCharge).toFixed(2)}` : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="res-actions-block">
                                                        <span className={`res-status-pill status-${(res.status || 'Upcoming').toLowerCase()}`}>
                                                            {res.status || 'Upcoming'}
                                                        </span>
                                                        {timeline.canCancel && (
                                                            <button
                                                                className="res-cancel-btn"
                                                                onClick={() => openCancelForm(res)}
                                                                title="Cancel Reservation"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                    {isCancelFormOpen && (
                                                        <div style={{ gridColumn: '1 / -1', marginTop: '10px', padding: '12px', borderRadius: '10px', border: '1px solid #fecaca', background: '#fff1f2' }}>
                                                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#9f1239', marginBottom: '8px' }}>Cancel Reservation Details</div>
                                                            <input
                                                                className="premium-input-field"
                                                                placeholder="Reason (required)"
                                                                value={cancelDraft.reason}
                                                                onChange={(e) => setCancelDraft(prev => ({ ...prev, reason: e.target.value }))}
                                                                style={{ marginBottom: '8px' }}
                                                            />
                                                            <input
                                                                className="premium-input-field"
                                                                placeholder="Cancellation charge"
                                                                type="number"
                                                                min="0"
                                                                value={cancelDraft.charge}
                                                                onChange={(e) => setCancelDraft(prev => ({ ...prev, charge: e.target.value }))}
                                                                style={{ marginBottom: '8px' }}
                                                            />
                                                            <input
                                                                className="premium-input-field"
                                                                placeholder="Note (optional)"
                                                                value={cancelDraft.note}
                                                                onChange={(e) => setCancelDraft(prev => ({ ...prev, note: e.target.value }))}
                                                            />
                                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                                                <button className="btn-secondary" onClick={closeCancelForm}>Discard</button>
                                                                <button className="btn-primary" disabled={!cancelDraft.reason.trim()} onClick={() => submitCancellation(res)}>Confirm Cancel</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="payment-modal-footer">
                    <button className="btn-secondary premium-outline-btn" onClick={onClose}>
                        CLOSE
                    </button>
                    <button className="btn-primary" onClick={() => { onClose(); onAdd && onAdd(); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
                        ADD NEW
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReservationListModal;


