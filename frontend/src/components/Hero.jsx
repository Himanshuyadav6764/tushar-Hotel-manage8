import { Link } from 'react-router-dom';
import HeroImage from '../assets/Hero Image 3.png';
import './Hero.css';
import ParticlesBackground from './ParticlesBackground';

const Hero = () => {
    return (
        <section className="hero landing-hero">
            <ParticlesBackground />
            <div className="container hero-container hero-flex">

                <div className="hero-text hero-left">
                    <h1 className="hero-title">
                        <span className="line line-1">Smart Hotel</span>
                        <br />
                        <span className="line line-1b">Management Software</span>
                        <br />
                        <span className="hero-accent line line-2">with KOT</span>
                    </h1>

                    <p className="hero-description hero-animate">
                        Simplify your hotel operations with our powerful and easy-to-use software.
                        Manage reservations, room services, billing, and KOT efficiently.
                    </p>

                    <div>
                        <Link to="/login" className="cta-btn hero-cta">
                            Get Started
                        </Link>
                    </div>
                </div>

                <div className="hero-image hero-img-container hero-right hero-img-animate">
                    <img src={HeroImage} alt="Hotel Management Dashboard" className="hero-banner-img" />
                </div>

            </div>
        </section>
    );
};

export default Hero;
