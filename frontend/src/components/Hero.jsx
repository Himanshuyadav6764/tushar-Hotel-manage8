import React from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Play } from 'lucide-react';
import './Hero.css';
import HeroPreviewImage from '../assets/Gemini_Generated_Image_u26c1vu26c1vu26c.png';

import { MotionDiv, fadeLeft, fadeRight } from './MotionWrapper';
import Parallax from './Parallax';

const Hero = () => {
    return (
        <section className="landing-hero overflow-hidden">
            <div className="hero-surface" aria-hidden="true"></div>
            <div className="hero-glow" aria-hidden="true"></div>

            <div className="hero-shell">
                <Parallax speed={30} className="hero-copy-wrapper">
                    <MotionDiv variant={fadeLeft} className="hero-copy">
                        <h1>
                            <span className="hero-title-main">Manage Your Hotel</span>
                            <span className="hero-title-sub">Smarter, Faster & Better</span>
                        </h1>

                        <p>
                            All-in-one hotel management system for bookings, billing, staff
                            analytics, and daily operations.
                        </p>

                        <div className="hero-cta-group">
                            <Link to="/login" className="hero-btn hero-btn-primary btn-premium" onClick={() => window.scrollTo(0, 0)}>
                                <Rocket size={18} />
                                <span>Get Started</span>
                            </Link>

                            <button 
                                type="button" 
                                className="hero-btn hero-btn-ghost btn-premium"
                                onClick={() => {
                                    const el = document.getElementById('schedule-demo');
                                    if (el) {
                                        const yOffset = -80; // account for fixed header offset if any
                                        const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
                                        window.scrollTo({top: y, behavior: 'smooth'});
                                    }
                                }}
                            >
                                <span className="play-dot" aria-hidden="true">
                                    <Play size={12} fill="currentColor" />
                                </span>
                                <span>Live Demo</span>
                            </button>
                        </div>
                    </MotionDiv>
                </Parallax>

                <Parallax speed={40} className="hero-visual-wrapper">
                    <MotionDiv variant={fadeRight} className="hero-visual hero-visual-single">
                        <img
                            src={HeroPreviewImage}
                            alt="Bireena Atithi dashboard and mobile preview"
                            className="hero-mockup-combined animate-float"
                            loading="eager"
                        />
                    </MotionDiv>
                </Parallax>
            </div>
        </section>
    );
};

export default Hero;
