import React from "react";
import { Link } from "react-router-dom";
import Reveal from "../components/Reveal";
import "./about.css";




const About = () => {
    return (
        <>
            <div className="about-page">

                {/* HERO */}
                <Reveal width="100%">
                    <section className="about-hero">
                        <div className="about-container">
                            <h1>
                                Empowering Modern Hotels <br />
                                <span>With Smart Digital Intelligence</span>
                            </h1>
                            <p>
                                At Bireena Atithi, we help hotels simplify operations,
                                improve guest experience, and increase revenue using
                                powerful smart automation.
                            </p>
                        </div>
                    </section>
                </Reveal>

                {/* STORY */}
                <Reveal width="100%">
                    <section className="about-story">
                        <h2 className="our-story-heading">Our Story</h2>

                        <div className="timeline-container">
                            <div className="timeline-content">
                                <div className="timeline-item left item-1">
                                    <span className="timeline-dot"></span>
                                    <div className="timeline-card">
                                        <h3>Idea Born</h3>
                                        <p>
                                            Our journey began with a simple vision to transform hotel
                                            operations through digital intelligence.
                                        </p>
                                    </div>
                                </div>

                                <div className="timeline-item right item-2">
                                    <span className="timeline-dot"></span>
                                    <div className="timeline-card">
                                        <h3>Identified Hotel Pain Points</h3>
                                        <p>
                                            We researched booking delays, billing errors,
                                            and operational bottlenecks.
                                        </p>
                                    </div>
                                </div>

                                <div className="timeline-item left item-3">
                                    <span className="timeline-dot"></span>
                                    <div className="timeline-card">
                                        <h3>Built Smart Reservation + KOT</h3>
                                        <p>
                                            Developed intuitive reservation and kitchen automation
                                            systems.
                                        </p>
                                    </div>
                                </div>

                                <div className="timeline-item right item-4">
                                    <span className="timeline-dot"></span>
                                    <div className="timeline-card">
                                        <h3>Now Powering Growing Hotels</h3>
                                        <p>
                                            Today we empower hotels to scale operations and deliver
                                            exceptional guest experiences.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </Reveal>

                {/* TEAM */}
                <Reveal width="100%">
                    <section className="about-team">
                        <div className="about-container">
                            <h2 className="team-heading">Meet Our Team</h2>
                            <p className="team-subheading">The passionate minds behind Bireena Atithi's smart ecosystem.</p>

                            <div className="team-grid">
                                <div className="team-card">
                                    <div className="team-image">
                                        <img src="/images/dipika.jpg" alt="Dipika Singh" />
                                    </div>
                                    <div className="team-info">
                                        <h4>Dipika Singh</h4>
                                        <span>Founder and Director</span>
                                    </div>
                                </div>
                                <div className="team-card">
                                    <div className="team-image">
                                        <img src="/images/himanshu.jpg" alt="Himanshu Yadav" />
                                    </div>
                                    <div className="team-info">
                                        <h4>Himanshu Yadav</h4>
                                        <span>Full Stack Developer</span>
                                    </div>
                                </div>
                                <div className="team-card">
                                    <div className="team-image">
                                        <img src="/images/ankit.jpeg" alt="Ankit Kumar Gupta" />
                                    </div>
                                    <div className="team-info">
                                        <h4>Ankit Kumar Gupta</h4>
                                        <span>Project Manager</span>
                                    </div>
                                </div>
                                <div className="team-card">
                                    <div className="team-image">
                                        <img src="/images/tushar.jpg" alt="Tushar Kumar" />
                                    </div>
                                    <div className="team-info">
                                        <h4>Tushar Kumar</h4>
                                        <span>Backend Developer</span>
                                    </div>
                                </div>
                                <div className="team-card">
                                    <div className="team-image">
                                        <img src="/images/shekhar.jpg" alt="Shekhar Kumar" />
                                    </div>
                                    <div className="team-info">
                                        <h4>Shekhar Kumar</h4>
                                        <span>Backend Developer</span>
                                    </div>
                                </div>
                                <div className="team-card">
                                    <div className="team-image">
                                        <img src="/images/arshad.jpg" alt="Md Arsad Raza" />
                                    </div>
                                    <div className="team-info">
                                        <h4>Md Arshad Raza</h4>
                                        <span>Frontend Developer</span>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </section>
                </Reveal>




                {/* CTA */}
                <Reveal width="100%">
                    <section className="about-cta">
                        <h2>Transform Your Hotel with Smart Digital Intelligence</h2>
                        <p>Elevate your service, automate your KOT, and grow your revenue with Bireena Atithi's smart ecosystem.</p>
                        <Link to="/login">
                            <button onClick={() => window.scrollTo(0, 0)}>Book a Free Demo</button>
                        </Link>
                    </section>
                </Reveal>

            </div>
        </>
    );
};

export default About;
