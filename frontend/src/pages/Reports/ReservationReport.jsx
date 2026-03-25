import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import { useAuth } from '../../context/AuthContext';
import API_URL from '../../config/api';
import './ReservationReport.css';

const ReservationReport = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        source: 'All',
        tableType: 'All'
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    const tabs = [
        { id: 'upcoming', label: 'Upcoming', icon: '📅' },
        { id: 'today', label: "Today's", icon: '🔔' },
        { id: 'completed', label: 'Completed', icon: '✅' },
        { id: 'guests', label: 'Guest History', icon: '👤' },
        { id: 'repeat', label: 'Repeat Guests', icon: '🔁' },
        { id: 'tables', label: 'Table Utilization', icon: '🪑' }
    ];

    const SOURCES = ['All', 'Walk-In', 'Phone', 'Online'];

    useEffect(() => { fetchReport(); }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.tableType !== 'All') params.append('tableType', filters.tableType);
            if (filters.source !== 'All') params.append('source', filters.source);
            const res = await axios.get(`${API_URL}/api/reservation-report?${params.toString()}`);
            if (res.data.success) setData(res.data);
        } catch (err) {
            console.error('Reservation report error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortList = (list) => {
        if (!list) return [];
        const sorted = [...list];
        sorted.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];
            if (sortConfig.key === 'date') {
                aVal = aVal ? new Date(aVal).getTime() : 0;
                bVal = bVal ? new Date(bVal).getTime() : 0;
            }
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    };

    const filterReservations = (list) => {
        if (!list) return [];
        let filtered = [...list];
        if (searchTerm) {
            const t = searchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                (r.guestName || '').toLowerCase().includes(t) ||
                (r.phone || '').includes(t) ||
                (r.tableName || '').toLowerCase().includes(t)
            );
        }
        return sortList(filtered);
    };

    const getTabData = () => {
        if (!data) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        switch (activeTab) {
            case 'upcoming':
                return filterReservations(data.reservationList.filter(r => {
                    const d = r.date ? new Date(r.date) : null;
                    const st = (r.status || '').toLowerCase();
                    return d && d >= today && st !== 'completed' && st !== 'cancelled';
                }));
            case 'today':
                return filterReservations(data.reservationList.filter(r => {
                    const d = r.date ? new Date(r.date) : null;
                    return d && d >= today && d < tomorrow;
                }));
            case 'completed':
                return filterReservations(data.reservationList.filter(r =>
                    (r.status || '').toLowerCase() === 'completed'
                ));
            default:
                return filterReservations(data.reservationList);
        }
    };

    const getStatusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'confirmed' || s === 'completed') return { bg: '#dcfce7', color: '#166534' };
        if (s === 'upcoming') return { bg: '#dbeafe', color: '#1e40af' };
        if (s === 'cancelled') return { bg: '#fee2e2', color: '#991b1b' };
        if (s.includes('no') && s.includes('show')) return { bg: '#fef3c7', color: '#92400e' };
        return { bg: '#f3f4f6', color: '#374151' };
    };

    const handleExportCSV = () => {
        const list = getTabData();
        if (!list.length) return;
        const headers = ['ID', 'Guest', 'Phone', 'Guests', 'Table', 'Date', 'Time', 'Status'];
        const rows = list.map(r => [
            r.id, r.guestName, r.phone, r.guests, r.tableName,
            r.date ? new Date(r.date).toLocaleDateString('en-IN') : '-',
            r.startTime, r.status
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reservation-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportExcel = () => {
        const list = getTabData();
        if (!list.length) return;

        const headers = ['ID', 'Guest', 'Phone', 'Guests', 'Table', 'Date', 'Time', 'Status'];
        const rows = list.map(r => [
            r.id,
            r.guestName,
            r.phone,
            r.guests,
            r.tableName,
            r.date ? new Date(r.date).toLocaleDateString('en-IN') : '-',
            r.startTime,
            r.status
        ]);

        const escapeHtml = (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const html = `
            <html><head><meta charset="utf-8" />
            <style>
                table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
                th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
                th { background: #f3f4f6; font-weight: 700; }
            </style>
            </head><body>
                <h3>Reservation Report - ${activeTab}</h3>
                <table>
                    <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
                    <tbody>${rows.map(r => `<tr>${r.map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>
                </table>
            </body></html>`;

        const blob = new Blob([`\ufeff${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reservation-report-${activeTab}-${new Date().toISOString().split('T')[0]}.xls`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = () => {
        const list = getTabData();
        if (!list.length) return;

        const headers = ['ID', 'Guest', 'Phone', 'Guests', 'Table', 'Date', 'Time', 'Status'];
        const rows = list.map(r => [
            String(r.id || '-'),
            String(r.guestName || '-'),
            String(r.phone || '-'),
            String(r.guests || '-'),
            String(r.tableName || '-'),
            r.date ? new Date(r.date).toLocaleDateString('en-IN') : '-',
            String(r.startTime || '-'),
            String(r.status || '-')
        ]);

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 8;
        const rowHeight = 6;
        const colWidth = (pageWidth - (margin * 2)) / headers.length;

        const sanitizePdfText = (value) => String(value ?? '')
            .replace(/₹/g, 'Rs ')
            .normalize('NFKD')
            .replace(/[^\x20-\x7E]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const fitCellText = (value, widthMm) => {
            const normalized = sanitizePdfText(value);
            if (!normalized) return '';

            const maxWidth = Math.max(4, widthMm - 2.2);
            if (doc.getTextWidth(normalized) <= maxWidth) return normalized;

            let text = normalized;
            while (text.length > 1 && doc.getTextWidth(`${text}...`) > maxWidth) {
                text = text.slice(0, -1);
            }

            return `${text}...`;
        };

        const drawHeader = () => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text(`Reservation Report - ${activeTab}`, margin, 10);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, pageWidth - margin, 10, { align: 'right' });
        };

        const drawTableHeader = (y) => {
            doc.setFillColor(245, 245, 245);
            doc.rect(margin, y, pageWidth - (margin * 2), rowHeight, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            headers.forEach((h, i) => doc.text(fitCellText(h, colWidth), margin + (i * colWidth) + 1, y + 4.2));
        };

        drawHeader();
        let y = 16;
        drawTableHeader(y);
        y += rowHeight;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        rows.forEach((row, idx) => {
            if (y > pageHeight - 10) {
                doc.addPage();
                drawHeader();
                y = 16;
                drawTableHeader(y);
                y += rowHeight;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
            }

            if (idx % 2 === 0) {
                doc.setFillColor(252, 252, 252);
                doc.rect(margin, y - 0.3, pageWidth - (margin * 2), rowHeight, 'F');
            }

            row.forEach((cell, i) => {
                doc.text(fitCellText(cell, colWidth), margin + (i * colWidth) + 1, y + 4.2);
            });

            y += rowHeight;
        });

        doc.save(`reservation-report-${activeTab}-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const summary = data?.summary || {};
    const distributions = data?.distributions || {};

    // Bar chart helper
    const maxTimeVal = Math.max(...Object.values(distributions.time || {}), 1);
    const sortedTimeEntries = Object.entries(distributions.time || {}).sort((a, b) => a[0].localeCompare(b[0]));

    // Pie chart colors
    const pieColors = ['#E31E24', '#2563eb', '#16a34a', '#f59e0b', '#8b5cf6'];
    const sourceEntries = Object.entries(distributions.source || {}).filter(([, v]) => v > 0);
    const sourceTotal = sourceEntries.reduce((s, [, v]) => s + v, 0);

    const SortIcon = ({ col }) => {
        if (sortConfig.key !== col) return <span className="rr-sort-icon">↕</span>;
        return <span className="rr-sort-icon active">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="rr-container">
            {/* Header */}
            <div className="rr-header">
                <div className="rr-header-left">
                    <h1 className="rr-title">Reservation Reports</h1>
                    <p className="rr-subtitle">Table reservation analytics & guest insights</p>
                </div>
                <div className="rr-header-actions">
                    <button className="rr-btn rr-btn-outline" onClick={handleExportExcel}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Export Excel
                    </button>
                    <button className="rr-btn rr-btn-outline" onClick={handleExportPDF}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                        Export PDF
                    </button>
                    <button className="rr-btn rr-btn-outline" onClick={() => window.print()}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                        Print
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="rr-filters-bar">
                <div className="rr-filter-group">
                    <label>Start Date</label>
                    <input type="date" value={filters.startDate} onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))} />
                </div>
                <div className="rr-filter-group">
                    <label>End Date</label>
                    <input type="date" value={filters.endDate} onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))} />
                </div>
                <div className="rr-filter-group">
                    <label>Source</label>
                    <select value={filters.source} onChange={e => setFilters(p => ({ ...p, source: e.target.value }))}>
                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="rr-filter-group">
                    <label>Table Type</label>
                    <select value={filters.tableType} onChange={e => setFilters(p => ({ ...p, tableType: e.target.value }))}>
                        <option value="All">All</option>
                        {(() => {
                            const defaults = ['General', 'AC', 'Non-AC', 'Garden'];
                            const fromDB = (data?.tableTypes || [])
                                .map(t => (t || '').toString().trim())
                                .filter(t => t.length > 1 && !t.toLowerCase().includes('burr'));
                            const merged = [...new Set([...defaults, ...fromDB])];
                            return merged.map(t => <option key={t} value={t}>{t}</option>);
                        })()}
                    </select>
                </div>
                <button className="rr-btn rr-btn-primary" onClick={fetchReport}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg>
                    Generate Report
                </button>
            </div>

            {loading ? (
                <div className="rr-loading">
                    <div className="rr-spinner"></div>
                    <p>Loading reservation data...</p>
                </div>
            ) : data ? (
                <>
                    {/* Summary Cards */}
                    <div className="rr-summary-grid">
                        <div className="rr-card rr-card-1">
                            <div className="rr-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                            </div>
                            <div className="rr-card-content">
                                <span className="rr-card-value">{summary.totalReservations || 0}</span>
                                <span className="rr-card-label">Total Reservations</span>
                            </div>
                        </div>
                        <div className="rr-card rr-card-2">
                            <div className="rr-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            </div>
                            <div className="rr-card-content">
                                <span className="rr-card-value">{summary.todayCount || 0}</span>
                                <span className="rr-card-label">Today's Reservations</span>
                            </div>
                        </div>
                        <div className="rr-card rr-card-3">
                            <div className="rr-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" /></svg>
                            </div>
                            <div className="rr-card-content">
                                <span className="rr-card-value">{summary.noShowCount || 0}</span>
                                <span className="rr-card-label">No Shows</span>
                            </div>
                        </div>
                        <div className="rr-card rr-card-4">
                            <div className="rr-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                            </div>
                            <div className="rr-card-content">
                                <span className="rr-card-value">{summary.cancelledCount || 0}</span>
                                <span className="rr-card-label">Cancelled</span>
                            </div>
                        </div>
                        <div className="rr-card rr-card-5">
                            <div className="rr-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                            </div>
                            <div className="rr-card-content">
                                <span className="rr-card-value">{summary.avgGuests || 0}</span>
                                <span className="rr-card-label">Avg Guests / Reservation</span>
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="rr-charts-row">
                        {/* Bar Chart - Reservations by Time */}
                        <div className="rr-chart-card">
                            <h3>📈 Reservations by Time</h3>
                            <div className="rr-bar-chart">
                                {sortedTimeEntries.length === 0 ? (
                                    <p className="rr-no-data">No time data available</p>
                                ) : sortedTimeEntries.map(([time, count]) => (
                                    <div key={time} className="rr-bar-item">
                                        <span className="rr-bar-label">{time}</span>
                                        <div className="rr-bar-track">
                                            <div className="rr-bar-fill" style={{ width: `${(count / maxTimeVal) * 100}%` }}>
                                                <span className="rr-bar-value">{count}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pie Chart - Reservations by Source */}
                        <div className="rr-chart-card">
                            <h3>📊 Reservations by Source</h3>
                            <div className="rr-pie-section">
                                <div className="rr-pie-visual">
                                    <svg viewBox="0 0 100 100" className="rr-pie-svg">
                                        {(() => {
                                            let cum = 0;
                                            return sourceEntries.map(([label, val], i) => {
                                                const pct = (val / sourceTotal) * 100;
                                                const start = cum;
                                                cum += pct;
                                                const startAngle = (start / 100) * 360 - 90;
                                                const endAngle = (cum / 100) * 360 - 90;
                                                const largeArc = pct > 50 ? 1 : 0;
                                                const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                                                const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                                                const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                                                const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                                                return (
                                                    <path
                                                        key={label}
                                                        d={`M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z`}
                                                        fill={pieColors[i % pieColors.length]}
                                                        stroke="#fff"
                                                        strokeWidth="1"
                                                    />
                                                );
                                            });
                                        })()}
                                    </svg>
                                </div>
                                <div className="rr-pie-legend">
                                    {sourceEntries.map(([label, val], i) => (
                                        <div key={label} className="rr-legend-item">
                                            <span className="rr-legend-dot" style={{ background: pieColors[i % pieColors.length] }}></span>
                                            <span className="rr-legend-label">{label}</span>
                                            <span className="rr-legend-value">{val} ({sourceTotal ? Math.round((val / sourceTotal) * 100) : 0}%)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="rr-tabs">
                        {tabs.map(tab => (
                            <button key={tab.id} className={`rr-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                                <span className="rr-tab-icon">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="rr-tab-content">
                        {/* Reservation List Tabs */}
                        {(activeTab === 'upcoming' || activeTab === 'today' || activeTab === 'completed') && (
                            <div className="rr-section">
                                <div className="rr-section-header">
                                    <h2>{activeTab === 'upcoming' ? 'Upcoming' : activeTab === 'today' ? "Today's" : 'Completed'} Reservations</h2>
                                    <div className="rr-search-box">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                        <input type="text" placeholder="Search guest, phone, table..." value={searchTerm} onChange={e => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))} />
                                        {searchTerm && <button className="rr-search-clear" onClick={() => setSearchTerm('')}>×</button>}
                                    </div>
                                </div>
                                <div className="rr-table-wrapper">
                                    <table className="rr-table">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th onClick={() => handleSort('guestName')}>Guest Name <SortIcon col="guestName" /></th>
                                                <th>Phone</th>
                                                <th onClick={() => handleSort('guests')}>Guests <SortIcon col="guests" /></th>
                                                <th>Table</th>
                                                <th onClick={() => handleSort('date')}>Date <SortIcon col="date" /></th>
                                                <th>Time</th>
                                                <th onClick={() => handleSort('status')}>Status <SortIcon col="status" /></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getTabData().length === 0 ? (
                                                <tr><td colSpan="8" className="rr-empty">No reservations found</td></tr>
                                            ) : getTabData().map((r, idx) => {
                                                const sc = getStatusColor(r.status);
                                                return (
                                                    <tr key={idx}>
                                                        <td className="rr-id">#{typeof r.id === 'string' ? r.id.slice(-6) : r.id}</td>
                                                        <td>
                                                            <div className="rr-guest-cell">
                                                                <div className="rr-avatar">{(r.guestName || '?')[0]?.toUpperCase()}</div>
                                                                <span className="rr-guest-name">{r.guestName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="rr-phone">{r.phone}</td>
                                                        <td className="rr-center">{r.guests}</td>
                                                        <td><span className="rr-table-badge">{r.tableName || `T-${r.tableNumber}`}</span></td>
                                                        <td className="rr-date">{r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</td>
                                                        <td className="rr-time">{r.startTime}{r.endTime && r.endTime !== '-' ? ` - ${r.endTime}` : ''}</td>
                                                        <td><span className="rr-status-badge" style={{ background: sc.bg, color: sc.color }}>{r.status}</span></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Guest History */}
                        {activeTab === 'guests' && (
                            <div className="rr-section">
                                <div className="rr-section-header">
                                    <h2>Guest Insights</h2>
                                </div>
                                <div className="rr-table-wrapper">
                                    <table className="rr-table">
                                        <thead>
                                            <tr>
                                                <th>Guest Name</th>
                                                <th>Phone</th>
                                                <th>Visits</th>
                                                <th>Total Guests Brought</th>
                                                <th>Last Visit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(data.guestInsights || []).length === 0 ? (
                                                <tr><td colSpan="5" className="rr-empty">No guest data available</td></tr>
                                            ) : (data.guestInsights || []).map((g, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        <div className="rr-guest-cell">
                                                            <div className="rr-avatar">{(g.name || '?')[0]?.toUpperCase()}</div>
                                                            <span className="rr-guest-name">{g.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="rr-phone">{g.phone}</td>
                                                    <td className="rr-center">
                                                        <span className="rr-visits-badge">{g.visits}</span>
                                                    </td>
                                                    <td className="rr-center">{g.totalGuests}</td>
                                                    <td className="rr-date">{g.lastVisit ? new Date(g.lastVisit).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Repeat Guests */}
                        {activeTab === 'repeat' && (
                            <div className="rr-section">
                                <div className="rr-section-header">
                                    <h2>Repeat Guests</h2>
                                    <span className="rr-badge-count">{(data.repeatGuests || []).length} repeat guests</span>
                                </div>
                                <div className="rr-repeat-grid">
                                    {(data.repeatGuests || []).length === 0 ? (
                                        <p className="rr-no-data">No repeat guests found</p>
                                    ) : (data.repeatGuests || []).map((g, i) => (
                                        <div key={i} className="rr-repeat-card">
                                            <div className="rr-repeat-avatar">{(g.name || '?')[0]?.toUpperCase()}</div>
                                            <div className="rr-repeat-info">
                                                <span className="rr-repeat-name">{g.name}</span>
                                                <span className="rr-repeat-phone">{g.phone}</span>
                                            </div>
                                            <div className="rr-repeat-stats">
                                                <span className="rr-repeat-visits">{g.visits} visits</span>
                                                <span className="rr-repeat-date">Last: {g.lastVisit ? new Date(g.lastVisit).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Table Utilization */}
                        {activeTab === 'tables' && (
                            <div className="rr-section">
                                <div className="rr-section-header">
                                    <h2>Table Utilization</h2>
                                </div>
                                <div className="rr-table-wrapper">
                                    <table className="rr-table">
                                        <thead>
                                            <tr>
                                                <th>Table</th>
                                                <th>Type</th>
                                                <th>Capacity</th>
                                                <th>Location</th>
                                                <th>Reservations</th>
                                                <th>Utilization</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(data.tableUtilization || []).length === 0 ? (
                                                <tr><td colSpan="6" className="rr-empty">No table data</td></tr>
                                            ) : (data.tableUtilization || []).map((t, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        <span className="rr-table-badge">{t.tableName || `Table ${t.tableNumber}`}</span>
                                                    </td>
                                                    <td><span className="rr-type-badge">{t.type}</span></td>
                                                    <td className="rr-center">{t.capacity} seats</td>
                                                    <td>{t.location}</td>
                                                    <td className="rr-center"><span className="rr-visits-badge">{t.reservationCount}</span></td>
                                                    <td>
                                                        <div className="rr-util-cell">
                                                            <div className="rr-util-bar-bg">
                                                                <div className="rr-util-bar-fill" style={{
                                                                    width: `${t.utilization}%`,
                                                                    background: t.utilization >= 70 ? '#16a34a' : t.utilization >= 40 ? '#f59e0b' : '#ef4444'
                                                                }} />
                                                            </div>
                                                            <span className="rr-util-pct">{t.utilization}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="rr-empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    <h3>Click "Generate Report" to load reservation data</h3>
                    <p>Select date range and filters to view reservation analytics</p>
                </div>
            )}
        </div>
    );
};

export default ReservationReport;

