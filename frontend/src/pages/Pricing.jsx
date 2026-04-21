import React from "react";
import Reveal from "../components/Reveal";

const Pricing = () => {
    const whatsappNumber = "919304942225";

    const openPlanWhatsApp = (planName, ctaText) => {
        const whatsappMessage = [
            "Hello Bireena Team,",
            `I am interested in the ${planName} plan.`,
            `Action requested: ${ctaText}`,
            "Please share details and next steps."
        ].join("\n");

        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    };

    const plans = [
        {
            name: "Starter",
            subtitle: "Perfect for small hotels & guest houses",
            ctaText: "Start Free Demo",
            price: "",
            features: [
                "Room Booking & Reservation Management",
                "Guest Check-In / Check-Out System",
                "Basic Billing & Invoice Generation",
                "Room Availability Dashboard",
                "Daily Reports (Occupancy & Revenue)",
                "Mobile-Friendly Admin Panel"
            ],
            recommended: false
        },
        {
            name: "Growth",
            subtitle: "Best for growing hotels & restaurants",
            ctaText: "See Live Demo",
            price: "",
            features: [
                "Everything in Starter",
                "Restaurant + KOT (Kitchen Order Ticket)",
                "Smart Billing with GST Support",
                "Staff & Housekeeping Management",
                "Inventory Tracking (Basic Stock Alerts)",
                "Advanced Reports & Analytics"
            ],
            recommended: true
        },
        {
            name: "Enterprise",
            subtitle: "For large hotels & multi-property businesses",
            ctaText: "Talk to Sales",
            price: "",
            features: [
                "Everything in Growth",
                "Multi-Property Management Dashboard",
                "AI-Based Revenue Insights & Pricing",
                "Full Inventory + Vendor Management",
                "Custom Integrations (POS, OTA, APIs)",
                "Role-Based Access Control (Admin/Staff)",
                "Dedicated Support & Onboarding"
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
                                {plan.subtitle && (
                                    <p style={{ fontSize: "16px", color: "#6b7280", marginBottom: "16px", fontWeight: "600" }}>
                                        {plan.subtitle}
                                    </p>
                                )}
                                {!!plan.price && (
                                    <div style={{ fontSize: "42px", fontWeight: "950", color: "#d41424", marginBottom: "32px" }}>
                                        {plan.price}
                                    </div>
                                )}
                                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 50px 0", textAlign: "left", flex: 1 }}>
                                    {plan.features.map((feature, fIndex) => (
                                        <li key={fIndex} style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px", color: "#4b5563", fontSize: "15px", fontWeight: "600" }}>
                                            <span style={{ color: "#d41424", fontWeight: "bold" }}>✓</span> {feature}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    type="button"
                                    onClick={() => openPlanWhatsApp(plan.name, plan.ctaText || "Get Started")}
                                    style={{
                                        background: plan.recommended ? "#d41424" : "#fef2f2",
                                        color: plan.recommended ? "#fff" : "#d41424",
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
                                    {plan.ctaText || "Get Started"}
                                </button>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Pricing;
