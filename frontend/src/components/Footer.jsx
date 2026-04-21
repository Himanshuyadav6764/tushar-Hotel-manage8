import React from "react";
import { Link } from "react-router-dom";
import {
    Facebook,
    Instagram,
    Linkedin,
    Youtube,
    MapPin,
    Phone,
    Mail,
    ArrowRight,
    Sparkles
} from "lucide-react";
import Reveal from "./Reveal";
import "./footer.css";
import FooterLogo from "../assets/footer-logo.png";

const Footer = () => {
    const currentYear = new Date().getFullYear();
    const supportEmail = "bireenainfo@gmail.com";
    const supportAddress = "B36, Mitra Mandal Colony, Vashist Colony, Anisabad, Patna, Bihar 800002";
    const gmailComposeLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supportEmail)}&su=${encodeURIComponent("Inquiry from Bireena Atithi website")}`;
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supportAddress)}`;

    const socialLinks = [
        { icon: <Facebook size={18} />, href: "https://www.facebook.com/people/Bireena-Bireena/61572904348705/", label: "facebook" },
        { icon: <Instagram size={18} />, href: "https://www.instagram.com/bireenainfo/", label: "instagram" },
        { icon: <Linkedin size={18} />, href: "https://www.linkedin.com/in/bireena-info-tech-a975533a1/", label: "linkedin" },
        { icon: <Youtube size={18} />, href: "https://www.youtube.com/@bireenainfotech", label: "youtube" }
    ];

    const footerLinks = {
        product: [
            { name: "Features", href: "/features" },
            { name: "Pricing", href: "/pricing" },
            { name: "Blogs", href: "#" },
            { name: "App Alternative", href: "#" }
        ],
        company: [
            { name: "About", href: "/about" },
            { name: "Vision", href: "#" },
            { name: "Our Values", href: "#" },
            { name: "Contact Us", href: "/contact" },
            { name: "Careers", href: "#" }
        ],
        support: [
            { name: "Getting Started", href: "#" },
            { name: "Help Center", href: "#" },
            { name: "Request Support", href: "/contact" }
        ]
    };

    return (
        <footer className="footer-root">
            {/* 1. TOP GRADIENT LINE */}
            <div className="footer-top-line"></div>

            <div className="footer-main-container">
                <div className="footer-grid">
                    {/* COLUMN 1: BRAND */}
                    <div className="footer-brand-col">
                        <div className="footer-logo-wrap">
                            <img src={FooterLogo} alt="Bireena Atithi" className="f-logo" />
                        </div>
                        <p className="f-tagline">Simple. Secure. Tailored.</p>
                        <div className="f-socials">
                            {socialLinks.map((social, i) => (
                                <a
                                    key={i}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`s-icon hov-${social.label}`}
                                    aria-label={social.label}
                                >
                                    {social.icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* COLUMN 2: PRODUCT */}
                    <div className="footer-links-col">
                        <h4 className="f-header">Product</h4>
                        <div className="f-header-line product-line"></div>
                        <ul className="f-list">
                            {footerLinks.product.map((link, i) => (
                                <li key={i}><Link to={link.href}>{link.name}</Link></li>
                            ))}
                        </ul>
                    </div>

                    {/* COLUMN 3: COMPANY */}
                    <div className="footer-links-col">
                        <h4 className="f-header">Company</h4>
                        <div className="f-header-line company-line"></div>
                        <ul className="f-list">
                            {footerLinks.company.map((link, i) => (
                                <li key={i}><Link to={link.href}>{link.name}</Link></li>
                            ))}
                        </ul>
                    </div>

                    {/* COLUMN 4: SUPPORT */}
                    <div className="footer-links-col">
                        <h4 className="f-header">Support</h4>
                        <div className="f-header-line support-line"></div>
                        <ul className="f-list">
                            {footerLinks.support.map((link, i) => (
                                <li key={i}><Link to={link.href}>{link.name}</Link></li>
                            ))}
                        </ul>
                    </div>

                    {/* COLUMN 5: CONTACT */}
                    <div className="footer-links-col contact-col">
                        <h4 className="f-header">Contact</h4>
                        <div className="f-header-line contact-line"></div>
                        <div className="f-contact-info">
                            <a
                                className="c-item address-item"
                                href={mapsLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Open address in map"
                            >
                                <MapPin size={16} />
                                <span>{supportAddress}</span>
                            </a>
                            <a className="c-item" href="tel:9304942225" aria-label="Call 9304942225">
                                <Phone size={16} />
                                <span>9304942225</span>
                            </a>
                            <a
                                className="c-item"
                                href={gmailComposeLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Email ${supportEmail}`}
                            >
                                <Mail size={16} />
                                <span className="truncate">{supportEmail}</span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* THE PREMIUM BOTTOM BANNER */}
                <div className="footer-cta-banner-container">
                    <div className="footer-cta-banner">
                        <div className="cta-banner-content">
                            <div className="cta-sparkle"><Sparkles size={20} /></div>
                            <h3 className="cta-banner-title">
                                Cost-Effective, Customizable, <br className="hidden md:block" />
                                Streamlined, Hotel Management Software.
                            </h3>
                        </div>
                        <Link to="/contact">
                            <button className="cta-banner-btn" onClick={() => window.scrollTo(0, 0)}>
                                <span>Book a Demo</span>
                                <ArrowRight size={18} />
                            </button>
                        </Link>
                    </div>
                </div>

                <div className="footer-bottom-bar text-center pt-8 border-t border-white/5 pb-6">
                    <p className="text-gray-500 text-sm">
                        ©️ Copyright 2026. All Rights Reserved. Bireena Info Tech
                        <span className="mx-4">|</span>
                        <Link to="#" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <span className="mx-4">|</span>
                        <Link to="#" className="hover:text-white transition-colors">Terms of Service</Link>
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
