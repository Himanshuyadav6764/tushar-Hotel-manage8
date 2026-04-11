import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket } from "lucide-react"; // Import Rocket for the Get Started buttons
import Reveal from "../components/Reveal";
import "./Features.css";

// Import all required assets
import heroImage from "../assets/feature-hero.png";

const featureData = [
    {
        title: "Automate KOT Management",
        desc: "Simplify kitchen order management with automated, real-time KOT processing.",
        stats: "2,847",
        statsLabel: "Orders Today",
        trend: "+ 23.5%",
        highlights: ["Real-time order tracking", "Auto KOT routing", "Kitchen display system"],
        details: "Our KOT automation ensures that every order from the table reaches the kitchen in less than 2 seconds, reducing human error by 99% and accelerating service times drastically."
    },
    {
        title: "Streamline Reservations",
        desc: "Manage room bookings efficiently with an intuitive and automated system.",
        stats: "1,368",
        statsLabel: "Bookings This Month",
        trend: "+ 18.7%",
        highlights: ["Real-time availability", "Auto-confirmation", "Smart booking calendar"],
        details: "The booking engine synchronizes all OTA channels instantly, preventing overbooking and allowing guests to see available rooms in real-time with zero lag."
    },
    {
        title: "Efficient Billing System",
        desc: "Simplify invoicing and payments with automated, real-time KOT processing.",
        stats: "₹24.8L",
        statsLabel: "Billed This Month",
        trend: "+ 32.1%",
        highlights: ["Multiple payment options", "Auto invoice generation", "GST-compliant billing"],
        details: "Generate GST-ready invoices with a single click. Our system supports UPI, Credit Cards, and splitting bills for large groups seamlessly."
    },
    {
        title: "Easy Inventory Control",
        desc: "Track and manage hotel inventory easily, reducing losses and expenses.",
        stats: "1,234",
        statsLabel: "Items in Stock",
        trend: "+ 8.9%",
        highlights: ["Low stock alerts", "Purchase management", "Real-time tracking"],
        details: "Real-time stock deduction as soon as a KOT is generated or a room facility is used. Never run out of essential supplies again with smart low-stock notifications."
    },
    {
        title: "Housekeeping Automation",
        desc: "Coordinate and track housekeeping tasks with real-time updates.",
        stats: "342",
        statsLabel: "Tasks Today",
        trend: "+ 15.3%",
        highlights: ["Room status tracking", "Staff task assignment", "Real-time updates"],
        details: "Auto-assign tasks to staff based on their current load. Rooms are marked clean as soon as the staff updates the status on their mobile interface."
    },
    {
        title: "Multi-User Access",
        desc: "Allow your team to access and manage the system easily with role-based access.",
        stats: "28",
        statsLabel: "Active Users",
        trend: "+ 11.2%",
        highlights: ["Role-based access", "Secure permissions", "Activity logs"],
        details: "Maintain complete security with granular permissions. Give managers, receptionists, and chefs exactly the access they need, no more, no less."
    },
    {
        title: "Insightful Reporting",
        desc: "Generate detailed reports and analytics to gain insights into hotel operations.",
        stats: "56",
        statsLabel: "Reports Generated",
        trend: "+ 27.4%",
        highlights: ["Custom report builder", "Revenue insights", "Export to Excel/PDF"],
        details: "Unlock the power of your data. Get daily, weekly, and monthly reports on occupancy, revenue per room, and kitchen efficiency in beautiful PDF formats."
    },
    {
        title: "Staff & Guest Messaging",
        desc: "Enhance communication with messaging tools for seamless interaction.",
        stats: "1,892",
        statsLabel: "Messages Sent",
        trend: "+ 21.6%",
        highlights: ["Real-time messaging", "Guest notifications", "Staff announcements"],
        details: "Bridge the gap between staff and guests. Send automated check-in welcomes and instant notifications when a room service request is completed."
    }
];

const trustMetrics = [
    { text: "150+ Hotels Trust Us", emoji: "🏨" },
    { text: "10,000+ Active Users", emoji: "👥" },
    { text: "99.9% Uptime Guaranteed", emoji: "📉" },
    { text: "24/7 Global Support", emoji: "❤️" },
    { text: "₹50Cr+ Billed Monthly", emoji: "💰" },
    { text: "5 Star Client Rating", emoji: "⭐" },
    { text: "ISO Certified Security", emoji: "🛡️" },
    { text: "Built for Next-Gen Hotels", emoji: "🚀" }
];

