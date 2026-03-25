// API Configuration
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const productionFallbackApiUrl = 'https://hotel-manage9-three.vercel.app';

// Default to same-origin API in both dev and prod when no explicit URL is provided.
// Dev uses Vite proxy (/api -> localhost:5000); production uses hosting rewrites.
const rawApiUrl = configuredApiUrl || (import.meta.env.DEV ? '' : productionFallbackApiUrl);

const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

export default API_URL;

// Helper function for making API calls
export const apiCall = async (endpoint, options = {}) => {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        return response;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
};
