import React, { useState, useEffect } from 'react';
import './MaintenanceBlock.css';
import API_URL, { apiCall } from '../../config/api';

const MaintenanceBlock = () => {
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [currentBlock, setCurrentBlock] = useState(null);
    const [formData, setFormData] = useState({
        room: '',
        blockType: '',
        startDate: '',
        endDate: '',
        reason: '',
        status: 'Blocked'
    });
    const [inlineNote, setInlineNote] = useState({ show: false, title: '', message: '', tone: 'success' });
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    useEffect(() => {
        fetchBlocks();
    }, []);

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

    const fetchBlocks = async () => {
        try {
            setLoading(true);
            const res = await apiCall(`/api/maintenance-blocks/list`);
            const data = await res.json();
            if (data.success) {
                // Ensure dates are parsed
                const parsed = data.data.map(b => ({
                    ...b,
                    startDate: new Date(b.startDate).toISOString().split('T')[0],
                    endDate: new Date(b.endDate).toISOString().split('T')[0]
                }));
                setBlocks(parsed);
            } else {
                showInlineNote('Load Failed', data.message || 'Unable to fetch maintenance blocks.', 'danger');
            }
        } catch (err) {
            showInlineNote('Load Failed', 'Error fetching data', 'danger');
        }
        finally { setLoading(false); }
    };

    const handleOpenModal = (mode, block = null) => {
        setModalMode(mode);
        if (mode === 'edit' && block) {
            setCurrentBlock(block);
            setFormData({
                room: block.room,
                blockType: block.blockType,
                startDate: block.startDate,
                endDate: block.endDate,
                reason: block.reason || '',
                status: block.status
            });
        } else {
            setCurrentBlock(null);
            setFormData({
                room: '', blockType: '', startDate: '', endDate: '', reason: '', status: 'Blocked'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = modalMode === 'add' ? `${API_URL}/api/maintenance-blocks/add` : `${API_URL}/api/maintenance-blocks/update/${currentBlock._id}`;
            const method = modalMode === 'add' ? 'POST' : 'PUT';

            const res = await apiCall(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (data.success) {
                setIsModalOpen(false);
                showInlineNote(modalMode === 'add' ? 'Block Added' : 'Block Updated', 'Maintenance block saved successfully.');
                fetchBlocks();
            } else {
                showInlineNote('Save Failed', data.message || 'Unable to save maintenance block.', 'danger');
            }
        } catch (error) {
            showInlineNote('Save Failed', 'Error submitting', 'danger');
        }
    };

    const handleStatusUpdate = async (id, newStatus) => {
        try {
            const res = await apiCall(`/api/maintenance-blocks/update/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                showInlineNote('Status Updated', `Maintenance marked as ${newStatus}.`);
                fetchBlocks();
            } else {
                showInlineNote('Update Failed', 'Unable to update maintenance status.', 'danger');
            }
        } catch (error) {
            showInlineNote('Update Failed', 'Error updating status', 'danger');
        }
    };

    const handleDelete = (id) => {
        setDeleteTargetId(id);
    };

    const confirmDelete = async (id) => {
        try {
            const res = await apiCall(`/api/maintenance-blocks/delete/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showInlineNote('Block Deleted', 'Maintenance block removed successfully.');
                fetchBlocks();
            } else {
                showInlineNote('Delete Failed', data.message || 'Unable to delete maintenance block.', 'danger');
            }
        } catch (error) {
            showInlineNote('Delete Failed', 'Error deleting', 'danger');
        } finally {
            setDeleteTargetId(null);
        }
    };

    // Filters
    const filteredBlocks = blocks.filter(b => {
        const matchesSearch = b.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.blockType.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'All' || b.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const getStatusClass = (status) => {
        if (status === 'In Progress') return 'status-badge in-progress';
        if (status === 'Blocked') return 'status-badge blocked';
        if (status === 'Completed') return 'status-badge completed';
        return 'status-badge';
    };

    return (
        <div className="maintenance-block-container">
            <header className="maintenance-header">
                <h2>Maintenance Block</h2>
                <button className="add-btn" onClick={() => handleOpenModal('add')}>+ Add Maintenance Block</button>
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

            <div className="filter-bar">
                <select
                    className="status-filter"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="All">All Status</option>
                    <option value="Blocked">Blocked</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                </select>

                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search here..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                    />
                    <span className="search-icon">🔍</span>
                </div>
            </div>

            {loading ? <div>Loading...</div> : (
                <div className="table-container">
                    <div className="maintenance-table-wrapper">
                        <table className="common-table maintenance-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Room</th>
                                    <th>Block Type</th>
                                    <th>Block Duration</th>
                                    <th>Status</th>
                                    <th>Reason</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBlocks.map((block, index) => (
                                    <tr key={block._id}>
                                        <td data-label="ID">{index + 1}</td>
                                        <td data-label="Room">{block.room}</td>
                                        <td data-label="Block Type">{block.blockType}</td>
                                        <td data-label="Duration" className="duration-cell">
                                            {block.startDate} - {block.endDate}
                                        </td>
                                        <td data-label="Status">
                                            <span className={getStatusClass(block.status)}>
                                                {block.status === 'In Progress' && '🟠 '}
                                                {block.status === 'Blocked' && '🔴 '}
                                                {block.status === 'Completed' && '🟢 '}
                                                {block.status}
                                            </span>
                                        </td>
                                        <td data-label="Reason" className="reason-cell">{block.reason}</td>
                                        <td data-label="Actions" className="maintenance-actions-cell">
                                            <div className="action-btns" style={{ position: 'relative' }}>
                                                {block.status === 'Blocked' && (
                                                    <button className="icon-btn action-start" title="Start Progress" onClick={() => handleStatusUpdate(block._id, 'In Progress')}>🔧</button>
                                                )}
                                                {block.status === 'In Progress' && (
                                                    <button className="icon-btn action-complete" title="Mark Completed" onClick={() => handleStatusUpdate(block._id, 'Completed')}>✅</button>
                                                )}

                                                <button className="icon-btn edit-btn" onClick={() => handleOpenModal('edit', block)}>✏️</button>
                                                <button className="icon-btn delete-btn" onClick={() => handleDelete(block._id)}>🗑️</button>

                                                {deleteTargetId === block._id && (
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
                                                                onClick={() => confirmDelete(block._id)}
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
                    <div className="table-footer">Showing {filteredBlocks.length} Maintenance Blocks</div>
                </div>
            )
            }

            {/* Premium Modal */}
            {isModalOpen && (
                <div className="add-payment-overlay">
                    <div className="add-payment-modal add-maintenance-premium">
                        <div className="premium-payment-header">
                            <div className="header-icon-wrap">
                                <span style={{ fontSize: '20px' }}>🔧</span>
                            </div>
                            <div className="header-text">
                                <h3>{modalMode === 'add' ? 'Add Maintenance Block' : 'Edit Maintenance Block'}</h3>
                                <span>ROOM MAINTENANCE</span>
                            </div>
                            <button className="premium-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            <div className="add-payment-body scrollable-modal-body">
                                <div className="premium-form-row">
                                    <div className="payment-field-group flex-1">
                                        <label className="field-label-premium">ROOM NUMBER</label>
                                        <div className="premium-input-wrap">
                                            <input
                                                type="text"
                                                value={formData.room}
                                                onChange={e => {
                                                    const value = e.target.value.replace(/\D/g, '');
                                                    setFormData({ ...formData, room: value });
                                                }}
                                                required
                                                placeholder="e.g. 102"
                                                className="premium-input"
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                    <div className="payment-field-group flex-1">
                                        <label className="field-label-premium">BLOCK TYPE</label>
                                        <div className="premium-input-wrap">
                                            <input
                                                type="text"
                                                value={formData.blockType}
                                                onChange={e => {
                                                    const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                    setFormData({ ...formData, blockType: value });
                                                }}
                                                required
                                                placeholder="e.g. Painting"
                                                className="premium-input"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="premium-form-row">
                                    <div className="payment-field-group flex-1">
                                        <label className="field-label-premium">START DATE</label>
                                        <div className="premium-input-wrap">
                                            <input
                                                type="date"
                                                value={formData.startDate}
                                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                                required
                                                className="premium-input"
                                            />
                                        </div>
                                    </div>
                                    <div className="payment-field-group flex-1">
                                        <label className="field-label-premium">END DATE</label>
                                        <div className="premium-input-wrap">
                                            <input
                                                type="date"
                                                value={formData.endDate}
                                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                                required
                                                className="premium-input"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">STATUS</label>
                                    <div className="premium-input-wrap">
                                        <select
                                            value={formData.status}
                                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                                            className="premium-input"
                                        >
                                            <option value="Blocked">Blocked</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Completed">Completed</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="payment-field-group">
                                    <label className="field-label-premium">REASON/NOTES</label>
                                    <div className="premium-input-wrap">
                                        <textarea
                                            value={formData.reason}
                                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                            rows="3"
                                            placeholder="Enter details..."
                                            className="premium-input premium-textarea"
                                        ></textarea>
                                    </div>
                                </div>
                            </div>

                            <div className="payment-modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    CANCEL
                                </button>
                                <button type="submit" className="btn-primary">
                                    {modalMode === 'add' ? 'ADD BLOCK' : 'UPDATE BLOCK'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );
};
export default MaintenanceBlock;

