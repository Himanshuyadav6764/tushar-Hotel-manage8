// API Configuration
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const productionFallbackApiUrl = 'https://hotel-manage9-three.vercel.app';

// In development, always use Vite proxy (/api -> localhost:5000)
// to avoid stale/incorrect host mappings from shell env vars.
// In production, prefer VITE_API_URL and fallback to known backend domain.
const rawApiUrl = import.meta.env.DEV
    ? ''
    : (configuredApiUrl || productionFallbackApiUrl);

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
