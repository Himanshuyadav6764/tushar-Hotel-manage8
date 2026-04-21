import React, { useState } from "react";
import Reveal from "../components/Reveal";
import "./contact.css";

const Contact = () => {
    const whatsappNumber = "919304942225";
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        message: ""
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const whatsappMessage = [
            "New Contact Request",
            `Name: ${formData.name}`,
            `Email: ${formData.email}`,
            `Phone: ${formData.phone}`,
            `Message: ${formData.message}`
        ].join("\n");

        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    };

    const socials = [
        {
            label: "Facebook",
            href: "https://www.facebook.com/profile.php?id=61572904348705",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
            ),
        },
        {
            label: "Instagram",
            href: "https://www.instagram.com/bireenainfo/",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
            ),
        },
        {
            label: "LinkedIn",
            href: "https://www.linkedin.com/in/bireena-info-tech-a975533a1/",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect x="2" y="9" width="4" height="12" />
                    <circle cx="4" cy="4" r="2" />
                </svg>
            ),
        },
        {
            label: "Website",
            href: "https://bireenainfotech.com/",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
            ),
        },
    ];


    return (
        <div style={{ paddingTop: "20px", paddingBottom: "20px", minHeight: "100vh", background: "#fff6f7" }}>
            <div className="container" style={{ maxWidth: "1200px" }}>

                {/* PAGE HEADING — untouched */}
                <Reveal width="100%">
                    <h1 style={{ fontSize: "42px", fontWeight: "700", marginBottom: "20px", textAlign: "center" }}>
                        Get in <span style={{ color: "#e11d48" }}>Touch</span>
                    </h1>
                </Reveal>
                <Reveal delay={0.1} width="100%">
                    <p style={{ fontSize: "18px", color: "#666", marginBottom: "60px", textAlign: "center", maxWidth: "800px", margin: "0 auto 60px" }}>
                        Have questions about our hotel management system? We're here to help you grow your business.
                    </p>
                </Reveal>

                {/* ── TWO CARDS GRID: Contact Info LEFT | Form RIGHT ── */}
                <div className="contact-cards-grid">

                    {/* ── LEFT: CONTACT INFORMATION ── */}
                    <Reveal delay={0.2} width="100%">
                        <div className="c-info-card">
                            <div>
                                <h3 className="c-info-title">Contact Information</h3>
                                <p className="c-info-sub">Reach out to us through any channel below.</p>

                                <div className="c-info-items">
                                    <div className="c-info-item">
                                        <div className="c-info-icon">✉️</div>
                                        <div>
                                            <p className="c-info-label">Email Us</p>
                                            <a href="mailto:bireenainfo@gmail.com" className="c-info-value">
                                                bireenainfo@gmail.com
                                            </a>
                                        </div>
                                    </div>

                                    <div className="c-info-item">
                                        <div className="c-info-icon">📞</div>
                                        <div>
                                            <p className="c-info-label">Call Us</p>
                                            <a href="tel:9304942225" className="c-info-value">
                                                9304942225
                                            </a>
                                        </div>
                                    </div>

                                    <div className="c-info-item">
                                        <div className="c-info-icon">📍</div>
                                        <div>
                                            <p className="c-info-label">Office Address</p>
                                            <p className="c-info-value">
                                                B36, Mitra Mandal Colony, Vashist Colony,<br />
                                                Anisabad, Patna, Bihar 800002
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="c-info-divider" />
                                <p className="c-social-label">Follow Us</p>
                                <div className="c-social-row">
                                    {socials.map((s) => (
                                        <a
                                            key={s.label}
                                            href={s.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="c-social-btn"
                                            aria-label={s.label}
                                        >
                                            {s.icon}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Reveal>

                    {/* ── RIGHT: SEND US A MESSAGE ── */}
                    <Reveal delay={0.3} width="100%">
                        <div className="c-form-card">
                            <h3 className="c-form-title">Send us a Message</h3>
                            <p className="c-form-sub">Fill out the form and we'll get back to you within 24 hours.</p>

                            <form className="c-form" onSubmit={handleSubmit}>
                                <div className="c-field">
                                    <label>Your Name</label>
                                    <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" required />
                                </div>
                                <div className="c-field">
                                    <label>Work Email</label>
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="john@company.com" required />
                                </div>
                                <div className="c-field">
                                    <label>Phone Number</label>
                                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="9304942225" required />
                                </div>
                                <div className="c-field">
                                    <label>Message</label>
                                    <textarea name="message" value={formData.message} onChange={handleChange} placeholder="How can we help your hotel?" rows="4" required />
                                </div>
                                <button type="submit" className="c-send-btn">
                                    Send Message
                                </button>
                            </form>
                        </div>
                    </Reveal>
                </div>

            </div> {/* End of Container */}
            
            {/* GOOGLE MAP SECTION — 3D Neubrutalist Style */}
            <div className="container" style={{ maxWidth: "1200px", marginTop: "80px" }}>
                <Reveal delay={0.4} width="100%">
                    <div style={{
                        borderRadius: "12px",
                        overflow: "hidden",
                        border: "3px solid #e11d48",
                        boxShadow: "10px 10px 0px #e11d48",
                        width: "100%",
                        background: "#fff"
                    }}>
                        <iframe
                            src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d460653.7187557657!2d85.091635!3d25.576418!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x43d931ec9b428883%3A0xa1137df98dfedf57!2sBireena%20Info%20Tech!5e0!3m2!1sen!2sin!4v1711606201876!5m2!1sen!2sin"
                            width="100%"
                            height="450"
                            style={{ border: 0, display: "block" }}
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Bireena Info Tech Location"
                        ></iframe>
                    </div>
                </Reveal>
            </div>
        </div>
    );
};

export default Contact;
