import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasModuleAccess, MODULES } from '../config/rbac';
import './Sidebar.css';
import logo from '../assets/logo_new.jpg';

// Simple Icon Components
const Icons = {
    Dashboard: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    Rooms: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>, // Actually Home icon, let's use Bed if possible or sticking to generic
    // Bed Icon for Rooms
    Bed: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20M2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6M9 4v8m6-8v8m-12 4h18" /></svg>, // Simplified bed
    Reservation: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Meal: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    Menu: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    Config: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Add: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Users: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    Settings: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>,
    Report: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    Logout: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    Cashier: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    Analytics: () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Dot: () => <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /></svg>
};

const Sidebar = ({ isOpen, activeMenu, onMenuClick, onLogout, toggleSidebar }) => {
    const { user } = useAuth();
    const [openConfigDropdown, setOpenConfigDropdown] = useState(false);
    const [openReservationDropdown, setOpenReservationDropdown] = useState(false);
    const [openPropertySetupDropdown, setOpenPropertySetupDropdown] = useState(false);
    const [openPropertyConfigDropdown, setOpenPropertyConfigDropdown] = useState(false);
    const [openReportsDropdown, setOpenReportsDropdown] = useState(false);


    // Helper function to check if user has access to a module
    const canAccessModule = (moduleId) => {
        if (!user) return false;
        return hasModuleAccess(user, moduleId);
    };

    const isRestrictedAdmin = user?.role === 'admin' && Array.isArray(user?.permissions) && user.permissions.length > 0;
    const permissionLabels = Array.isArray(user?.permissions) ? user.permissions : [];
    const normalizedPermissionLabels = new Set(permissionLabels.map((label) => String(label || '').trim().toLowerCase()).filter(Boolean));
    const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';
    const hasExplicitAssignments = !isSuperAdmin && permissionLabels.length > 0;
    const hasPermissionLabel = (label) => normalizedPermissionLabels.has(String(label || '').trim().toLowerCase());

    const toggleDropdown = (id) => {
        if (id === 'proper-configuration') {
            setOpenConfigDropdown(!openConfigDropdown);
        } else if (id === 'reservations') {
            setOpenReservationDropdown(!openReservationDropdown);
        } else if (id === 'property-setup') {
            setOpenPropertySetupDropdown(!openPropertySetupDropdown);
        } else if (id === 'property-configuration') {
            setOpenPropertyConfigDropdown(!openPropertyConfigDropdown);
        } else if (id === MODULES.REPORTS || id === 'reports') {
            setOpenReportsDropdown(!openReportsDropdown);
        }
    };


    const menuItems = [
        { id: MODULES.DASHBOARD, iconVal: <Icons.Dashboard />, label: 'Dashboard' },
        { id: MODULES.ROOMS, iconVal: <Icons.Bed />, label: 'Rooms' },
        {
            id: MODULES.RESERVATIONS,
            iconVal: <Icons.Reservation />,
            label: 'Reservations',
            hasDropdown: true,
            dropdownItems: [
                { id: 'reservations-dashboard', label: 'Dashboard', iconVal: <Icons.Dot /> },
                { id: 'new-reservation', label: 'New Reservation', iconVal: <Icons.Dot /> },
                { id: MODULES.RESERVATION_CARD, label: 'Reservation Card', iconVal: <Icons.Dot /> }
            ]
        },
        { id: 'room-service', iconVal: <Icons.Reservation />, label: 'Room Service' },
        { id: 'housekeeping', iconVal: <Icons.Reservation />, label: 'Housekeeping View' },
        { id: MODULES.VIEW_ORDER, iconVal: <Icons.Report />, label: 'KOT Order' },
        { id: 'online-order-nav', accessModule: MODULES.VIEW_ORDER, iconVal: <Icons.Meal />, label: 'Online Order' },
        { id: MODULES.FOOD_ORDER, iconVal: <Icons.Meal />, label: 'Food Order' },
        { id: MODULES.CASHIER_SECTION, iconVal: <Icons.Cashier />, label: 'Cashier Section' },
        { id: MODULES.GUEST_MEAL_SERVICE, iconVal: <Icons.Meal />, label: 'Table View' },
        {
            id: MODULES.PROPERTY_SETUP,
            iconVal: <Icons.Config />,
            label: 'Property Setup',
            hasDropdown: true,
            dropdownItems: [
                { id: 'discount', label: 'Discount', iconVal: <Icons.Dot /> },
                { id: 'generate-room-qr', label: 'Generate Room QR', iconVal: <Icons.Dot /> }
            ]
        },
        {
            id: MODULES.PROPERTY_CONFIG,
            iconVal: <Icons.Config />,
            label: 'Property Configuration',
            hasDropdown: true,
            dropdownItems: [
                { id: 'floor-setup', label: 'Floor Setup', iconVal: <Icons.Dot /> },


                { id: 'room-facilities-type', label: 'Room Facilities Type', iconVal: <Icons.Dot /> },
                { id: 'meal-type', label: 'Meal Type', iconVal: <Icons.Dot /> },
                { id: 'reservation-type', label: 'Reservation Type', iconVal: <Icons.Dot /> },
                { id: 'extra-charges', label: 'Extra Charges', iconVal: <Icons.Dot /> },
                { id: 'complimentary-services', label: 'Complimentary Services', iconVal: <Icons.Dot /> },
                { id: 'customer-identity', label: 'Customer Identity', iconVal: <Icons.Dot /> },
                { id: 'booking-source', label: 'Booking Source', iconVal: <Icons.Dot /> },
                { id: 'business-source', label: 'Business Source', iconVal: <Icons.Dot /> },
                { id: 'maintenance-block', label: 'Maintenance Block', iconVal: <Icons.Dot /> },
                { id: 'company-settings', label: 'Company Settings', iconVal: <Icons.Dot /> },
                { id: MODULES.FOOD_MENU, label: 'Food Menu', iconVal: <Icons.Dot /> }
            ]
        },
        { id: MODULES.CUSTOMERS, iconVal: <Icons.Users />, label: 'Customer List' },
        { id: MODULES.CRM_MODEL, iconVal: <Icons.Users />, label: 'CRM Model' },
        {
            id: MODULES.REPORTS,
            iconVal: <Icons.Analytics />,
            label: 'Reports',
            hasDropdown: true,
            dropdownItems: [
                { id: MODULES.REPORTS_SALES, label: 'Sales', iconVal: <Icons.Dot /> },
                { id: MODULES.REPORTS_PAYMENTS, label: 'Payments', iconVal: <Icons.Dot /> },
                { id: MODULES.REPORTS_ROOMS, label: 'Rooms', iconVal: <Icons.Dot /> },
                { id: MODULES.REPORTS_KITCHEN, label: 'Kitchen', iconVal: <Icons.Dot /> },
                { id: MODULES.REPORTS_GST, label: 'GST & Tax', iconVal: <Icons.Dot /> },
                { id: MODULES.REPORTS_STAFF, label: 'Staff', iconVal: <Icons.Dot /> },
                { id: MODULES.REPORTS_BILLING, label: 'Billing', iconVal: <Icons.Dot /> },
                { id: MODULES.REPORTS_RESERVATIONS, label: 'Reservations', iconVal: <Icons.Dot /> },
                { id: MODULES.REPORTS_ANALYTICS, label: 'Analytics', iconVal: <Icons.Dot /> }
            ]
        }
    ];

    // Filter items based on role access FIRST - Check parent OR any child access
    const roleFilteredItems = menuItems.filter(item => {
        if (hasExplicitAssignments) {
            if (item.id === MODULES.VIEW_ORDER) {
                return hasPermissionLabel('KOT Order') || hasPermissionLabel('View order');
            }
            if (item.id === 'online-order-nav') {
                // Keep Online Order visible for admin panel even when explicit labels are partial.
                if (user?.role === 'admin') {
                    return canAccessModule(MODULES.VIEW_ORDER)
                        || hasPermissionLabel('Online Order')
                        || hasPermissionLabel('KOT Order')
                        || hasPermissionLabel('View order');
                }
                return hasPermissionLabel('Online Order');
            }
        }

        // ... previous logic
        if (item.hasDropdown) {
            const hasParentAccess = canAccessModule(item.accessModule || item.id);
            const hasChildAccess = item.dropdownItems.some(sub => canAccessModule(sub.id));
            return hasParentAccess || hasChildAccess;
        }
        return canAccessModule(item.accessModule || item.id);
    });

    // Auto-expand dropdown when sub-item is active
    useEffect(() => {
        if (!activeMenu) return;

        menuItems.forEach(item => {
            if (item.hasDropdown && item.dropdownItems.some(sub => sub.id === activeMenu)) {
                if (item.id === 'property-configuration') setOpenPropertyConfigDropdown(true);
                else if (item.id === 'property-setup') setOpenPropertySetupDropdown(true);
                else if (item.id === 'reservations') setOpenReservationDropdown(true);
                else if (item.id === 'proper-configuration') setOpenConfigDropdown(true);
                else if (item.id === MODULES.REPORTS || item.id === 'reports') setOpenReportsDropdown(true);
            }
        });
    }, [activeMenu]);

    return (
        <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
            {/* Logo with Close Button */}
            <div className="sidebar-logo-container">
                <img src={logo} alt="Bireena Atithi" className="sidebar-logo" />
                <button
                    className="sidebar-close-btn"
                    onClick={toggleSidebar}
                    type="button"
                    title="Close Sidebar"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <nav className="sidebar-nav">
                {roleFilteredItems.map((item) => {
                    const isOpenDropdown = item.id === MODULES.RESERVATIONS ? openReservationDropdown :
                        item.id === 'property-setup' ? openPropertySetupDropdown :
                            item.id === 'property-configuration' ? openPropertyConfigDropdown :
                                item.id === 'reports' ? openReportsDropdown :
                                    item.id === 'proper-configuration' ? openConfigDropdown : false;


                    const showDropdown = isOpenDropdown;

                    return item.hasDropdown ? (
                        <div key={item.id} className="nav-dropdown-wrapper">
                            <button
                                className={`nav-item nav-item-dropdown ${showDropdown ? 'dropdown-open' : ''} ${activeMenu === item.id ? 'active' : ''}`}
                                onClick={() => toggleDropdown(item.id)}            >
                                <span className="nav-icon">{item.iconVal}</span>
                                <span className="nav-label">{item.label}</span>
                                <svg
                                    className={`dropdown-arrow ${showDropdown ? 'rotated' : ''}`}
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            <div className={`nav-dropdown-menu ${showDropdown ? 'show' : ''}`}>
                                {item.dropdownItems.map((subItem) => {

                                    // For restricted admins, only explicitly assigned sub-screens should be visible.
                                    // For other roles, keep legacy parent-or-child behavior.
                                    const hasSubAccess = isRestrictedAdmin
                                        ? canAccessModule(subItem.id)
                                        : (canAccessModule(subItem.id) || canAccessModule(item.id));
                                    if (!hasSubAccess) return null;

                                    const isActive = activeMenu === subItem.id;
                                    return (
                                        <button
                                            key={subItem.id}
                                            className={`nav-dropdown-item ${isActive ? 'active' : ''}`}
                                            onClick={() => onMenuClick(subItem.id)}
                                        >
                                            <span className="nav-icon">{subItem.iconVal}</span>
                                            <span className="nav-label">{subItem.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <button
                            key={item.id}
                            className={`nav-item ${activeMenu === item.id ? 'active' : ''}`}
                            onClick={() => onMenuClick(item.id)}
                        >
                            <span className="nav-icon">{item.iconVal}</span>
                            <span className="nav-label">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <button className="logout-btn" onClick={onLogout}>
                <span className="nav-icon"><Icons.Logout /></span>
                <span className="nav-label">Logout</span>
            </button>
        </div>
    );
};

export default Sidebar;
