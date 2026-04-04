const isDev = import.meta.env.DEV;
const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

// In development, prefer same-origin `/api` so Vite proxy is used.
const API_URL = configuredApiUrl || (isDev ? '' : 'http://localhost:5000');

const DEV_LOCAL_FALLBACKS = ['http://localhost:5000', 'http://localhost:5001'];

const normalizeEndpoint = (endpoint) => {
    if (!endpoint) return '/';
    if (endpoint.startsWith('http')) return endpoint;
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
};

const buildUrl = (base, endpoint) => {
    if (endpoint.startsWith('http')) return endpoint;
    return base ? `${base}${endpoint}` : endpoint;
};

export default API_URL;

export const apiCall = async (endpoint, options = {}) => {
    const normalizedEndpoint = normalizeEndpoint(endpoint);

    const fetchWithHeaders = async (url) => {
        const savedUser = localStorage.getItem('authUser');
        const guestAccessToken = localStorage.getItem('guestAccessToken');
        const guestTenantContextRaw = localStorage.getItem('guestTenantContext');
        const allowGuestHeaders = options?.allowGuestHeaders === true;
        let authHeaders = {};
        let hasUserToken = false;

        if (savedUser) {
            try {
                const parsed = JSON.parse(savedUser);
                if (parsed && parsed.token) {
                    authHeaders['Authorization'] = `Bearer ${parsed.token}`;
                    hasUserToken = true;
                }

                if (parsed?.hotelId) {
                    authHeaders['x-hotel-id'] = String(parsed.hotelId);
                }

                if (parsed?.dbName) {
                    authHeaders['x-tenant-db'] = String(parsed.dbName);
                }
            } catch (e) {
                console.warn('Auth token retrieval failed', e);
            }
        }

        // Do not attach stale guest headers on authenticated staff/admin requests.
        if (guestAccessToken && (!hasUserToken || allowGuestHeaders)) {
            authHeaders['x-guest-access-token'] = guestAccessToken;
        }

        if (guestTenantContextRaw && (!hasUserToken || allowGuestHeaders)) {
            try {
                const tenantCtx = JSON.parse(guestTenantContextRaw);
                if (tenantCtx?.hotelId) {
                    authHeaders['x-hotel-id'] = tenantCtx.hotelId;
                }
                if (tenantCtx?.dbName) {
                    authHeaders['x-tenant-db'] = tenantCtx.dbName;
                }
            } catch (error) {
                console.warn('Guest tenant context parse failed', error);
            }
        }

        const headers = {
            ...authHeaders,
            ...options.headers
        };

        return fetch(url, {
            ...options,
            headers
        });
    };

    try {
        const primaryUrl = buildUrl(API_URL, normalizedEndpoint);
        const response = await fetchWithHeaders(primaryUrl);
        
        return response;
    } catch (error) {
        // Dev fallback: if primary request failed at network level, try common local ports.
        if (isDev && !normalizedEndpoint.startsWith('http') && error instanceof TypeError) {
            const fallbackBases = DEV_LOCAL_FALLBACKS.filter((base) => base !== API_URL);

            for (const base of fallbackBases) {
                try {
                    const fallbackUrl = buildUrl(base, normalizedEndpoint);
                    return await fetchWithHeaders(fallbackUrl);
                } catch (fallbackError) {
                    // Keep trying other candidates.
                }
            }
        }

        console.error('API call error:', error);
        throw error;
    }
};
