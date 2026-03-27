import React, { useState, useEffect, useRef } from 'react';
import API_URL, { apiCall } from '../../config/api';
import './SyncReport.css';

const COLLECTION_LABELS = {
    bookings:               { label: 'Reservations',          icon: '📅', desc: 'All booking & reservation records' },
    rooms:                  { label: 'Rooms',                 icon: '🛏️', desc: 'Room setup & configuration' },
    guests:                 { label: 'Guests',                icon: '👥', desc: 'Guest profiles & history' },
    orders:                 { label: 'KOT / Restaurant Orders',icon: '🍽️', desc: 'Food orders and KOT data' },
    tables:                 { label: 'Tables',                icon: '🪑', desc: 'Table management data' },
    transactions:           { label: 'Payments',              icon: '💳', desc: 'All payment transactions' },
    users:                  { label: 'Staff / Users',         icon: '👤', desc: 'Staff accounts and roles' },
    menus:                  { label: 'Food Menu',             icon: '📋', desc: 'Menu items and categories' },
    floors:                 { label: 'Floors',                icon: '🏢', desc: 'Floor configuration' },
    bedtypes:               { label: 'Bed Types',             icon: '🛏️', desc: 'Bed type configurations' },
    roomfacilitytypes:      { label: 'Room Facilities',       icon: '🔧', desc: 'Room facility types' },
    mealtypes:              { label: 'Meal Types',            icon: '🥗', desc: 'Meal plan configurations' },
    reservationtypes:       { label: 'Reservation Types',     icon: '📌', desc: 'Reservation type settings' },
    extracharges:           { label: 'Extra Charges',         icon: '💰', desc: 'Additional charge configs' },
    complimentaryservices:  { label: 'Complimentary Services',icon: '🎁', desc: 'Free service configs' },
    bookingsources:         { label: 'Booking Sources',       icon: '🌐', desc: 'Booking channel data' },
    businesssources:        { label: 'Business Sources',      icon: '🏢', desc: 'Business source data' },
    housekeepingtasks:      { label: 'Housekeeping',          icon: '🧹', desc: 'Housekeeping task records' },
    maintenanceblocks:      { label: 'Maintenance Blocks',    icon: '🔨', desc: 'Maintenance records' },
    folios:                 { label: 'Folios / Billing',      icon: '🧾', desc: 'Guest folio & bill data' },
    visitors:               { label: 'Visitors',              icon: '🚶', desc: 'Visitor log records' },
    auditlogs:              { label: 'Audit Logs',            icon: '📝', desc: 'System audit trail' },
};

const REPORT_DESCRIPTIONS = [
    { icon: '📅', title: 'Reservation Report',          desc: 'Shows all booking details with date, guest info, and status.' },
    { icon: '🚪', title: 'Check-In / Check-Out Report', desc: 'Displays current stay, past stay, and checkout records.' },
    { icon: '🛏️', title: 'Room Status Report',          desc: 'Shows vacant, occupied, reserved, and unavailable rooms.' },
    { icon: '🧾', title: 'Billing Report',               desc: 'Contains all bills, payments, discounts, and total earnings.' },
    { icon: '🍽️', title: 'KOT / Restaurant Report',     desc: 'Shows kitchen orders, food sales, and table records.' },
    { icon: '💳', title: 'Payment Report',               desc: 'Displays cash, UPI, card, partial, and pending payments.' },
    { icon: '👥', title: 'Guest History Report',         desc: 'Stores previous visit records and guest details.' },
    { icon: '👤', title: 'User / Staff Report',          desc: 'Tracks staff activity, login, and system usage.' },
    { icon: '📊', title: 'Daily / Monthly Report',       desc: 'Shows income, occupancy, and performance summary.' },
    { icon: '🔄', title: 'Sync / Backup Report',         desc: 'Maintains data sync, backup, and restore information.' },
];

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function LastSyncTime() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(t);
    }, []);
    return <span>{now.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' })}</span>;
}

