import { Link } from "react-router-dom";
import "./footer.css";
import logo from "../assets/logo_new.jpg";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaGlobe } from 'react-icons/fa';

const Footer = () => {
  const supportEmail = "bireenainfo@gmail.com";
  const supportAddress = "B36, Mitra Mandal Colony, Vashist Colony, Anisabad, Patna, Bihar 800002";
  const gmailComposeLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supportEmail)}&su=${encodeURIComponent("Inquiry from website")}`;

  return (
    <footer className="footer-section">
      <div className="footer-container">
        <div className="footer-top">
          {/* Column 1: Logo & Description */}
          <div className="footer-col brand-col">
            <div className="logo-wrapper">
              <img src={logo} alt="Bireena Atithi" className="footer-logo-img" />
            </div>
            <p className="brand-desc">
              Smart Hotel Management Software with KOT automation, billing, reporting and seamless guest experience.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/features">Features</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>

          {/* Column 3: Services */}
          <div className="footer-col">
            <h4>Services</h4>
            <ul>
              <li><Link to="/">Reservation Management</Link></li>
              <li><Link to="/">Billing & Invoicing</Link></li>
              <li><Link to="/">KOT Automation</Link></li>
              <li><Link to="/">Analytics & Reports</Link></li>
            </ul>
          </div>

          {/* Column 4: Contact Us */}
          <div className="footer-col contact-col">
            <h4>Contact Us</h4>
            <div className="contact-info">
              <p>Address: <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supportAddress)}`} target="_blank" rel="noopener noreferrer">{supportAddress}</a></p>
              <p>Phone: <a href="tel:9304942225">9304942225</a></p>
              <p>Email: <a href={gmailComposeLink} target="_blank" rel="noopener noreferrer">{supportEmail}</a></p>
            </div>
            <div className="social-icons">
              <a href="https://www.facebook.com/profile.php?id=61572904348705" target="_blank" rel="noopener noreferrer"><FaFacebookF /></a>
              <a href="https://www.instagram.com/bireenainfo/" target="_blank" rel="noopener noreferrer"><FaInstagram /></a>
              <a href="https://www.linkedin.com/in/bireena-info-tech-a975533a1/" target="_blank" rel="noopener noreferrer"><FaLinkedinIn /></a>
              <a href="https://bireenainfotech.com/" target="_blank" rel="noopener noreferrer"><FaGlobe /></a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 Bireena Atithi. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
