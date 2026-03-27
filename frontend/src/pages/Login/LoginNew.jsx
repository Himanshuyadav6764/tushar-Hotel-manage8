/*
UI REFACTOR NOTICE:

1. This component is a new Login UI.
2. Existing authentication logic is NOT modified.
3. Existing login function must be reused.
4. No API, token, or navigation logic is changed.
5. Old Login UI remains untouched.
6. This file only handles layout and styling.
7. The login button calls the same existing login handler.
*/
import React, { useState } from "react";
import "./LoginNew.css";
import { FaRegEnvelope, FaLock, FaEye, FaEyeSlash, FaShieldAlt, FaUser } from "react-icons/fa";

const LoginNew = ({ handleLogin, loading, error }) => {
    const [role, setRole] = useState("admin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const submitHandler = (e) => {
        e.preventDefault();

        if (loading) {
            return;
        }

        // 🔒 SAME EXISTING LOGIN LOGIC
        handleLogin({
            email,
            password,
            role,
        });
    };

    return (
        <div className="login-page-wrapper">
            <div className="login-container">

                {/* LEFT SECTION */}
                <div className="login-left">
                    <h1>
                        Secure Access to <br />
                        <span>Your Hotel Dashboard</span>
                    </h1>

                    <p className="subtext">
                        Manage reservations, staff operations, billing, and KOT system
                        from one centralized platform.
                    </p>

                    <div className="feature">
                        <div className="tick">✓</div>
                        <div>
                            <h4>Role-Based Access</h4>
                            <p>Admin and Staff permissions handled securely.</p>
                        </div>
                    </div>

                    <div className="feature">
                        <div className="tick">✓</div>
                        <div>
                            <h4>Real-Time Monitoring</h4>
                            <p>Track bookings, orders and operations instantly.</p>
                        </div>
                    </div>

                    <div className="feature">
                        <div className="tick">✓</div>
                        <div>
                            <h4>Secure Authentication</h4>
                            <p>Protected login with encrypted access control.</p>
                        </div>
                    </div>
                </div>

                {/* RIGHT LOGIN CARD */}
                <div className="login-card">
                    <h2>Welcome Back!</h2>
                    <p className="card-sub">
                        Login to manage your hotel operations
                    </p>

                    {/* ROLE TOGGLE */}
                    <div className="role-switch">
                        <button
                            className={role === "admin" ? "active" : ""}
                            onClick={() => setRole("admin")}
                            type="button"
                        >
                            <FaShieldAlt className="role-icon" /> Admin
                        </button>

                        <button
                            className={role === "staff" ? "active" : ""}
                            onClick={() => setRole("staff")}
                            type="button"
                        >
                            <FaUser className="role-icon" /> Staff
                        </button>
                    </div>

                    <form onSubmit={submitHandler}>
                        <div className="input-group">
                            <label>Email Address</label>
                            <div className="input-wrapper-new">
                                <FaRegEnvelope className="input-icon-new" />
                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Password</label>
                            <div className="input-wrapper-new">
                                <FaLock className="input-icon-new" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="eye-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex="-1"
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        {error && <div className="error-msg">{error}</div>}

                        {/* 🔒 SAME LOGIN LOGIC BUTTON */}
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? "LOGGING IN..." : "LOGIN"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginNew;