export default function SyncReport() {
    const [status, setStatus]           = useState(null);
    const [loading, setLoading]         = useState(true);
    const [selected, setSelected]       = useState([]);
    const [downloading, setDownloading] = useState(false);
    const [restoring, setRestoring]     = useState(false);
    const [restoreResult, setRestoreResult] = useState(null);
    const [activeTab, setActiveTab]     = useState('export'); // 'export' | 'restore' | 'log' | 'reports'
    const [progress, setProgress]       = useState(0);
    const [backupLog, setBackupLog]     = useState(() => {
        try { return JSON.parse(localStorage.getItem('sync_backup_log') || '[]'); } catch { return []; }
    });
    const [toast, setToast]             = useState(null);
    const fileRef                       = useRef();
    const progressRef                   = useRef(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    /* ── Fetch DB status ── */
    const fetchStatus = async () => {
        setLoading(true);
        try {
            const res  = await apiCall(`/api/sync/status`);
            const data = await res.json();
            if (data.success) {
                setStatus(data);
                setSelected(Object.keys(data.collections));
            } else {
                showToast('Failed to load database status', 'error');
            }
        } catch {
            showToast('Cannot connect to server', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStatus(); }, []);

    /* ── Selection helpers ── */
    const toggleSelect = (col) =>
        setSelected(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);

    const toggleAll = () => {
        if (!status) return;
        const all = Object.keys(status.collections);
        setSelected(selected.length === all.length ? [] : all);
    };

    /* ── Animated progress bar ── */
    const runProgress = (onDone) => {
        setProgress(0);
        let val = 0;
        progressRef.current = setInterval(() => {
            val += Math.random() * 18;
            if (val >= 90) {
                clearInterval(progressRef.current);
                setProgress(90);
            } else {
                setProgress(Math.round(val));
            }
        }, 120);
        return () => {
            clearInterval(progressRef.current);
            setProgress(100);
            setTimeout(() => { setProgress(0); onDone && onDone(); }, 600);
        };
    };

    /* ── Download Backup ── */
    const handleBackup = async () => {
        if (!selected.length) { showToast('Select at least one collection', 'error'); return; }
        setDownloading(true);
        const finish = runProgress();
        try {
            const colParam = selected.join(',');
            const res = await apiCall(`/api/sync/backup?collections=${encodeURIComponent(colParam)}`);
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const blob     = await res.blob();
            const sizeStr  = formatBytes(blob.size);
            const url      = URL.createObjectURL(blob);
            const a        = document.createElement('a');
            a.href         = url;
            a.download     = `bireena_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);

            const entry = {
                id: Date.now(),
                date: new Date().toLocaleString('en-IN'),
                collections: selected.length,
                totalRecords: selected.reduce((s, col) => s + (status?.collections?.[col] || 0), 0),
                size: sizeStr,
                status: 'Success',
            };
            const newLog = [entry, ...backupLog].slice(0, 30);
            setBackupLog(newLog);
            localStorage.setItem('sync_backup_log', JSON.stringify(newLog));
            finish();
            showToast(`✅ Backup downloaded — ${selected.length} collections, ${sizeStr}`, 'success');
        } catch (e) {
            clearInterval(progressRef.current); setProgress(0);
            showToast('Backup failed: ' + e.message, 'error');
        } finally {
            setDownloading(false);
        }
    };

    /* ── Verify backup file ── */
    const handleRestoreFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.name.endsWith('.json')) { showToast('Please select a .json backup file', 'error'); return; }
        setRestoring(true);
        setRestoreResult(null);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!data.data || !data.exportedAt) throw new Error('Invalid backup format');
                const summary = Object.entries(data.data).map(([col, docs]) => ({
                    collection: col,
                    label: COLLECTION_LABELS[col]?.label || col,
                    icon: COLLECTION_LABELS[col]?.icon || '📁',
                    records: docs.length,
                }));
                setRestoreResult({
                    exportedAt:   data.exportedAt,
                    dbName:       data.dbName,
                    version:      data.version || '1.0',
                    summary,
                    totalRecords: summary.reduce((s, c) => s + c.records, 0),
                    fileSize:     formatBytes(file.size),
                });
                showToast('Backup verified successfully', 'success');
            } catch (err) {
                showToast('Invalid file: ' + err.message, 'error');
            } finally {
                setRestoring(false);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    /* ── Derived values ── */
    const totalDocs    = status ? Object.values(status.collections).reduce((s, n) => s + n, 0) : 0;
    const collections  = status ? Object.entries(status.collections) : [];
    const allSelected  = status && selected.length === Object.keys(status.collections).length;
    const selectedDocs = selected.reduce((s, col) => s + (status?.collections?.[col] || 0), 0);

    return (
        <div className="sr2-wrap">
            {/* Toast */}
            {toast && (
                <div className={`sr2-toast sr2-toast-${toast.type}`}>
                    {toast.msg}
                </div>
            )}

            {/* ── Top Header ── */}
            <div className="sr2-page-header">
                <div className="sr2-ph-left">
                    <div className="sr2-ph-icon">🔄</div>
                    <div>
                        <h1>Sync &amp; Backup</h1>
                        <p>Last synced: <LastSyncTime /></p>
                    </div>
                </div>
                <button className="sr2-refresh-btn" onClick={fetchStatus} disabled={loading}>
                    <span className={loading ? 'sr2-spin' : ''}>↻</span>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {/* ── Stat Cards ── */}
            <div className="sr2-stats-row">
                {/* Card 1 — red (like Total Rooms) */}
                <div className="sr2-stat sr2-stat-red">
                    <div className="sr2-stat-icon-wrap">🗄️</div>
                    <div className="sr2-stat-body">
                        <span className="sr2-stat-val">{loading ? '—' : (status?.totalCollections ?? 0)}</span>
                        <span className="sr2-stat-lbl">Total Collections</span>
                    </div>
                    <div className="sr2-stat-sub">DB: {loading ? '...' : (status?.dbName || 'N/A')}</div>
                </div>

                {/* Card 2 — pink */}
                <div className="sr2-stat sr2-stat-pink">
                    <div className="sr2-stat-icon-wrap">📦</div>
                    <div className="sr2-stat-body">
                        <span className="sr2-stat-val">{loading ? '—' : totalDocs.toLocaleString('en-IN')}</span>
                        <span className="sr2-stat-lbl">Total Records</span>
                    </div>
                    <div className="sr2-stat-sub">Selected: {selectedDocs.toLocaleString('en-IN')}</div>
                </div>

                {/* Card 3 — peach */}
                <div className="sr2-stat sr2-stat-peach">
                    <div className="sr2-stat-icon-wrap">💾</div>
                    <div className="sr2-stat-body">
                        <span className="sr2-stat-val">{loading ? '—' : formatBytes(status?.dataSize)}</span>
                        <span className="sr2-stat-lbl">Data Size</span>
                    </div>
                    <div className="sr2-stat-sub">Storage: {loading ? '...' : formatBytes(status?.storageSize)}</div>
                </div>

                {/* Card 4 — white/red */}
                <div className="sr2-stat sr2-stat-white">
                    <div className="sr2-stat-icon-wrap">✅</div>
                    <div className="sr2-stat-body">
                        <span className="sr2-stat-val">{backupLog.length}</span>
                        <span className="sr2-stat-lbl">Backups Taken</span>
                    </div>
                    <div className="sr2-stat-sub">In this session</div>
                </div>
            </div>

            {/* ── Progress Bar (shows during backup) ── */}
            {progress > 0 && (
                <div className="sr2-progress-wrap">
                    <div className="sr2-progress-bar" style={{ width: `${progress}%` }} />
                    <span className="sr2-progress-label">Backing up... {progress}%</span>
                </div>
            )}

            {/* ── Tab Navigation ── */}
            <div className="sr2-tabs">
                {[
                    { id: 'export',   label: '📤 Export Backup' },
                    { id: 'restore',  label: '📥 Verify Restore' },
                    { id: 'log',      label: `📋 Backup History (${backupLog.length})` },
                    { id: 'reports',  label: '📊 Report Guide' },
                ].map(t => (
                    <button
                        key={t.id}
                        className={`sr2-tab ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >{t.label}</button>
                ))}
            </div>

            {/* ════════════════════════════════════
                TAB: Export Backup
            ════════════════════════════════════ */}
            {activeTab === 'export' && (
                <div className="sr2-card">
                    <div className="sr2-card-header">
                        <div className="sr2-card-title">Select Collections to Backup</div>
                        <div className="sr2-header-actions">
                            <button className="sr2-link-btn" onClick={toggleAll}>
                                {allSelected ? '☐ Deselect All' : '☑ Select All'}
                            </button>
                            <span className="sr2-badge">{selected.length} / {collections.length} selected</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="sr2-loading">
                            <div className="sr2-spinner" />
                            <span>Fetching database status...</span>
                        </div>
                    ) : (
                        <>
                            <div className="sr2-col-grid">
                                {collections.map(([col, count]) => {
                                    const meta = COLLECTION_LABELS[col] || { label: col, icon: '📁', desc: col };
                                    const checked = selected.includes(col);
                                    return (
                                        <div
                                            key={col}
                                            className={`sr2-col-card ${checked ? 'checked' : ''}`}
                                            onClick={() => toggleSelect(col)}
                                        >
                                            <div className="sr2-col-check">
                                                {checked ? '✓' : ''}
                                            </div>
                                            <div className="sr2-col-ico">{meta.icon}</div>
                                            <div className="sr2-col-body">
                                                <div className="sr2-col-name">{meta.label}</div>
                                                <div className="sr2-col-desc">{meta.desc}</div>
                                            </div>
                                            <div className="sr2-col-count">
                                                <span className="sr2-count-val">{count.toLocaleString('en-IN')}</span>
                                                <span className="sr2-count-lbl">records</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Summary bar */}
                            <div className="sr2-summary-bar">
                                <div className="sr2-summary-item">
                                    <span className="sr2-summary-icon">📦</span>
                                    <span><strong>{selected.length}</strong> collections</span>
                                </div>
                                <div className="sr2-summary-item">
                                    <span className="sr2-summary-icon">📄</span>
                                    <span><strong>{selectedDocs.toLocaleString('en-IN')}</strong> records</span>
                                </div>
                                <div className="sr2-summary-item">
                                    <span className="sr2-summary-icon">💾</span>
                                    <span>Est. size: <strong>{formatBytes(status?.dataSize ? (status.dataSize * selected.length / Math.max(collections.length, 1)) : 0)}</strong></span>
                                </div>
                                <button
                                    className="sr2-backup-btn"
                                    onClick={handleBackup}
                                    disabled={downloading || !selected.length}
                                >
                                    {downloading
                                        ? <><span className="sr2-spin">↻</span> Backing up...</>
                                        : '⬇️ Download Backup'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════
                TAB: Verify Restore
            ════════════════════════════════════ */}
            {activeTab === 'restore' && (
                <div className="sr2-card">
                    <div className="sr2-card-header">
                        <div className="sr2-card-title">Verify Backup File</div>
                    </div>
                    <div className="sr2-restore-zone">
                        <div className="sr2-restore-icon">📥</div>
                        <p className="sr2-restore-txt">
                            Upload a <strong>.json</strong> backup file to verify its contents and see a full record summary.
                            <br />
                            <em>No data will be modified — this is read-only verification.</em>
                        </p>
                        <button
                            className="sr2-upload-btn"
                            onClick={() => fileRef.current?.click()}
                            disabled={restoring}
                        >
                            {restoring ? <><span className="sr2-spin">↻</span> Reading...</> : '📂 Open Backup File (.json)'}
                        </button>
                        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleRestoreFile} />
                    </div>

                    {restoreResult && (
                        <div className="sr2-restore-result">
                            <div className="sr2-restore-meta-grid">
                                <div className="sr2-rr-meta"><span>📅</span><div><b>Exported</b><br />{new Date(restoreResult.exportedAt).toLocaleString('en-IN')}</div></div>
                                <div className="sr2-rr-meta"><span>🗄️</span><div><b>Database</b><br />{restoreResult.dbName}</div></div>
                                <div className="sr2-rr-meta"><span>📦</span><div><b>Total Records</b><br />{restoreResult.totalRecords.toLocaleString('en-IN')}</div></div>
                                <div className="sr2-rr-meta"><span>💾</span><div><b>File Size</b><br />{restoreResult.fileSize}</div></div>
                                <div className="sr2-rr-meta"><span>🗂️</span><div><b>Collections</b><br />{restoreResult.summary.length}</div></div>
                                <div className="sr2-rr-meta sr2-rr-ok"><span>✅</span><div><b>Status</b><br />Verified</div></div>
                            </div>
                            <div className="sr2-rr-table-wrap">
                                <table className="sr2-rr-table">
                                    <thead>
                                        <tr><th>#</th><th>Collection</th><th>Records</th></tr>
                                    </thead>
                                    <tbody>
                                        {restoreResult.summary.map((row, i) => (
                                            <tr key={row.collection}>
                                                <td>{i + 1}</td>
                                                <td><span className="sr2-tbl-ico">{row.icon}</span> {row.label}</td>
                                                <td><span className="sr2-rr-rec">{row.records.toLocaleString('en-IN')}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════
                TAB: Backup History Log
            ════════════════════════════════════ */}
            {activeTab === 'log' && (
                <div className="sr2-card">
                    <div className="sr2-card-header">
                        <div className="sr2-card-title">Backup History</div>
                        {backupLog.length > 0 && (
                            <button className="sr2-link-btn danger" onClick={() => {
                                setBackupLog([]);
                                localStorage.removeItem('sync_backup_log');
                            }}>🗑️ Clear Log</button>
                        )}
                    </div>
                    {backupLog.length === 0 ? (
                        <div className="sr2-empty">
                            <div className="sr2-empty-ico">📋</div>
                            <p>No backups taken yet. Go to <strong>Export Backup</strong> tab to create one.</p>
                        </div>
                    ) : (
                        <div className="sr2-log-table-wrap">
                            <table className="sr2-log-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Date &amp; Time</th>
                                        <th>Collections</th>
                                        <th>Records</th>
                                        <th>File Size</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {backupLog.map((row, i) => (
                                        <tr key={row.id}>
                                            <td>{i + 1}</td>
                                            <td>{row.date}</td>
                                            <td>{row.collections}</td>
                                            <td>{(row.totalRecords || 0).toLocaleString('en-IN')}</td>
                                            <td>{row.size}</td>
                                            <td><span className="sr2-tag success">✅ {row.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════
                TAB: Report Guide
            ════════════════════════════════════ */}
            {activeTab === 'reports' && (
                <div className="sr2-card">
                    <div className="sr2-card-header">
                        <div className="sr2-card-title">Report Overview — Hotel Management System</div>
                    </div>
                    <div className="sr2-reports-grid">
                        {REPORT_DESCRIPTIONS.map((r, i) => (
                            <div key={i} className={`sr2-rpt-card ${r.title.includes('Sync') ? 'active' : ''}`}>
                                <div className="sr2-rpt-num">{i + 1}</div>
                                <div className="sr2-rpt-icon">{r.icon}</div>
                                <div className="sr2-rpt-body">
                                    <div className="sr2-rpt-title">{r.title}</div>
                                    <div className="sr2-rpt-desc">{r.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
