import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CalendarDays,
    ReceiptText,
    Users,
    BarChart3,
    Heart,
    Utensils
} from 'lucide-react';
import './FeaturesAndStats.css';

const FeatureCard = ({ icon: Icon, title, description }) => {
    return (
        <div className="fas-card">
            <div className="fas-card-header">
                <div className="fas-card-icon-wrap">
                    <Icon className="fas-card-icon" />
                </div>
                <h3 className="fas-card-title">{title}</h3>
            </div>
            <p className="fas-card-desc">
                {description}
            </p>
        </div>
    );
};

const FeaturesAndStats = () => {
    const navigate = useNavigate();
    const features = [
        {
            icon: CalendarDays,
            title: "Booking Management",
            description: "Streamline reservations with a powerful central calendar."
        },
        {
            icon: ReceiptText,
            title: "Billing & Invoicing",
            description: "Automate GST-compliant billing and POS integration."
        },
        {
            icon: Users,
            title: "Staff Management",
            description: "Track shifts, roles and monitor performance easily."
        },
        {
            icon: BarChart3,
            title: "Reports & Analytics",
            description: "Get insights on revenue, occupancy and growth."
        },
        {
            icon: Utensils,
            title: "Table Booking",
            description: "Manage dining reservations and optimize restaurant seating."
        },
        {
            icon: Users,
            title: "Staff CRM",
            description: "Track attendance, manage payroll, and monitor performance."
        }
    ];

    return (
        <section className="fas-section">
            {/* Wavy Background Elements */}
            <svg viewBox="0 0 1440 320" className="fas-bg-svg-1">
                <path fill="#fee2e2" d="M0,160L48,154.7C96,149,192,139,288,154.7C384,171,480,213,576,213.3C672,213,768,171,864,154.7C960,139,1056,149,1152,176C1248,203,1344,245,1392,266.7L1440,288L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
            </svg>
            <svg viewBox="0 0 1440 320" className="fas-bg-svg-2">
                <path fill="#fecaca" d="M0,96L48,128C96,160,192,224,288,234.7C384,245,480,203,576,170.7C672,139,768,117,864,122.7C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
            </svg>

            <div className="fas-container">
                {/* Section Title */}
                <div className="fas-header">
                    <h2 className="fas-title">
                        Everything You Need to Run Your Hotel
                    </h2>
                    <div className="fas-title-underline"></div>
                </div>

                {/* Features Grid */}
                <div className="fas-grid">
                    {features.map((feature, index) => (
                        <FeatureCard
                            key={index}
                            icon={feature.icon}
                            title={feature.title}
                            description={feature.description}
                        />
                    ))}
                </div>

                {/* CTA Section */}
                <div className="fas-cta-wrap">
                    <div className="fas-cta-banner">
                        <h2 className="fas-cta-title">
                            Join the Future of Hotel Management <span className="rocket-emoji">🚀</span>
                        </h2>
                        <p className="fas-cta-desc">
                            Experience the Bireena Atithi advantage for your Hotel today
                        </p>
                        <button className="fas-cta-btn" onClick={() => navigate('/features')}>
                            View All Features
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default FeaturesAndStats;
