import React from "react";
import { Link } from "react-router-dom";
import Reveal from "../components/Reveal";
import "./Features.css";
import heroImage from "../assets/feature-hero.png";
import f1 from "../assets/f1.png";
import f2 from "../assets/f2.png";
import f3 from "../assets/f3.png";
import f4 from "../assets/f4.png";
import f5 from "../assets/f5.png";
import f6 from "../assets/f6.png";
import f7 from "../assets/f7.png";
import f8 from "../assets/f8.png";

const featureData = [
    {
        title: "Automate KOT Management",
        desc: "Simplify kitchen order management with automated, real-time KOT processing.",
        img: f1
    },
    {
        title: "Streamline Reservations",
        desc: "Manage room bookings effortlessly with an intuitive and automated reservation system.",
        img: f2
    },
    {
        title: "Efficient Billing System",
        desc: "Ensure seamless billing and invoicing with automated and accurate processes.",
        img: f3
    },
    {
        title: "Easy Inventory Control",
        desc: "Track and manage hotel inventory efficiently with alerts and updates.",
        img: f4
    },
    {
        title: "Housekeeping Automation",
        desc: "Coordinate and track housekeeping tasks in real-time for better efficiency.",
        img: f5
    },
    {
        title: "Multi-User Access",
        desc: "Allow your team to access and manage the system based on their roles and permissions.",
        img: f6
    },
    {
        title: "Insightful Reporting",
        desc: "Generate detailed reports and analytics to make informed business decisions.",
        img: f7
    },
    {
        title: "Staff and Guest Messaging",
        desc: "Enhance communication with instant messaging between staff and guests.",
        img: f8
    }
];

const Features = () => {
    return (
        <div className="features-page">

            {/* HERO SECTION */}
            <Reveal width="100%">
                <section className="features-hero">
                    <div className="features-hero-left">
                        <h1>
                            Smart Hotel Management <br />
                            <span>with KOT Automation</span>
                        </h1>

                        <p>
                            Manage reservations, billing, inventory, housekeeping and KOT
                            seamlessly with powerful real-time automation built for modern hotels.
                        </p>

                        <div className="hero-buttons">
                            <button className="btn-primary">Get Started</button>
                            <button className="btn-secondary">See Pricing</button>
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

            {/* NEW FEATURES GRID SECTION */}
            <Reveal width="100%" delay={0.1}>
                <section className="features-grid-wrapper">
                    <div className="features-grid-container">
                        {featureData.map((item, index) => (
                            <div className="feature-card" key={index}>
                                <div className="feature-img-wrap">
                                    <img src={item.img} alt="feature" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </Reveal>

            {/* CTA BANNER */}
            <Reveal width="100%" delay={0.2}>
                <section className="features-cta">
                    <h2>Empower Your Hotel with Real-Time KOT Intelligence</h2>
                    <p>
                        Streamline your kitchen operations, reduce order delays, and deliver
                        a seamless guest experience with our advanced automation.
                    </p>
                    <Link to="/login">
                        <button className="cta-btn" onClick={() => window.scrollTo(0, 0)}>Book a Free Demo</button>
                    </Link>
                </section>
            </Reveal>

        </div>
    );
};

export default Features;
