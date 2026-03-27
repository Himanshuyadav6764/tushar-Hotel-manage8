import API_URL, { apiCall } from '../config/api';

/**
 * Search for bookings/reservations based on keyword
 * @param {string} keyword - Guest Name, Mobile, or Room Number
 * @returns {Promise} - Search results
 */
export const searchBookings = async (keyword) => {
    try {
        if (!keyword || keyword.trim() === '') {
            return { success: true, data: [] };
        }

        const response = await apiCall(`/api/bookings/search?q=${encodeURIComponent(keyword)}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[searchService] API Error:', error);
        throw error;
    }
};
