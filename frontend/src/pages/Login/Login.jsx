import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDefaultRoute } from '../../config/rbac';
import LoginNew from './LoginNew';

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const submitInFlightRef = useRef(false);

    // Redirect if already logged in (Guest Guard) - Client requested to check/fix login page visibility
    // useEffect(() => {
    //     if (isAuthenticated() && user) {
    //         const defaultRoute = getDefaultRoute(user);
    //         navigate(defaultRoute, { replace: true });
    //     }
    // }, [isAuthenticated, user, navigate]);

    const handleLogin = async ({ email, password, role }) => {
        if (submitInFlightRef.current || loading) {
            return;
        }

        submitInFlightRef.current = true;
        setLoading(true);
        setError('');

        try {
            const result = await login(email, password, role);

            if (result.success) {
                // Smart redirect based on user's first accessible page
                const defaultRoute = getDefaultRoute(result.user);
                navigate(defaultRoute, { replace: true });
                return;
            }

            setError(result.error || 'Login failed. Please try again.');
        } finally {
            submitInFlightRef.current = false;
            setLoading(false);
        }
    };

    return (
        <LoginNew handleLogin={handleLogin} loading={loading} error={error} />
    );
};

export default Login;
