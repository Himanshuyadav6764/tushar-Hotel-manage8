import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import LogoNew from '../../assets/logo_new.jpg';
import '../Login/Login.css'; // Import global Login styles
import './SuperAdminLogin.css'; // Import specific overrides

const SuperAdminLogin = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        mfaCode: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [mfaRequired, setMfaRequired] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const submitInFlightRef = useRef(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
        setInfoMessage('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (loading || submitInFlightRef.current) {
            return;
        }

        submitInFlightRef.current = true;
        setLoading(true);
        setError('');
        setInfoMessage('');

        try {
            const result = await login(formData.email, formData.password, 'admin', {
                mfaCode: mfaRequired ? formData.mfaCode : ''
            });

            if (result.requiresMfa) {
                setMfaRequired(true);
                setInfoMessage(result.error || 'MFA code sent. Please verify to continue.');
                return;
            }

            if (result.success) {
                if (result.user.role === 'super_admin') {
                    navigate('/super-admin/dashboard', { replace: true });
                    return;
                }

                setError('Unauthorized access. Super Admins only.');
            } else {
                setError(result.error || 'Login failed');
            }
        } finally {
            submitInFlightRef.current = false;
            setLoading(false);
        }
    };

    return (
        <div className="login-page super-admin-login-wrapper">
            <motion.div
                className="login-container super-admin-container"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
            >
                {/* LEFT SECTION - Branding */}
                <div className="login-left">
                    <div className="branding-content">
                        <div className="logo-large">
                            <img src={LogoNew} alt="BIREENA ATITHI" className="project-logo-large" style={{ mixBlendMode: 'multiply', height: '80px', width: 'auto' }} />
                            <div className="sa-header-logo">
                            <img src={LogoNew} alt="BIREENA ATITHI" className="project-logo-main" />
                        </div>
                        </div>

                        <div className="sa-header-logo">
                            <img src={LogoNew} alt="BIREENA ATITHI" className="project-logo-main" />
                        </div>

                        <div className="branding-text">
                            <p>Global System Management</p>
                            <p>Secure Access for Owners Only</p>
                        </div>

                        <div className="login-illustration">
                            <img
                                src="/images/login-hero.png"
                                alt="Admin Access"
                            />
                        </div>

                        <div className="security-badge super-admin-badge">
                            <span className="badge-icon">🛡️</span>
                            <span>Secure Owner Login</span>
                        </div>
                    </div>
                </div>

                {/* RIGHT SECTION - Login Card */}
                <div className="login-right">
                    <motion.div
                        className="login-card"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="email">Secure Email</label>
                                <div className="input-wrapper super-admin-input">
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="Enter super admin email"
                                        required
                                        disabled={loading}
                                    />
                                    <span className="input-icon">📧</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Passcode</label>
                                <div className="input-wrapper super-admin-input">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        placeholder="Enter secure passcode"
                                        required
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="toggle-password"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex="-1"
                                    >
                                        {showPassword ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>

                            {mfaRequired && (
                                <div className="form-group">
                                    <label htmlFor="mfaCode">MFA Code</label>
                                    <div className="input-wrapper super-admin-input">
                                        <input
                                            type="text"
                                            id="mfaCode"
                                            name="mfaCode"
                                            value={formData.mfaCode}
                                            onChange={handleInputChange}
                                            placeholder="Enter 6-digit code"
                                            required={mfaRequired}
                                            maxLength={6}
                                            inputMode="numeric"
                                            disabled={loading}
                                        />
                                        <span className="input-icon">#</span>
                                    </div>
                                </div>
                            )}

                            {infoMessage && (
                                <div style={{
                                    color: '#1e3a8a',
                                    background: '#dbeafe',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    fontSize: '0.9rem',
                                    marginBottom: '1rem',
                                    textAlign: 'center'
                                }}>
                                    {infoMessage}
                                </div>
                            )}

                            {error && (
                                <div style={{
                                    color: '#E31E24',
                                    background: '#fee2e2',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    fontSize: '0.9rem',
                                    marginBottom: '1rem',
                                    textAlign: 'center'
                                }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="login-btn super-admin-btn"
                                disabled={loading}
                            >
                                {loading ? 'Verifying...' : (mfaRequired ? 'Verify MFA & Access' : 'Access Dashboard')}
                            </button>
                        </form>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};

export default SuperAdminLogin;
