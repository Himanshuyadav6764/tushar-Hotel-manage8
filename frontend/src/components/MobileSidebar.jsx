import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Home, User, Settings, Tag, Mail, ChevronRight } from 'lucide-react';
import Logo from '../assets/logo_new.jpg';
import './Navbar.css';

const NAV_LINKS = [
  { to: '/', label: 'Home', icon: <Home size={18} /> },
  { to: '/about', label: 'About', icon: <User size={18} /> },
  { to: '/features', label: 'Features', icon: <Settings size={18} /> },
  { to: '/pricing', label: 'Pricing', icon: <Tag size={18} /> },
  { to: '/contact', label: 'Contact Us', icon: <Mail size={18} /> },
];

function MobileSidebar({ active, onClose }) {
  return (
    <>
      <nav id="sidebarNav" className={active ? 'active' : ''}>
        <div className="sidebar-drawer-header">
          <img src={Logo} alt="Bireena Atithi" className="sidebar-drawer-logo" />
          <button className="sidebar-drawer-close" onClick={onClose} aria-label="Close menu">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ul className="sidebar-drawer-menu">
          {NAV_LINKS.map(({ to, label, icon }, index) => (
            <li key={to} className="sidebar-drawer-item" style={{ animationDelay: `${index * 0.05}s` }}>
              <NavLink
                to={to}
                end={to === '/'}
                onClick={() => { window.scrollTo({ top: 0, behavior: 'instant' }); onClose(); }}
                className={({ isActive }) => (isActive ? 'sidebar-drawer-link active' : 'sidebar-drawer-link')}
              >
                <span className="sidebar-drawer-icon">{icon}</span>
                <span className="sidebar-drawer-text">{label}</span>
                <ChevronRight size={16} className="sidebar-drawer-arrow" />
              </NavLink>
            </li>
          ))}
        </ul>
        
        <div className="sidebar-drawer-footer">
          <Link
            to="/login"
            className="sidebar-drawer-btn"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'instant' });
              onClose();
            }}
          >
            Book a Free Demo
          </Link>
        </div>
      </nav>

      <div className={`menu-overlay ${active ? 'active' : ''}`} onClick={onClose} aria-hidden="true" />
    </>
  );
}

export default MobileSidebar;
