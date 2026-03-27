import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import './Navbar.css';
import Logo from '../assets/logo_new.jpg';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact Us' },
];

const NavItem = ({ to, children, onClick }) => {
  const handleClick = (e) => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (onClick) onClick(e);
  };

  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={handleClick}
      className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
      style={{
        textDecoration: "none",
        transition: "all 0.3s ease",
      }}
    >
      {children}
    </NavLink>
  );
};

function Navbar() {
  const [sidebarActive, setSidebarActive] = useState(false);

  const toggleSidebar = () => {
    setSidebarActive(!sidebarActive);
  };

  const closeSidebar = () => {
    setSidebarActive(false);
  };

  useEffect(() => {
    if (sidebarActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [sidebarActive]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900 && sidebarActive) {
        closeSidebar();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.style.overflow = 'auto';
    };
  }, [sidebarActive]);

  return (
    <>
      <header className="navbar landing-navbar">
        <div className="container nav-flex">
          <Link to="/" className="logo-link" onClick={() => { window.scrollTo(0, 0); closeSidebar(); }}>
            <img src={Logo} alt="Bireena Atithi" className="navbar-logo" />
          </Link>

          <button
            className="hamburger"
            onClick={toggleSidebar}
            aria-label={sidebarActive ? 'Close menu' : 'Open menu'}
            aria-expanded={sidebarActive}
            aria-controls="sidebarNav"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Desktop nav — stays inside header */}
          <nav className="desktop-nav">
            <ul className="nav-menu">
              {NAV_LINKS.map(({ to, label }) => (
                <li key={to} className="nav-item">
                  <NavItem to={to}>{label}</NavItem>
                </li>
              ))}
            </ul>
            <div className="nav-secondary">
              <Link
                to="/login"
                className="demo-btn"
                onClick={() => { window.scrollTo({ top: 0, behavior: 'instant' }); }}
              >
                Book a Free Demo
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile sidebar — outside header to avoid stacking context issues */}
      <nav id="sidebarNav" className={sidebarActive ? 'active' : ''}>
        <button className="sidebar-close-btn" onClick={closeSidebar} aria-label="Close menu">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="24" height="24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <ul className="nav-menu">
          {NAV_LINKS.map(({ to, label }) => (
            <li key={to} className="nav-item">
              <NavItem to={to} onClick={closeSidebar}>{label}</NavItem>
            </li>
          ))}
        </ul>
        <div className="nav-secondary">
          <Link
            to="/login"
            className="demo-btn"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'instant' });
              closeSidebar();
            }}
          >
            Book a Free Demo
          </Link>
        </div>
      </nav>

      <div className={`menu-overlay ${sidebarActive ? 'active' : ''}`} onClick={closeSidebar} aria-hidden="true" />
    </>
  );
}
export default Navbar;
