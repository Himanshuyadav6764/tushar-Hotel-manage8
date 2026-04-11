import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    Lightbulb,
    Search,
    Settings,
    Rocket,
    CalendarCheck,
    Utensils,
    CreditCard,
    BedDouble,
    ShieldCheck,
    BarChart3,
    Target,
    Users,
    Boxes,
    Milestone,
    Sparkles,
    Linkedin
} from "lucide-react";
import Reveal from "../components/Reveal";
import "./about.css";

// Import the perfect pink asset
import aboutHeroImg from "../assets/about-hero-pink.png";

const About = () => {
    const [activeIndex, setActiveIndex] = useState(2);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const journeyMilestones = [
        {
            stage: "PHASE 01",
            title: "The Genesis",
            subtitle: "Vision & Conceptualization",
            icon: <Lightbulb size={32} />,
            desc: "Identified the massive 'Digital Divide' in the hospitality sector. We envisioned a world where even the smallest hotel could leverage AI-driven automation."
        },
        {
            stage: "PHASE 02",
            title: "Problem Mapping",
            subtitle: "Deep Inefficiency Analysis",
            icon: <Search size={32} />,
            desc: "Spent 1000+ hours inside hotel kitchens and front desks to understand real-world bottlenecks in manual billing and guest management."
        },
        {
            stage: "PHASE 03",
            title: "The Innovation",
            subtitle: "Building the Smart Ecosystem",
            icon: <Settings size={32} />,
            desc: "Engineered a proprietary cloud core that handles KOT, Reservations, and Billing in a single, unified interface accessible from anywhere."
        },
        {
            stage: "PHASE 04",
            title: "Rapid Adoption",
            subtitle: "Product-Market Fit Achieved",
            icon: <Target size={32} />,
            desc: "Scaled to 1000+ active users. We proved that smart automation leads to a direct 24% increase in operational revenue for our partners."
        },
        {
            stage: "PHASE 05",
            title: "The Future",
            subtitle: "Global Scaling & AI Integration",
            icon: <Rocket size={28} />,
            desc: "Serving 150+ international hotel brands. We are now integrating predictive AI to anticipate guest needs before they even arrive."
        }
    ];

    // High-Fidelity Auto-Rotation Logic
    useEffect(() => {
        const interval = setInterval(() => {
            handleTransition();
        }, 5000); // 5 seconds for a premium, calm feel
        return () => clearInterval(interval);
    }, [activeIndex]);

    const handleTransition = (targetIndex = null) => {
        setIsTransitioning(true);
        setTimeout(() => {
            if (targetIndex !== null) {
                setActiveIndex(targetIndex);
            } else {
                setActiveIndex((prev) => (prev + 1) % journeyMilestones.length);
            }
            setIsTransitioning(false);
        }, 600);
    };

    const getCircularIndex = (index) => {
        const n = journeyMilestones.length;
        return ((index % n) + n) % n;
    };

    return (
        <div className="about-page">
            <div className="about-inner-wrapper">
                {/* HERO SECTION */}
                <Reveal width="100%">
                    <section className="about-hero-v2">
                        <div className="about-hero-left">
                            <h1 className="about-hero-title">
                                Empowering Modern Hotels
                                <span> With Digital Intelligence</span>
                            </h1>
                            <p className="about-hero-desc">
                                At Bireena Atithi, we simplify hotel operations, enhance guest
                                experience, and boost revenue using powerful real-time automation
                                built for the next generation of hotels.
                            </p>
                            <div className="about-hero-buttons">
                                <Link to="/contact">
                                    <button className="btn-primary" onClick={() => window.scrollTo(0, 0)}>Book a Free Demo</button>
                                </Link>
                                <Link to="/pricing">
                                    <button className="btn-secondary" onClick={() => window.scrollTo(0, 0)}>See Pricing</button>
                                </Link>
                            </div>
                        </div>
                        <div className="about-hero-image-wrapper">
                            <img
                                src={aboutHeroImg}
                                alt="Bireena Atithi About Hero"
                                className="about-hero-illustration"
                                draggable="false"
                            />
                        </div>
                    </section>
                </Reveal>

                {/* THE "ULTRA-STATIONARY" INNOVATION SPOTLIGHT */}
                <section className="innovation-track-section">
                    <div className="track-header">
                        <Reveal>
                            <span className="premium-badge"><Sparkles size={14} /> Our Evolution</span>
                            <h2 className="track-title">The Path to <span className="text-red">Excellence</span></h2>
                        </Reveal>
                    </div>

                    <div className="stationary-hero-container">
                        {/* THE FIXED HORIZON LINE */}
                        <div className="track-line-bg">
                            <div className="track-line-glow"></div>
                        </div>

                        <div className="hero-perspective-wrapper">
                            {/* PREVIOUS PREVIEW */}
                            <div className={`side-card side-prev ${isTransitioning ? 'side-exit' : ''}`}>
                                <div className="card-top">
                                    <span className="card-stage">{journeyMilestones[getCircularIndex(activeIndex - 1)].stage}</span>
                                </div>
                                <div className="card-body">
                                    <div className="card-icon-wrap">
                                        {journeyMilestones[getCircularIndex(activeIndex - 1)].icon}
                                    </div>
                                    <h3 className="card-title">{journeyMilestones[getCircularIndex(activeIndex - 1)].title}</h3>
                                </div>
                            </div>

                            {/* MAIN FIXED HERO SLOT */}
                            <div className="hero-card-static-frame">
                                <div className={`hero-card-content ${isTransitioning ? 'content-flip' : ''}`}>
                                    <div className="card-top">
                                        <span className="card-stage">{journeyMilestones[activeIndex].stage}</span>
                                        <div className="live-indicator"><div className="ping"></div> Active Milestone</div>
                                    </div>
                                    <div className="card-body">
                                        <div className="hero-icon-container">
                                            {journeyMilestones[activeIndex].icon}
                                        </div>
                                        <div className="hero-text-container">
                                            <h3 className="card-title">{journeyMilestones[activeIndex].title}</h3>
                                            <h4 className="card-subtitle">{journeyMilestones[activeIndex].subtitle}</h4>
                                            <p className="card-desc">{journeyMilestones[activeIndex].desc}</p>
                                        </div>
                                    </div>
                                </div>
                                {/* THE "GLOW AURA" BEHIND RED CARD */}
                                <div className="hero-glow-aura"></div>
                            </div>

                            {/* NEXT PREVIEW */}
                            <div className={`side-card side-next ${isTransitioning ? 'side-enter' : ''}`}>
                                <div className="card-top">
                                    <span className="card-stage">{journeyMilestones[getCircularIndex(activeIndex + 1)].stage}</span>
                                </div>
                                <div className="card-body">
                                    <div className="card-icon-wrap">
                                        {journeyMilestones[getCircularIndex(activeIndex + 1)].icon}
                                    </div>
                                    <h3 className="card-title">{journeyMilestones[getCircularIndex(activeIndex + 1)].title}</h3>
                                </div>
                            </div>
                        </div>

                        {/* PREMIUM NAV CONTROLS */}
                        <div className="track-controls">
                            {journeyMilestones.map((_, idx) => (
                                <button
                                    key={idx}
                                    className={`control-pill ${idx === activeIndex ? 'active' : ''}`}
                                    onClick={() => handleTransition(idx)}
                                >
                                    <span className="pill-index">0{idx + 1}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* STATS ROW */}
                <Reveal width="100%">
                    <section className="about-stats-row">
                        <div className="stats-container marquee-wrapper">
                            <div className="stats-marquee">
                                {[
                                    { n: "500+", l: "Hotels" },
                                    { n: "99%", l: "Uptime" },
                                    { n: "24/7", l: "Support" },
                                    { n: "14+", l: "Years Trust" },
                                    { n: "150+", l: "Cities" },
                                    { n: "1M+", l: "Guests" },
                                    { n: "500+", l: "Hotels" },
                                    { n: "99%", l: "Uptime" },
                                    { n: "24/7", l: "Support" },
                                    { n: "14+", l: "Years Trust" },
                                    { n: "150+", l: "Cities" },
                                    { n: "1M+", l: "Guests" }
                                ].map((s, i) => (
                                    <div className="stat-pill-v3" key={i}>
                                        <span className="stat-number-v3">{s.n}</span>
                                        <span className="stat-label-v3">{s.l}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </Reveal>

                {/* CORE MODULES */}
                <Reveal width="100%">
                    <section className="about-capabilities">
                        <div className="about-container">
                            <h2 className="team-heading">Comprehensive Ecosystem</h2>
                            <p className="team-subheading">Proprietary modules driving operational excellence across every touchpoint.</p>
                            <div className="capabilities-grid">
                                <div className="cap-card">
                                    <div className="cap-icon"><CalendarCheck size={24} /></div>
                                    <h4>Advanced Front Office</h4>
                                    <ul>
                                        <li>Visual timeline & room charting.</li>
                                        <li>Automated night audit reports.</li>
                                        <li>Instant group booking blocks.</li>
                                    </ul>
                                </div>
                                <div className="cap-card">
                                    <div className="cap-icon"><Utensils size={24} /></div>
                                    <h4>Smart KOT & F&B</h4>
                                    <ul>
                                        <li>Multi-terminal cloud POS.</li>
                                        <li>Direct kitchen display routing.</li>
                                        <li>Seamless room folio integration.</li>
                                    </ul>
                                </div>
                                <div className="cap-card">
                                    <div className="cap-icon"><CreditCard size={24} /></div>
                                    <h4>Intelligent Billing</h4>
                                    <ul>
                                        <li>GST-ready automated invoices.</li>
                                        <li>Complex split-billing logic.</li>
                                        <li>Dynamic multi-currency support.</li>
                                    </ul>
                                </div>
                                <div className="cap-card">
                                    <div className="cap-icon"><BedDouble size={24} /></div>
                                    <h4>Housekeeping Logic</h4>
                                    <ul>
                                        <li>Dirty/Clean status sync.</li>
                                        <li>Room maintenance block tracking.</li>
                                        <li>Live inventory consumption maps.</li>
                                    </ul>
                                </div>
                                <div className="cap-card">
                                    <div className="cap-icon"><BarChart3 size={24} /></div>
                                    <h4>Data Analytics</h4>
                                    <ul>
                                        <li>RevPAR & ADR daily metrics.</li>
                                        <li>Source of business analysis.</li>
                                        <li>Exportable cashier reports.</li>
                                    </ul>
                                </div>
                                <div className="cap-card">
                                    <div className="cap-icon"><ShieldCheck size={24} /></div>
                                    <h4>Security & Roles</h4>
                                    <ul>
                                        <li>Granular permission manager.</li>
                                        <li>Encrypted multi-property trails.</li>
                                        <li>AES-256 data isolation.</li>
                                    </ul>
                                </div>
                                <div className="cap-card">
                                    <div className="cap-icon"><Users size={24} /></div>
                                    <h4>Staff & Payroll</h4>
                                    <ul>
                                        <li>Role-based attendance tracking.</li>
                                        <li>Automated payroll processing.</li>
                                        <li>Multi-shift staff scheduling.</li>
                                    </ul>
                                </div>
                                <div className="cap-card">
                                    <div className="cap-icon"><Boxes size={24} /></div>
                                    <h4>Smart Inventory</h4>
                                    <ul>
                                        <li>Real-time consumption alerts.</li>
                                        <li>Auto-restock trigger points.</li>
                                        <li>Supplier performance mapping.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </section>
                </Reveal>

                {/* TEAM SECTION */}
                <section className="about-team">
                    <Reveal>
                        <h2 className="team-heading">The Visionaries</h2>
                        <p className="team-subheading">Driving the next wave of hospitality innovation</p>
                    </Reveal>

                    <div className="team-grid-v3">
                        {[
                            { name: "Dipika Singh", role: "FOUNDER & DIRECTOR", img: "/images/dipika.jpg", linkedin: "https://www.linkedin.com/in/dipika-singh-48b488210/" },
                            { name: "Himanshu Yadav", role: "FULL STACK DEVELOPER", img: "/images/himanshu.jpg", linkedin: "#" },
                            { name: "Ankit Kumar", role: "PROJECT MANAGER", img: "/images/ankit.jpeg", linkedin: "#" },
                            { name: "Tushar Kumar", role: "BACKEND DEVELOPER", img: "/images/tushar.jpg", linkedin: "#" },
                            { name: "Shekhar Kumar", role: "BACKEND DEVELOPER", img: "/images/shekhar.jpg", linkedin: "https://www.linkedin.com/in/shekhar-kumar-65b6ab283/" },
                            { name: "Md Arshad Raza", role: "FRONTEND DEVELOPER", img: "/images/arshad.jpg", linkedin: "#" }
                        ].map((member, i) => (
                            <Reveal key={i} delay={i * 0.1}>
                                <div className="team-card-v3 group">
                                    <div className="team-image-v3">
                                        <img src={member.img} alt={member.name} />
                                        <a
                                            href={member.linkedin}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="team-social-v3"
                                            title="Connect on LinkedIn"
                                        >
                                            <Linkedin size={18} />
                                        </a>
                                    </div>
                                    <div className="team-info-v3">
                                        <h4>{member.name}</h4>
                                        <span>{member.role}</span>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </section>

                {/* FINAL CTA BANNER */}
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
        </div>
    );
};

export default About;
