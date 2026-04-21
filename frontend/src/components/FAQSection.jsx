import React, { useState } from 'react';
import { Plus, Minus, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './FAQSection.css';

const faqData = [
    {
        question: "What features does your platform offer?",
        answer: "Bireena Atithi is an all-in-one suite offering room reservations, KOT management, GST billing, inventory tracking, housekeeping automation, and comprehensive business reporting."
    },
    {
        question: "Can I track room availability and bookings in real-time?",
        answer: "Yes, our real-time dashboard gives you a live view of occupancy, arrivals, and departures across all your properties instantly."
    },
    {
        question: "How does the Kitchen Order Ticket (KOT) system work?",
        answer: "Our automated KOT system instantly routes orders from the table or room to the kitchen display, reducing errors and speeding up service times to under 2 seconds."
    },
    {
        question: "Is your platform suitable for small and large hotels?",
        answer: "Absolutely. We are built to scale. Whether you manage a 10-room boutique stay or a 500-room luxury hotel chain, our infrastructure handles it all effortlessly."
    },
    {
        question: "Can I monitor inventory levels and receive alerts?",
        answer: "Yes, the system tracks every item in real-time and sends automated low-stock alerts so you never run out of essential supplies."
    },
    {
        question: "How does the staff management module help with scheduling?",
        answer: "You can assign roles, track shifts, and monitor staff performance directly from the dashboard, ensuring optimal productivity at all times."
    },
    {
        question: "Are detailed business reports available?",
        answer: "We provide over 20+ specialized reports including occupancy insights, daily revenue, GST records, and staff efficiency metrics in PDF and Excel formats."
    },
    {
        question: "How secure is the platform and guest data?",
        answer: "Your security is our priority. We use ISO-certified encryption and secure cloud infrastructure to ensure that guest profiles and transaction data are always protected."
    },
    {
        question: "Can we assign and track housekeeping tasks?",
        answer: "Yes, you can auto-assign cleaning tasks to staff based on check-out status and track their completion progress in real-time on the mobile interface."
    },
    {
        question: "Is the billing system capable of handling multiple payment options?",
        answer: "Yes, we support UPI, Credit Cards, Cash, Bank Transfers, and split-billing, all while remaining fully GST-compliant."
    }
];

const FAQSection = () => {
    const [activeIndex, setActiveIndex] = useState(null);

    const toggleFAQ = (index) => {
        setActiveIndex(activeIndex === index ? null : index);
    };

    return (
        <section className="faq-section">
            <div className="faq-container">
                {/* Header with Icon */}
                <div className="faq-header-segment">
                    <div className="faq-bubble-icon">
                        <HelpCircle size={40} className="text-[#d41424]" />
                        <div className="faq-bubble-reflection"></div>
                    </div>
                    <h2 className="faq-title">Frequently Asked Questions</h2>
                    <p className="faq-subtitle">Everything you need to know about our hotel management platform.</p>
                </div>

                {/* FAQ Items */}
                <div className="faq-list">
                    {faqData.map((item, index) => (
                        <div
                            key={index}
                            className={`faq-item ${activeIndex === index ? "active" : ""}`}
                        >
                            <button className="faq-question" onClick={() => toggleFAQ(index)}>
                                <div className="faq-question-content">
                                    <div className="faq-q-icon-wrap">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                        </svg>
                                    </div>
                                    <span>{item.question}</span>
                                </div>
                                <div className="faq-toggle-icon">
                                    {activeIndex === index ? <Minus size={20} /> : <Plus size={20} />}
                                </div>
                            </button>
                            <AnimatePresence>
                                {activeIndex === index && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="faq-answer-wrap"
                                    >
                                        <div className="faq-answer-content">
                                            {item.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FAQSection;
