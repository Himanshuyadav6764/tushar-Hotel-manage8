import React, { useState } from "react";
import { Link } from "react-router-dom"; // Import Link for routing
import Reveal from "../components/Reveal";

const PricingButton = ({ recommended }) => {
    const [hovered, setHovered] = useState(false);

    return (
        <Link to="/contact" style={{ textDecoration: "none", width: "100%" }}>
            <button
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={() => window.scrollTo(0, 0)}
                style={{
                    background: recommended
                        ? "#d41424"
                        : hovered ? "#d41424" : "#fef2f2",
                    color: recommended
                        ? "#fff"
                        : hovered ? "#fff" : "#d41424",
                    border: "none",
                    padding: "15px",
                    borderRadius: "10px",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    width: "100%",
                    fontSize: "15px"
                }}
            >
                Get Started
            </button>
        </Link>
    );
};

const Pricing = () => {
    const plans = [
        {
            name: "Basic",
            price: "₹14,999/mo", // Swapped to lower price
            features: [
                "Single Hotel Management",
                "Basic Reservation System",
                "KOT Automation (Limited)",
                "Standard Billing",
                "Email Support"
            ],
            recommended: false
        },
        {
            name: "Professional",
            price: "₹19,999/mo", // Swapped to higher price
            features: [
                "Up to 3 Hotels",
                "Advanced Reservation Intelligence",
                "Full KOT Automation",
                "Inventory Management",
                "Priority 24/7 Support"
            ],
            recommended: true
        },
        {
            name: "Enterprise",
            price: "Custom",
            features: [
                "Unlimited Hotels",
                "Full Customization",
                "Advanced Analytics & Reports",
                "Dedicated Account Manager",
                "Custom API Integration"
            ],
            recommended: false
        }
    ];

    return (
        <div style={{ paddingTop: "60px", paddingBottom: "120px", minHeight: "100vh", background: "#fff0f3" }}>
            <div className="container" style={{ textAlign: "center" }}>
                <Reveal width="100%">
                    <h1 style={{ fontSize: "52px", fontWeight: "950", marginBottom: "24px", color: "#111827" }}>
                        Simple, Transparent <span style={{ color: "#d41424" }}>Pricing</span>
                    </h1>
                </Reveal>
                <Reveal delay={0.1} width="100%">
                    <p style={{ fontSize: "19px", color: "#4b5563", marginBottom: "80px", maxWidth: "800px", margin: "0 auto 80px", lineHeight: "1.7" }}>
                        Choose the perfect plan for your hotel. No hidden fees, no surprises.
                    </p>
                </Reveal>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: "40px",
                    marginTop: "20px",
                    maxWidth: "1200px",
                    margin: "0 auto"
                }}>
                    {plans.map((plan, index) => (
                        <Reveal key={index} delay={index * 0.1} width="100%">
                            <div style={{
                                background: "#fff",
                                padding: "48px 40px",
                                borderRadius: "32px",
                                border: "1px solid rgba(225, 29, 72, 0.12)",
                                position: "relative",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                boxShadow: "0 20px 40px rgba(225, 29, 72, 0.04)",
                                transition: "all 0.3s ease-out"
                            }}>
                                {plan.recommended && (
                                    <div style={{
                                        position: "absolute",
                                        top: "-18px",
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        background: "#d41424",
                                        color: "#fff",
                                        padding: "8px 24px",
                                        borderRadius: "30px",
                                        fontSize: "13px",
                                        fontWeight: "800",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                        boxShadow: "0 8px 16px rgba(225, 29, 72, 0.2)"
                                    }}>
                                        Most Popular
                                    </div>
                                )}
                                <h3 style={{ fontSize: "24px", fontWeight: "950", marginBottom: "12px", color: "#111827" }}>{plan.name}</h3>
                                <div style={{ fontSize: "42px", fontWeight: "950", color: "#d41424", marginBottom: "32px" }}>
                                    {plan.price}
                                </div>
                                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 50px 0", textAlign: "left", flex: 1 }}>
                                    {plan.features.map((feature, fIndex) => (
                                        <li key={fIndex} style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px", color: "#4b5563", fontSize: "15px", fontWeight: "600" }}>
                                            <span style={{ color: "#d41424", fontWeight: "bold" }}>✓</span> {feature}
                                        </li>
                                    ))}
                                </ul>
                                <PricingButton recommended={plan.recommended} />
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Pricing;
