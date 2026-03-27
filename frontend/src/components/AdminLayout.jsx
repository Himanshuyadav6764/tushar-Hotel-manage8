import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import AdminNavbar from './AdminNavbar';
import './AdminLayout.css';

const AdminLayout = ({ children, activeMenu, onMenuClick, onLogout, noPadding = false }) => {
    const { sidebarOpen, setSidebarOpen } = useAuth();
    const collapseBreakpoint = 1200;

    // Auto-close sidebar on mobile/tablet viewports
    useEffect(() => {
        let prevWidth = window.innerWidth;
        const handleResize = () => {
            const currWidth = window.innerWidth;
            if (currWidth <= collapseBreakpoint && prevWidth > collapseBreakpoint) {
                setSidebarOpen(false);
            }
            prevWidth = currWidth;
        };

        // Check on initial mount
        if (window.innerWidth <= collapseBreakpoint) {
            setSidebarOpen(false);
        }

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [setSidebarOpen]);

    const handleSidebarMenuClick = (menuId) => {
        onMenuClick?.(menuId);
        if (window.innerWidth <= collapseBreakpoint) {
            setSidebarOpen(false);
        }
    };

    const handleSidebarLogout = () => {
        onLogout?.();
        if (window.innerWidth <= collapseBreakpoint) {
            setSidebarOpen(false);
        }
    };

    return (
        <div className="admin-layout">
            <AdminNavbar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
            />

            <Sidebar
                isOpen={sidebarOpen}
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                activeMenu={activeMenu}
                onMenuClick={handleSidebarMenuClick}
                onLogout={handleSidebarLogout}
            />

            {sidebarOpen && (
                <button
                    type="button"
                    className="sidebar-backdrop"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close sidebar"
                />
            )}

            <div className={`main-content ${sidebarOpen ? '' : 'full-width'} ${noPadding ? 'no-padding' : ''} ${activeMenu}-page-layout`}>
                <div className={`layout-content ${noPadding ? 'no-padding' : ''}`}>
                    {noPadding ? children : <div className="layout-main-card">{children}</div>}
                </div>
            </div>
        </div>
    );
};

export default AdminLayout;


 