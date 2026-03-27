import { useState, useEffect } from 'react';
import API_URL, { apiCall } from '../../config/api';
import { useSettings } from '../../context/SettingsContext';
import './CashierReport.css';

const CashierReport = () => {
    const { getCurrencySymbol } = useSettings();
    const cs = getCurrencySymbol();
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch report data
    const fetchReportData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(
                `${API_URL}/api/cashier/report?startDate=${startDate}&endDate=${endDate}`
            );
            const result = await response.json();
            
            if (result.success) {
                setReportData(result.data);
            } else {
                setError(result.message || 'Failed to fetch report');
            }
        } catch (err) {
            console.error('Error fetching cashier report:', err);
            setError('Failed to fetch report data');
        } finally {
            setLoading(false);
        }
    };

    // Fetch data on component mount and when dates change
    useEffect(() => {
        fetchReportData();
    }, []);

    const handleGenerateReport = () => {
        fetchReportData();
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatDisplayDate = (dateString) => {
        const date = new Date(dateString);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    const handleDownloadCSV = () => {
        if (!reportData || !reportData.activityLog || reportData.activityLog.length === 0) {
            alert('No data to download');
            return;
        }

        // Prepare CSV content
        const headers = ['#', 'Date', 'Type', 'Amount', 'By', 'Reference', 'Notes'];
        const rows = reportData.activityLog.map((log, index) => [
            index + 1,
            formatDisplayDate(log.date),
            log.type,
            `${cs}${log.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            log.by,
            log.reference || '',
            log.notes || ''
        ]);

        // Create CSV string
        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `cashier_report_${startDate}_to_${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Initialize sample data (for testing)
    const initializeSampleData = async () => {
        try {
            const response = await apiCall(`/api/cashier/initialize-sample`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                alert('Sample data initialized successfully!');
                fetchReportData();
            } else {
                alert('Failed to initialize sample data');
            }
        } catch (err) {
            console.error('Error initializing sample data:', err);
            alert('Failed to initialize sample data');
        }
    };

    if (loading && !reportData) {
        return (
            <div className="cashier-report-container">
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <p>Loading report data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cashier-report-container">
            {/* Header Section */}
            <div className="cashier-report-header">
                <h1 className="cashier-report-title">Cashier Report</h1>
                <div className="header-actions">
                    <button className="generate-report-btn" onClick={handleGenerateReport} disabled={loading}>
                        {loading ? 'Loading...' : 'Generate Report'}
                    </button>
                    {/* Uncomment to add sample data button for testing */}
                    {/* <button className="init-sample-btn" onClick={initializeSampleData}>
                        Add Sample Data
                    </button> */}
                </div>
            </div>

            {/* Date Range Filters */}
            <div className="date-range-section">
                <div className="date-input-group">
                    <label className="date-label">START DATE</label>
                    <div className="date-input-wrapper">
                        <input
                            type="date"
                            className="date-input"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="calendar-icon">📅</span>
                    </div>
                </div>
                <span className="date-separator">-</span>
                <div className="date-input-group">
                    <label className="date-label">END DATE</label>
                    <div className="date-input-wrapper">
                        <input
                            type="date"
                            className="date-input"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                        <span className="calendar-icon">📅</span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    <p>{error}</p>
                </div>
            )}

            {!reportData && !loading && (
                <div className="no-data-message">
                    <p>No data available. Please select a date range and generate report.</p>
                    <button className="init-sample-btn" onClick={initializeSampleData}>
                        Initialize Sample Data
                    </button>
                </div>
            )}

            {reportData && (
                <>
                    {/* Summary Cards */}
                    <div className="summary-cards-grid">
                        <div className="summary-card green-card">
                            <div className="card-icon green-icon">💰</div>
                            <div className="card-content">
                                <h3 className="card-title">Total Collections</h3>
                                <p className="card-amount">{cs}{reportData.totalCollections.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                <p className="card-subtitle">Total Payments Received</p>
                                <p className="card-count">{reportData.totalPayments} payments</p>
                            </div>
                        </div>

                        <div className="summary-card red-card">
                            <div className="card-icon red-icon">{cs}</div>
                            <div className="card-content">
                                <h3 className="card-title">Total Payouts</h3>
                                <p className="card-amount">{cs}{reportData.totalPayouts.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                <p className="card-subtitle">Total Payments Made</p>
                                <p className="card-count">{reportData.totalPayoutsCount} payouts</p>
                            </div>
                        </div>

                        <div className="summary-card orange-card">
                            <div className="card-icon orange-icon">💵</div>
                            <div className="card-content">
                                <h3 className="card-title">Net Cash Flow</h3>
                                <p className="card-amount">{cs}{reportData.netCashFlow.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                <p className="card-subtitle">Collections - Payouts</p>
                                <p className="card-count">{reportData.netTransactions} total transactions</p>
                            </div>
                        </div>
                    </div>

                    {/* Summary Overview Section */}
                    <div className="summary-overview-section">
                        <h2 className="section-title">Summary Overview</h2>
                        
                        <div className="overview-grid">
                            <div className="overview-card">
                                <div className="overview-icon green-icon">💰</div>
                                <div className="overview-content">
                                    <h3 className="overview-title">Opening Balance</h3>
                                    <p className="overview-amount">{cs}{reportData.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <p className="overview-subtitle">Total Payments - Paid</p>
                                    <p className="overview-count">{reportData.openingPayments} payments</p>
                                </div>
                            </div>

                            <div className="overview-card">
                                <div className="overview-icon red-icon">{cs}</div>
                                <div className="overview-content">
                                    <h3 className="overview-title">Payments Received</h3>
                                    <p className="overview-amount">{cs}{reportData.totalCollections.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <p className="overview-subtitle">Total Payments Made</p>
                                    <p className="overview-count">{reportData.totalPayoutsCount} payouts</p>
                                </div>
                            </div>
                        </div>

                        <div className="overview-grid">
                            <div className="overview-card">
                                <div className="overview-icon green-icon">{cs}</div>
                                <div className="overview-content">
                                    <h3 className="overview-title">Closing Balance</h3>
                                    <p className="overview-amount">{cs}{reportData.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>

                            <div className="overview-card">
                                <div className="overview-icon red-icon">{cs}</div>
                                <div className="overview-content">
                                    <h3 className="overview-title">Closing Balance</h3>
                                    <p className="overview-amount">{cs}{reportData.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Transaction Breakdown Section */}
                    <div className="transaction-breakdown-section">
                        <h2 className="section-title">Transaction Breakdown</h2>
                        
                        <div className="breakdown-grid">
                            {/* Payments Received */}
                            <div className="breakdown-column">
                                <h3 className="breakdown-subtitle">Payments Received</h3>
                                <div className="breakdown-items">
                                    <div className="breakdown-item">
                                        <span className="item-label">
                                            <span className="item-icon green">ⓘ</span>
                                            Cash
                                        </span>
                                        <span className="item-amount green-text">{cs}{reportData.paymentsReceived.cash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="breakdown-item">
                                        <span className="item-label">
                                            <span className="item-icon green">ⓘ</span>
                                            Card
                                        </span>
                                        <span className="item-amount green-text">{cs}{reportData.paymentsReceived.card.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="breakdown-item">
                                        <span className="item-label">
                                            <span className="item-icon green">ⓘ</span>
                                            UPI
                                        </span>
                                        <span className="item-amount green-text">{cs}{reportData.paymentsReceived.upi.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="breakdown-item">
                                        <span className="item-label">
                                            <span className="item-icon green">ⓘ</span>
                                            Bank Transfer
                                        </span>
                                        <span className="item-amount green-text">{cs}{reportData.paymentsReceived.bankTransfer.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Payments Made */}
                            <div className="breakdown-column">
                                <h3 className="breakdown-subtitle">Payments Made</h3>
                                <div className="breakdown-items">
                                    <div className="breakdown-item">
                                        <span className="item-label">
                                            <span className="item-icon red">ⓘ</span>
                                            Cash
                                        </span>
                                        <span className="item-amount red-text">{cs}{reportData.paymentsMade.cash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="breakdown-item">
                                        <span className="item-label">
                                            <span className="item-icon red">ⓘ</span>
                                            Expense Paid
                                        </span>
                                        <span className="item-amount red-text">{cs}{reportData.paymentsMade.expensePaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="breakdown-item">
                                        <span className="item-label">
                                            <span className="item-icon red">ⓘ</span>
                                            Refunds
                                        </span>
                                        <span className="item-amount red-text">{cs}{reportData.paymentsMade.refunds.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="breakdown-item">
                                        <span className="item-label">
                                            <span className="item-icon red">ⓘ</span>
                                            Salaries
                                        </span>
                                        <span className="item-amount red-text">{cs}{reportData.paymentsMade.salaries.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Activity Log Section */}
                    <div className="activity-log-section">
                        <div className="activity-log-header">
                            <h2 className="section-title">Activity Log</h2>
                            <button 
                                className="download-csv-btn" 
                                onClick={handleDownloadCSV}
                                disabled={!reportData.activityLog || reportData.activityLog.length === 0}
                            >
                                ⬇️ Download CSV
                            </button>
                        </div>

                        <div className="activity-log-table-wrapper">
                            <table className="activity-log-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Amount</th>
                                        <th>By / Reference</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.activityLog && reportData.activityLog.length > 0 ? (
                                        reportData.activityLog.map((log, index) => (
                                            <tr key={log.id || index}>
                                                <td>
                                                    <div className={`log-number ${log.category === 'collection' ? 'green' : 'red'}`}>
                                                        {cs}
                                                    </div>
                                                </td>
                                                <td>{formatDisplayDate(log.date)}</td>
                                                <td>{log.type}</td>
                                                <td>{cs}{log.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td>
                                                    <div className="reference-cell">
                                                        <div>{log.by}</div>
                                                        {log.reference && <div className="reference-code">{log.reference}</div>}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="notes-cell">
                                                        {log.notes}
                                                        <span className="arrow-icon">›</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                                                No transactions found for the selected date range
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CashierReport;
