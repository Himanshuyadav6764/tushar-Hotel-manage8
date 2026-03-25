import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import API_URL from '../../config/api';
import './StaffReport.css';

const StaffReport = () => {
    const { user } = useAuth();
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [activeTab, setActiveTab] = useState('performance');
    const [filters, setFilters] = useState({
        department: 'All',
        role: 'All',
        shift: 'All'
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'performance', direction: 'desc' });
    const printRef = useRef();

    const tabs = [
        { id: 'performance', label: 'Staff Performance', icon: '📊' },
        { id: 'attendance', label: 'Attendance Overview', icon: '📋' },
        { id: 'distribution', label: 'Department & Roles', icon: '🏢' },
        { id: 'payroll', label: 'Payroll Summary', icon: '💰' }
    ];

    const DEPARTMENTS = ['All', 'Dine-In', 'Room Service', 'Bar', 'Pool', 'Garden', 'Banquet', 'Conference', 'Reception', 'Housekeeping', 'Maintenance', 'Security', 'Kitchen', 'General'];
    const ROLES = ['All', 'admin', 'staff', 'waiter', 'manager', 'receptionist', 'chef', 'housekeeping'];
    const SHIFTS = ['All', 'Morning', 'Evening', 'Night'];

    useEffect(() => {
        fetchReport();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.department !== 'All') params.append('department', filters.department);
            if (filters.role !== 'All') params.append('role', filters.role);
            if (filters.shift !== 'All') params.append('shift', filters.shift);

            const res = await axios.get(`${API_URL}/api/staff-report?${params.toString()}`);
            setReportData(res.data);
        } catch (err) {
            console.error('Staff report error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleGenerateReport = () => {
        fetchReport();
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortedStaff = () => {
        if (!reportData?.staffDetails) return [];
        let filtered = [...reportData.staffDetails];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(term) ||
                s.role.toLowerCase().includes(term) ||
                s.outlet.toLowerCase().includes(term)
            );
        }

        filtered.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    };

    const getPerformanceColor = (val) => {
        if (val >= 4) return '#10b981';
        if (val >= 3) return '#f59e0b';
        if (val >= 2) return '#f97316';
        return '#ef4444';
    };

    const getAttendanceBadge = (status) => {
        const map = {
            'Present': { bg: '#dcfce7', color: '#166534', label: 'Present' },
            'Absent': { bg: '#fee2e2', color: '#991b1b', label: 'Absent' },
            'On Leave': { bg: '#fef3c7', color: '#92400e', label: 'On Leave' }
        };
        return map[status] || map['Present'];
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportCSV = () => {
        if (!sortedStaff.length) return;
        const headers = ['Name', 'Role', 'Department', 'Shift', 'Attendance', 'Performance', 'Salary'];
        const rows = sortedStaff.map(s => [
            s.name, s.role, s.outlet, s.shift, s.attendance, s.performance, s.salary
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `staff-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportExcel = () => {
        if (!sortedStaff.length) return;

        const headers = ['Name', 'Role', 'Department', 'Shift', 'Attendance', 'Performance', 'Salary'];
        const rows = sortedStaff.map(s => [
            s.name,
            s.role,
            s.outlet,
            s.shift,
            s.attendance,
            s.performance,
            `${cs}${Number(s.salary || 0).toFixed(2)}`
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
                <h3>Staff Report</h3>
                <table>
                    <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
                    <tbody>${rows.map(r => `<tr>${r.map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>
                </table>
            </body></html>`;

        const blob = new Blob([`\ufeff${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `staff-report-${new Date().toISOString().split('T')[0]}.xls`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = () => {
        if (!sortedStaff.length) return;

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const headers = ['Name', 'Role', 'Department', 'Shift', 'Attendance', 'Performance', 'Salary'];
        const rows = sortedStaff.map(s => [
            String(s.name || '-'),
            String(s.role || '-'),
            String(s.outlet || '-'),
            String(s.shift || '-'),
            String(s.attendance || '-'),
            String(s.performance || '-'),
            `${cs}${Number(s.salary || 0).toFixed(2)}`
        ]);

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
            doc.text('Staff Report', margin, 10);
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

        doc.save(`staff-report-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const summary = reportData?.summary || {};
    const distributions = reportData?.distributions || {};
    const sortedStaff = getSortedStaff();

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <span className="sr-sort-icon">↕</span>;
        return <span className="sr-sort-icon active">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="sr-container" ref={printRef}>
            {/* Header */}
            <div className="sr-header">
                <div className="sr-header-left">
                    <h1 className="sr-title">Staff Reports</h1>
                    <p className="sr-subtitle">Real-time staff performance & attendance analytics</p>
                </div>
                <div className="sr-header-actions">
                    <button className="sr-btn sr-btn-outline" onClick={handleExportExcel}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export Excel
                    </button>
                    <button className="sr-btn sr-btn-outline" onClick={handleExportPDF}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Export PDF
                    </button>
                    <button className="sr-btn sr-btn-outline" onClick={handlePrint}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        Print
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="sr-filters-bar">
                <div className="sr-filter-group">
                    <label>Department</label>
                    <select value={filters.department} onChange={e => handleFilterChange('department', e.target.value)}>
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div className="sr-filter-group">
                    <label>Role</label>
                    <select value={filters.role} onChange={e => handleFilterChange('role', e.target.value)}>
                        {ROLES.map(r => <option key={r} value={r}>{r === 'All' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                </div>
                <div className="sr-filter-group">
                    <label>Shift</label>
                    <select value={filters.shift} onChange={e => handleFilterChange('shift', e.target.value)}>
                        {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <button className="sr-btn sr-btn-primary" onClick={handleGenerateReport}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
                    Generate Report
                </button>
            </div>

            {loading ? (
                <div className="sr-loading">
                    <div className="sr-spinner"></div>
                    <p>Loading staff data...</p>
                </div>
            ) : reportData ? (
                <>
                    {/* Summary Cards */}
                    <div className="sr-summary-grid">
                        <div className="sr-card sr-card-total">
                            <div className="sr-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                            </div>
                            <div className="sr-card-content">
                                <span className="sr-card-value">{summary.totalStaff || 0}</span>
                                <span className="sr-card-label">Total Staff</span>
                            </div>
                        </div>
                        <div className="sr-card sr-card-active">
                            <div className="sr-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            </div>
                            <div className="sr-card-content">
                                <span className="sr-card-value">{summary.presentToday || 0}</span>
                                <span className="sr-card-label">Present Today</span>
                            </div>
                        </div>
                        <div className="sr-card sr-card-performance">
                            <div className="sr-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            </div>
                            <div className="sr-card-content">
                                <span className="sr-card-value">{summary.avgPerformance || 0}<small>/5</small></span>
                                <span className="sr-card-label">Avg Performance</span>
                            </div>
                        </div>
                        <div className="sr-card sr-card-top">
                            <div className="sr-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                            </div>
                            <div className="sr-card-content">
                                <span className="sr-card-value sr-card-value-name">{summary.topPerformer?.name || '-'}</span>
                                <span className="sr-card-label">Top Performer ({summary.topPerformer?.performance || 0}★)</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="sr-tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`sr-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <span className="sr-tab-icon">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="sr-tab-content">
                        {activeTab === 'performance' && (
                            <div className="sr-section">
                                <div className="sr-section-header">
                                    <h2>Staff Performance</h2>
                                    <div className="sr-search-box">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                        <input
                                            type="text"
                                            placeholder="Search staff..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9\\s]/g, ''))}
                                        />
                                        {searchTerm && (
                                            <button className="sr-search-clear" onClick={() => setSearchTerm('')}>×</button>
                                        )}
                                    </div>
                                </div>
                                <div className="sr-table-wrapper">
                                    <table className="sr-table">
                                        <thead>
                                            <tr>
                                                <th onClick={() => handleSort('name')}>Staff Name <SortIcon columnKey="name" /></th>
                                                <th onClick={() => handleSort('role')}>Role <SortIcon columnKey="role" /></th>
                                                <th onClick={() => handleSort('outlet')}>Department <SortIcon columnKey="outlet" /></th>
                                                <th onClick={() => handleSort('shift')}>Shift <SortIcon columnKey="shift" /></th>
                                                <th onClick={() => handleSort('attendance')}>Status <SortIcon columnKey="attendance" /></th>
                                                <th onClick={() => handleSort('performance')}>Performance <SortIcon columnKey="performance" /></th>
                                                <th onClick={() => handleSort('salary')}>Salary <SortIcon columnKey="salary" /></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedStaff.length === 0 ? (
                                                <tr><td colSpan="7" className="sr-empty">No staff found</td></tr>
                                            ) : sortedStaff.map(staff => {
                                                const badge = getAttendanceBadge(staff.attendance);
                                                return (
                                                    <tr key={staff._id} className={!staff.isActive ? 'sr-inactive-row' : ''}>
                                                        <td>
                                                            <div className="sr-staff-cell">
                                                                <div className="sr-avatar" style={{ background: getPerformanceColor(staff.performance) }}>
                                                                    {staff.name?.charAt(0)?.toUpperCase() || '?'}
                                                                </div>
                                                                <div>
                                                                    <span className="sr-staff-name">{staff.name}</span>
                                                                    {!staff.isActive && <span className="sr-inactive-badge">Inactive</span>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td><span className="sr-role-badge">{staff.role}</span></td>
                                                        <td>{staff.outlet}</td>
                                                        <td>
                                                            <span className={`sr-shift-badge sr-shift-${staff.shift?.toLowerCase()}`}>
                                                                {staff.shift}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="sr-attendance-badge" style={{ background: badge.bg, color: badge.color }}>
                                                                {badge.label}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="sr-performance-cell">
                                                                <div className="sr-performance-bar-bg">
                                                                    <div
                                                                        className="sr-performance-bar-fill"
                                                                        style={{
                                                                            width: `${(staff.performance / 5) * 100}%`,
                                                                            background: getPerformanceColor(staff.performance)
                                                                        }}
                                                                    />
                                                                </div>
                                                                <span className="sr-performance-value" style={{ color: getPerformanceColor(staff.performance) }}>
                                                                    {staff.performance}/5
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="sr-salary">{cs}{staff.salary?.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'attendance' && (
                            <div className="sr-section">
                                <div className="sr-section-header">
                                    <h2>Attendance Overview</h2>
                                </div>
                                <div className="sr-attendance-grid">
                                    <div className="sr-att-card sr-att-present">
                                        <div className="sr-att-number">{summary.presentToday || 0}</div>
                                        <div className="sr-att-label">Present</div>
                                        <div className="sr-att-bar">
                                            <div className="sr-att-bar-fill" style={{
                                                width: `${summary.totalStaff ? (summary.presentToday / summary.totalStaff * 100) : 0}%`
                                            }} />
                                        </div>
                                        <div className="sr-att-percent">
                                            {summary.totalStaff ? Math.round(summary.presentToday / summary.totalStaff * 100) : 0}%
                                        </div>
                                    </div>
                                    <div className="sr-att-card sr-att-absent">
                                        <div className="sr-att-number">{summary.absent || 0}</div>
                                        <div className="sr-att-label">Absent</div>
                                        <div className="sr-att-bar">
                                            <div className="sr-att-bar-fill" style={{
                                                width: `${summary.totalStaff ? (summary.absent / summary.totalStaff * 100) : 0}%`
                                            }} />
                                        </div>
                                        <div className="sr-att-percent">
                                            {summary.totalStaff ? Math.round(summary.absent / summary.totalStaff * 100) : 0}%
                                        </div>
                                    </div>
                                    <div className="sr-att-card sr-att-leave">
                                        <div className="sr-att-number">{summary.onLeave || 0}</div>
                                        <div className="sr-att-label">On Leave</div>
                                        <div className="sr-att-bar">
                                            <div className="sr-att-bar-fill" style={{
                                                width: `${summary.totalStaff ? (summary.onLeave / summary.totalStaff * 100) : 0}%`
                                            }} />
                                        </div>
                                        <div className="sr-att-percent">
                                            {summary.totalStaff ? Math.round(summary.onLeave / summary.totalStaff * 100) : 0}%
                                        </div>
                                    </div>
                                </div>

                                {/* Attendance Table */}
                                <div className="sr-table-wrapper" style={{ marginTop: '24px' }}>
                                    <table className="sr-table">
                                        <thead>
                                            <tr>
                                                <th>Staff Name</th>
                                                <th>Role</th>
                                                <th>Department</th>
                                                <th>Shift</th>
                                                <th>Today's Status</th>
                                                <th>Join Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedStaff.map(staff => {
                                                const badge = getAttendanceBadge(staff.attendance);
                                                return (
                                                    <tr key={staff._id}>
                                                        <td>
                                                            <div className="sr-staff-cell">
                                                                <div className="sr-avatar" style={{ background: getPerformanceColor(staff.performance) }}>
                                                                    {staff.name?.charAt(0)?.toUpperCase() || '?'}
                                                                </div>
                                                                <span className="sr-staff-name">{staff.name}</span>
                                                            </div>
                                                        </td>
                                                        <td><span className="sr-role-badge">{staff.role}</span></td>
                                                        <td>{staff.outlet}</td>
                                                        <td>
                                                            <span className={`sr-shift-badge sr-shift-${staff.shift?.toLowerCase()}`}>
                                                                {staff.shift}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="sr-attendance-badge" style={{ background: badge.bg, color: badge.color }}>
                                                                {badge.label}
                                                            </span>
                                                        </td>
                                                        <td className="sr-date">{staff.joinDate ? new Date(staff.joinDate).toLocaleDateString('en-IN') : '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'distribution' && (
                            <div className="sr-section">
                                <div className="sr-section-header">
                                    <h2>Department & Role Distribution</h2>
                                </div>
                                <div className="sr-dist-grid">
                                    {/* Role Distribution */}
                                    <div className="sr-dist-card">
                                        <h3>By Role</h3>
                                        <div className="sr-dist-bars">
                                            {Object.entries(distributions.role || {}).map(([role, count]) => (
                                                <div key={role} className="sr-dist-item">
                                                    <div className="sr-dist-label">
                                                        <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                                                        <span className="sr-dist-count">{count}</span>
                                                    </div>
                                                    <div className="sr-dist-bar-bg">
                                                        <div
                                                            className="sr-dist-bar-fill"
                                                            style={{
                                                                width: `${(count / summary.totalStaff) * 100}%`
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Department Distribution */}
                                    <div className="sr-dist-card">
                                        <h3>By Department</h3>
                                        <div className="sr-dist-bars">
                                            {Object.entries(distributions.department || {}).map(([dept, count]) => (
                                                <div key={dept} className="sr-dist-item">
                                                    <div className="sr-dist-label">
                                                        <span>{dept}</span>
                                                        <span className="sr-dist-count">{count}</span>
                                                    </div>
                                                    <div className="sr-dist-bar-bg">
                                                        <div
                                                            className="sr-dist-bar-fill sr-dist-dept"
                                                            style={{
                                                                width: `${(count / summary.totalStaff) * 100}%`
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Shift Distribution */}
                                    <div className="sr-dist-card sr-dist-full">
                                        <h3>By Shift</h3>
                                        <div className="sr-shift-cards">
                                            {Object.entries(distributions.shift || {}).map(([shift, count]) => (
                                                <div key={shift} className={`sr-shift-card sr-shift-card-${shift.toLowerCase()}`}>
                                                    <div className="sr-shift-card-count">{count}</div>
                                                    <div className="sr-shift-card-label">{shift}</div>
                                                    <div className="sr-shift-card-time">
                                                        {shift === 'Morning' ? '6AM - 2PM' : shift === 'Evening' ? '2PM - 10PM' : '10PM - 6AM'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'payroll' && (
                            <div className="sr-section">
                                <div className="sr-section-header">
                                    <h2>Payroll Summary</h2>
                                </div>
                                <div className="sr-payroll-summary">
                                    <div className="sr-payroll-card">
                                        <div className="sr-payroll-label">Total Monthly Payroll</div>
                                        <div className="sr-payroll-amount">{cs}{(summary.totalSalary || 0).toLocaleString()}</div>
                                    </div>
                                    <div className="sr-payroll-card">
                                        <div className="sr-payroll-label">Active Staff</div>
                                        <div className="sr-payroll-amount">{summary.activeStaff || 0}</div>
                                    </div>
                                    <div className="sr-payroll-card">
                                        <div className="sr-payroll-label">Avg Salary</div>
                                        <div className="sr-payroll-amount">
                                            {cs}{summary.totalStaff ? Math.round(summary.totalSalary / summary.totalStaff).toLocaleString() : 0}
                                        </div>
                                    </div>
                                </div>

                                <div className="sr-table-wrapper" style={{ marginTop: '24px' }}>
                                    <table className="sr-table">
                                        <thead>
                                            <tr>
                                                <th onClick={() => handleSort('name')}>Staff Name <SortIcon columnKey="name" /></th>
                                                <th onClick={() => handleSort('role')}>Role <SortIcon columnKey="role" /></th>
                                                <th onClick={() => handleSort('outlet')}>Department <SortIcon columnKey="outlet" /></th>
                                                <th onClick={() => handleSort('shift')}>Shift <SortIcon columnKey="shift" /></th>
                                                <th onClick={() => handleSort('performance')}>Performance <SortIcon columnKey="performance" /></th>
                                                <th onClick={() => handleSort('salary')}>Salary <SortIcon columnKey="salary" /></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedStaff.map(staff => (
                                                <tr key={staff._id}>
                                                    <td>
                                                        <div className="sr-staff-cell">
                                                            <div className="sr-avatar" style={{ background: getPerformanceColor(staff.performance) }}>
                                                                {staff.name?.charAt(0)?.toUpperCase() || '?'}
                                                            </div>
                                                            <span className="sr-staff-name">{staff.name}</span>
                                                        </div>
                                                    </td>
                                                    <td><span className="sr-role-badge">{staff.role}</span></td>
                                                    <td>{staff.outlet}</td>
                                                    <td>
                                                        <span className={`sr-shift-badge sr-shift-${staff.shift?.toLowerCase()}`}>
                                                            {staff.shift}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="sr-performance-value" style={{ color: getPerformanceColor(staff.performance) }}>
                                                            {staff.performance}/5 ★
                                                        </span>
                                                    </td>
                                                    <td className="sr-salary-highlight">{cs}{staff.salary?.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {sortedStaff.length > 0 && (
                                                <tr className="sr-total-row">
                                                    <td colSpan="5" style={{ textAlign: 'right', fontWeight: 700 }}>Total Payroll</td>
                                                    <td className="sr-salary-highlight" style={{ fontWeight: 700 }}>
                                                        {cs}{sortedStaff.reduce((sum, s) => sum + (s.salary || 0), 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="sr-empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    <h3>Click "Generate Report" to load staff data</h3>
                    <p>Select filters and click generate to view staff performance analytics</p>
                </div>
            )}
        </div>
    );
};

export default StaffReport;