const Features = () => {
    const [expandedCard, setExpandedCard] = useState(null);

    const toggleCard = (index) => {
        setExpandedCard(expandedCard === index ? null : index);
    };

    return (
        <div className="features-page">
            {/* HERO SECTION */}
            <Reveal width="100%">
                <section className="features-hero">
                    <div className="features-hero-left">
                        <h1>
                            Smart Hotel Management
                            <span> with KOT Automation</span>
                        </h1>
                        <p>
                            Manage reservations, billing, inventory, housekeeping and KOT
                            seamlessly with powerful real-time automation built for modern hotels.
                        </p>
                        <div className="hero-buttons">
                            <Link to="/contact">
                                <button className="btn-primary" onClick={() => window.scrollTo(0, 0)}>
                                    <Rocket size={18} /> Get Started
                                </button>
                            </Link>
                            <Link to="/pricing">
                                <button className="btn-secondary" onClick={() => window.scrollTo(0, 0)}>
                                    See Pricing
                                </button>
                            </Link>
                        </div>
                    </div>
                    <div className="features-hero-image-wrapper">
                        <img
                            src={heroImage}
                            alt="Bireena Atithi Feature Hero"
                            className="features-hero-image"
                            draggable="false"
                        />
                    </div>
                </section>
            </Reveal>

            {/* SQUARE ENHANCED FEATURES GRID */}
            <section className="features-grid-wrapper">
                <div className="features-grid-container">
                    {featureData.map((item, index) => (
                        <Reveal width="100%" delay={index * 0.05} key={index}>
                            <motion.div
                                className="feature-card-square"
                                layout
                            >
                                <div className="card-top-accent"></div>
                                <div className="feature-card-content">
                                    <h3 className="feature-card-title">{item.title}</h3>

                                    <AnimatePresence mode="wait">
                                        {expandedCard === index ? (
                                            <motion.div
                                                key="details"
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="feature-details-area"
                                            >
                                                <p className="feature-card-desc-detailed">
                                                    {item.details}
                                                </p>
                                                <div className="details-badge">Feature Highlight</div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="standard"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                            >
                                                <p className="feature-card-desc">{item.desc}</p>

                                                {/* Stats Banner */}
                                                <div className="feature-card-stats">
                                                    <div className="stats-left">
                                                        <span className="stats-value">{item.stats}</span>
                                                        <span className="stats-label">{item.statsLabel}</span>
                                                    </div>
                                                    <div className="stats-trend">{item.trend}</div>
                                                </div>

                                                {/* Highlights List */}
                                                <ul className="feature-card-list">
                                                    {item.highlights.map((h, i) => (
                                                        <li key={i}>
                                                            <span className="indicator">•</span> {h}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <button
                                        className={`action-btn ${expandedCard === index ? 'active' : ''}`}
                                        onClick={() => toggleCard(index)}
                                    >
                                        {expandedCard === index ? 'Go Back' : 'Learn more'}
                                        <span className={`arrow ${expandedCard === index ? 'rotate' : ''}`}>→</span>
                                    </button>
                                </div>
                            </motion.div>
                        </Reveal>
                    ))}
                </div>

                {/* TRUST MARQUEE (Zomato/Swiggy Style Infinite Rotation) */}
                <div className="marquee-wrapper">
                    <motion.div
                        className="marquee-content"
                        animate={{ x: ["0%", "-50%"] }}
                        transition={{
                            duration: 25,
                            ease: "linear",
                            repeat: Infinity
                        }}
                    >
                        {/* Render metrics twice for seamless loop */}
                        {[...trustMetrics, ...trustMetrics].map((metric, idx) => (
                            <div className="marquee-item" key={idx}>
                                <span className="m-emoji">{metric.emoji}</span>
                                <span className="m-text">{metric.text}</span>
                            </div>
                        ))}
                    </motion.div>
                    {/* Shadow overlays for smooth fade edges */}
                    <div className="marquee-fade-left"></div>
                    <div className="marquee-fade-right"></div>
                </div>
            </section>

            {/* CTA BANNER */}
            <Reveal width="100%" delay={0.2}>
                <section className="features-cta">
                    <h2>Empower Your Hotel with Real-Time KOT Intelligence</h2>
                    <p>
                        Streamline your kitchen operations, reduce order delays, and deliver
                        a seamless guest experience with our advanced automation.
                    </p>
                    <Link to="/contact">
                        <button className="cta-btn" onClick={() => window.scrollTo(0, 0)}>Book a Free Demo</button>
                    </Link>
                </section>
            </Reveal>
        </div>
    );
};

export default Features;
