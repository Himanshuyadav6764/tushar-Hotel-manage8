import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ROLES } from '../config/rbac';
import API_URL from '../config/api';

const AuthContext = createContext(null);

// Configure axios
if (API_URL) {
    axios.defaults.baseURL = API_URL;
}

// Add a request interceptor to include the auth token
axios.interceptors.request.use(
    (config) => {
        const savedUser = localStorage.getItem('authUser');
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                const { token } = parsedUser;
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (error) {
                console.error('Error parsing authUser for token:', error);
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Load user from localStorage on mount
    useEffect(() => {
        const savedUser = localStorage.getItem('authUser');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (error) {
                console.error('Failed to parse saved user:', error);
                localStorage.removeItem('authUser');
            }
        }
        setLoading(false);
    }, []);

    // Login function
    const login = async (email, password, role, options = {}) => {
        try {
            const normalizedEmail = String(email || '').trim().toLowerCase();
            const payload = {
                username: normalizedEmail,
                password,
                role
            };

            if (options?.mfaCode) {
                payload.mfaCode = String(options.mfaCode).trim();
            }

            const response = await axios.post('/api/auth/login', payload);

            if (response.status === 202 && response.data?.requiresMfa) {
                return {
                    success: false,
                    requiresMfa: true,
                    error: response.data?.message || 'MFA verification required.'
                };
            }

            if (response.data) {
                const userWithToken = response.data;

                // Ensure lastLogin is updated
                const userWithUpdatedLogin = {
                    ...userWithToken,
                    lastLogin: new Date().toISOString()
                };

                setUser(userWithUpdatedLogin);
                localStorage.setItem('authUser', JSON.stringify(userWithUpdatedLogin));

                return { success: true, user: userWithUpdatedLogin };
            }
        } catch (error) {
            console.error('Login error:', error);
            if (error.response && error.response.status === 500) {
                console.error('Server 500 error data:', error.response.data);
            }
            let errorMessage = 'An unexpected error occurred';
            let requiresMfa = false;

            if (error.response) {
                // If Vite proxy fails, it sometimes returns an HTML/text error string on 500/504
                if (typeof error.response.data === 'string' && error.response.data.includes('proxy')) {
                    errorMessage = `Vite Proxy Error: Backend is down or port mismatched. Raw response: ${error.response.data.substring(0, 100)}...`;
                } else {
                    errorMessage = error.response.data?.message || error.response.data?.detail || `Server Error ${error.response.status}`;
                }
                requiresMfa = Boolean(error.response.data?.requiresMfa);
            } else if (error.request) {
                errorMessage = 'Server is unreachable. Please try again later.';
            } else {
                errorMessage = error.message;
            }

            return {
                success: false,
                error: errorMessage,
                requiresMfa
            };
        }
    };

    // Logout function
    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('authUser');

        // Hard navigation prevents stale protected snapshots from showing via browser back.
        const loginPaths = new Set(['/login', '/secure-owner-login', '/superadmin/login']);
        if (!loginPaths.has(window.location.pathname)) {
            window.history.replaceState(null, '', '/login');
            window.location.replace('/login');
        }
    }, []);

    // Update user data
    const updateUser = (updatedData) => {
        const updatedUser = { ...user, ...updatedData };
        setUser(updatedUser);
        localStorage.setItem('authUser', JSON.stringify(updatedUser));
    };

    // Check if user is authenticated
    const isAuthenticated = () => {
        return user !== null;
    };

    // Get user role
    const getUserRole = () => {
        return user?.role || null;
    };

    // Get subscription tier
    const getSubscriptionTier = () => {
        return user?.subscriptionTier || null;
    };

    const value = {
        user,
        login,
        logout,
        updateUser,
        isAuthenticated,
        getUserRole,
        getSubscriptionTier,
        loading,
        sidebarOpen,
        setSidebarOpen
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
