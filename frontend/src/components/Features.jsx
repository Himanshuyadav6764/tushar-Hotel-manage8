import { CalendarDays, UtensilsCrossed, Receipt } from 'lucide-react';
import './Features.css';

const FEATURES = [
    {
        title: 'Reservation Management',
        description: 'Streamline bookings and manage check-ins and check-outs with ease.',
        icon: <CalendarDays strokeWidth={1.5} size={32} />,
        color: '#d41424', // Red
        bg: '#ffe5e8', // Soft red
    },
    {
        title: 'KOT & Room Service',
        description: 'Handle kitchen order tickets and room service orders efficiently from one place.',
        icon: <UtensilsCrossed strokeWidth={1.5} size={32} />,
        color: '#f97316', // Orange
        bg: '#ffedd5', // Soft orange/peach
    },
    {
        title: 'Billing & Invoicing',
        description: 'Generate bills, apply discounts, and manage payments with a few clicks.',
        icon: <Receipt strokeWidth={1.5} size={32} />,
        color: '#0fb981', // Green
        bg: '#d1fae5', // Soft green
    },
];

const Features = () => {
    return (
        <section className="features-section landing-features" id="features">
            <div className="container">
                <h2 className="features-heading">All-in-One Solution for Seamless Hotel Operations</h2>
                <p className="features-subheading">Bireena Atithi provides everything you need to streamline your hotel management.</p>
                <div className="features-grid">
                    {FEATURES.map((f, i) => (
                        <div key={i} className="feature-card">
                            <div
                                className="feature-icon-wrap"
                                style={{ backgroundColor: f.bg, color: f.color }}
                            >
                                <span className="feature-icon" aria-hidden="true">{f.icon}</span>
                            </div>
                            <h3 className="feature-title">{f.title}</h3>
                            <p className="feature-desc">{f.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Features;
