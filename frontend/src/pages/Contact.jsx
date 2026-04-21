import { useState } from 'react';
import '../components/DemoForm.css';

// Using direct import for assets handled by Vite
import CustomerVibesImg from '../assets/Customer support with cheerful vibes.png';

const Contact = () => {
    const whatsappNumber = '919304942225';
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        city: '',
        hotelName: ''
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
            'New Demo Request',
            `Name: ${formData.name}`,
            `Email: ${formData.email}`,
            `Phone: ${formData.phone}`,
            `City: ${formData.city}`,
            `Hotel Name: ${formData.hotelName}`
        ].join('\n');

        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div style={{ background: "#fff6f7", minHeight: "100vh" }}>
            <section className="demo-section">
                <div className="demo-container">
                    {/* LEFT FORM */}
                    <div className="demo-form">
                        <h2>Schedule a free demo</h2>
                        <p className="demo-subtitle">
                            Get in touch with our team to clarify your queries
                        </p>

                        <form onSubmit={handleSubmit} className="demo-actual-form">
                            <div className="form-grid-top">
                                <div className="form-group">
                                    <label>Name<span>*</span></label>
                                    <input type="text" name="name" value={formData.name} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Email<span>*</span></label>
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                                </div>
                            </div>

                            <div className="form-grid-bottom">
                                <div className="form-group">
                                    <label>Phone number<span>*</span></label>
                                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>City<span>*</span></label>
                                    <input type="text" name="city" value={formData.city} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Hotel Name<span>*</span></label>
                                    <input type="text" name="hotelName" value={formData.hotelName} onChange={handleChange} required />
                                </div>
                            </div>

                            <div className="demo-features-wrap">
                                <ul className="demo-features-list">
                                    <li><span className="check">✔</span> Real time Tracking</li>
                                    <li><span className="check">✔</span> CRM & Reporting</li>
                                    <li><span className="check">✔</span> Hotel Name<span>*</span></li>
                                </ul>
                            </div>

                            <div className="submit-wrap">
                                <button type="submit" className="demo-submit-btn">
                                    Submit
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* RIGHT ILLUSTRATION */}
                    <div className="demo-illustration">
                        <div className="demo-img-wrapper">
                            <div className="demo-glow-inner" aria-hidden="true" />
                            <img src={CustomerVibesImg} alt="Demo Illustration" className="demo-customer-img" />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Contact;
