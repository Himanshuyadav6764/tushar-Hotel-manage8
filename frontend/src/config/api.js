const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default API_URL;

export const apiCall = async (endpoint, options = {}) => {
    try {
        const savedUser = localStorage.getItem('authUser');
        let authHeaders = {};

        if (savedUser) {
            try {
                const parsed = JSON.parse(savedUser);
                if (parsed && parsed.token) {
                    authHeaders['Authorization'] = `Bearer ${parsed.token}`;
                }
            } catch (e) {
                console.warn('Auth token retrieval failed', e);
            }
        }

        const headers = {
            ...authHeaders,
            ...options.headers
        };

        const finalUrl = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

        const response = await fetch(finalUrl, {
            ...options,
            headers
        });
        
        return response;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
};
