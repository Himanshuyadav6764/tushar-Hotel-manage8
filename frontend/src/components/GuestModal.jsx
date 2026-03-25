import { useState, useEffect } from 'react';
import CreateGuestForm from './CreateGuestForm';
import './GuestModal.css';
import API_URL from '../config/api';

const ITEMS_PER_PAGE = 4;

const getGuestId = (guest) => guest?._id || guest?.id || guest?.guestId;

const upsertGuest = (list, guest) => {
    const incomingId = getGuestId(guest);
    if (!incomingId) return [...list, guest];

    const index = list.findIndex((item) => getGuestId(item) === incomingId);
    if (index === -1) return [...list, guest];

    const updated = [...list];
    updated[index] = { ...updated[index], ...guest };
    return updated;
};

const GuestModal = ({ isOpen, onClose, onSelectGuest, guests = [], onRefreshGuests, autoOpenCreate = false, multiSelect = false, preSelectedGuests = [] }) => {
    const [view, setView] = useState(autoOpenCreate ? 'create' : 'selection'); // 'selection' or 'create'
    const [searchTerm, setSearchTerm] = useState('');
    const [editingGuest, setEditingGuest] = useState(null);
    const [guestsList, setGuestsList] = useState(guests); // Local state for real-time updates
    const [tempSelected, setTempSelected] = useState(preSelectedGuests); // multi-select pending selections
    const [currentPage, setCurrentPage] = useState(1);

    // Sync local state with props
    useEffect(() => {
        setGuestsList(guests);
    }, [guests]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, view, isOpen]);

    useEffect(() => {
        if (!isOpen || !onRefreshGuests) return;
        onRefreshGuests();
    }, [isOpen, onRefreshGuests]);

    // Update view when autoOpenCreate changes
    useEffect(() => {
        if (autoOpenCreate && isOpen) {
            setView('create');
        } else if (!autoOpenCreate && isOpen) {
            setView('selection');
        }
    }, [autoOpenCreate, isOpen]);

    const handleSelectGuest = (guest) => {
        if (multiSelect) {
            const id = guest._id || guest.id || guest.guestId;
            setTempSelected(prev =>
                prev.some(g => (g._id || g.id || g.guestId) === id)
                    ? prev.filter(g => (g._id || g.id || g.guestId) !== id)
                    : [...prev, guest]
            );
        } else {
            onSelectGuest(guest);
            onClose();
        }
    };

    const handleConfirmMultiSelect = () => {
        onSelectGuest(tempSelected);
        onClose();
    };

    const handleCreateGuest = async (updatedGuest) => {
        console.log('💾 handleCreateGuest called with:', updatedGuest);
        if (!updatedGuest) return;

        if (editingGuest) {
            // ✅ EDIT MODE - Update state directly
            console.log('✏️ EDIT MODE: Updating guest in state...');

            setGuestsList(prevGuests => upsertGuest(prevGuests, updatedGuest));

            // Reset editing state
            setEditingGuest(null);

            // Switch back to selection view (AUTO-BACK)
            setView('selection');

            if (onRefreshGuests) {
                await onRefreshGuests();
            }

            console.log('✅ Guest updated in state, switched to selection view');

            // DO NOT close modal - stay open to show updated guest

        } else {
            // ✅ CREATE MODE - Add to state
            console.log('➕ CREATE MODE: Adding new guest to state...');

            setGuestsList(prevGuests => upsertGuest(prevGuests, updatedGuest));

            if (onRefreshGuests) {
                await onRefreshGuests();
            }

            if (multiSelect) {
                // In multiSelect mode: add to tempSelected and return to selection view
                setTempSelected(prev => upsertGuest(prev, updatedGuest));
                setView('selection');
            } else {
                // Select the newly created guest and close
                onSelectGuest(updatedGuest);
                onClose();
            }

            console.log('✅ New guest added');
        }
    };

    const handleEditGuest = (guest) => {
        console.log('✏️ Edit button clicked for:', guest);
        setEditingGuest(guest);
        setView('create');
    };

    const handleDeleteGuest = async (guest) => {
        try {
            const response = await fetch(`${API_URL}/api/guests/${guest.id || guest.guestId || guest._id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                console.log('✅ Guest deleted successfully');
                // Refresh the guests list
                if (onRefreshGuests) {
                    await onRefreshGuests();
                }
            } else {
                const error = await response.json();
                console.error('❌ Failed to delete guest:', error);
                // Removed browser alert for "pop section" removal
            }
        } catch (error) {
            console.error('❌ Error deleting guest:', error);
            // Removed browser alert for "pop section" removal
        }
    };

    const filteredGuests = guestsList.filter(guest =>
        (guest.fullName || guest.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (guest.mobile || '').includes(searchTerm)
    );

    const totalPages = Math.max(1, Math.ceil(filteredGuests.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const pagedGuests = filteredGuests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    if (!isOpen) return null;

    return (
        <div className="guest-modal-overlay" onClick={onClose}>
            <div className="guest-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        {view === 'selection'
                            ? multiSelect
                                ? `Select Guests${tempSelected.length > 0 ? ` (${tempSelected.length} selected)` : ''}`
                                : 'Select Guest'
                            : editingGuest
                                ? 'Edit Guest Profile'
                                : 'Create New Guest'
                        }
                    </h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {view === 'selection' ? (
                        <>
                            {/* Search Box - Direct Child, Full Width */}
                            <div className="guest-search-box">
                                <span className="guest-search-icon"></span>
                                <input
                                    type="text"
                                    placeholder="Search by name or phone..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                                    className="guest-search-input"
                                />
                            </div>

                            <div className="guest-selection-view">
                                {/* Guests List */}
                                <div className="guests-list">
                                    {filteredGuests.length > 0 ? (
                                        pagedGuests.map((guest, idx) => {
                                            const gid = guest._id || guest.id || guest.guestId;
                                            const isChecked = tempSelected.some(g => (g._id || g.id || g.guestId) === gid);
                                            return (
                                            <div
                                                key={gid || `guest-${startIndex + idx}`}
                                                className={`guest-item${multiSelect && isChecked ? ' guest-item-selected' : ''}`}
                                            >
                                                <div
                                                    className="guest-item-main"
                                                    onClick={() => handleSelectGuest(guest)}
                                                >
                                                    {multiSelect && (
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => handleSelectGuest(guest)}
                                                            onClick={e => e.stopPropagation()}
                                                            className="guest-multiselect-checkbox"
                                                        />
                                                    )}
                                                    <div className="guest-item-avatar">
                                                        {(guest.fullName || guest.name)?.charAt(0).toUpperCase()}
                                                    </div>

                                                    <div className="guest-item-info">
                                                        <p className="guest-name">{guest.fullName || guest.name}</p>
                                                        <p className="guest-phone">Mobile: {guest.mobile || guest.phone}</p>
                                                        {(guest.email) && <p className="guest-email">Email: {guest.email}</p>}
                                                    </div>
                                                </div>

                                                <div className="guest-item-actions">
                                                    <button
                                                        className="guest-action-btn guest-edit-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditGuest(guest);
                                                        }}
                                                        title="Edit Guest"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="guest-action-btn guest-delete-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteGuest(guest);
                                                        }}
                                                        title="Delete Guest"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                            );
                                        })
                                    ) : (
                                        <div className="no-results">
                                            {guestsList.length === 0 ? (
                                                <>
                                                    <p className="no-results-icon"></p>
                                                    <p>No guests available</p>
                                                    <p className="no-results-hint">Create a new guest to get started</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="no-results-icon"></p>
                                                    <p>No guests found</p>
                                                    <p className="no-results-hint">Try a different search term</p>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {filteredGuests.length > 0 && totalPages > 1 && (
                                    <div className="guest-pagination" role="navigation" aria-label="Guest pagination">
                                        <button
                                            type="button"
                                            className="guest-page-btn"
                                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                            disabled={safePage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span className="guest-page-info">
                                            Page {safePage} of {totalPages}
                                        </span>
                                        <button
                                            type="button"
                                            className="guest-page-btn"
                                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                            disabled={safePage === totalPages}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="modal-actions">
                                    <button
                                        className="btn-create-new"
                                        onClick={() => setView('create')}
                                    >
                                        + Create New Guest
                                    </button>
                                    {multiSelect && (
                                        <button
                                            className="btn-confirm-selection"
                                            onClick={handleConfirmMultiSelect}
                                            disabled={tempSelected.length === 0}
                                        >
                                            Confirm ({tempSelected.length}) Guest{tempSelected.length !== 1 ? 's' : ''}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <CreateGuestForm
                            onSave={handleCreateGuest}
                            onCancel={() => {
                                setEditingGuest(null);
                                setView('selection');
                            }}
                            existingGuests={guestsList}
                            editingGuest={editingGuest}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default GuestModal;

