import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasModuleAccess } from '../config/rbac';

/**
 * ProtectedRoute Component
 * Protects routes based on authentication and module access permissions
 */
const ProtectedRoute = ({ children, module, role }) => {
    const { user, isAuthenticated, loading } = useAuth();
    const safeUser = user && typeof user === 'object' ? user : null;
    let hasStoredToken = false;

    try {
        const raw = localStorage.getItem('authUser');
        if (raw) {
            const parsed = JSON.parse(raw);
            hasStoredToken = !!parsed?.token;
        }
    } catch (error) {
        hasStoredToken = false;
    }

    const authenticated = (typeof isAuthenticated === 'function' ? isAuthenticated() : !!safeUser) && hasStoredToken;

    // Show loading state while checking authentication
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontSize: '20px',
                fontWeight: '500'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '40px', marginBottom: '20px' }}>🔐</div>
                    <div>Checking permissions...</div>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    // If role is specified, check if user has that role
    if (role && safeUser?.role !== role) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                flexDirection: 'column',
                padding: '20px',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '80px', marginBottom: '30px' }}>🚫</div>
                <h1 style={{ fontSize: '32px', marginBottom: '15px' }}>Access Denied</h1>
                <p style={{ fontSize: '18px', marginBottom: '30px', opacity: 0.9 }}>
                    Your role (<strong>{safeUser?.role || 'unknown'}</strong>) does not have access to this page.
                </p>
                <button
                    onClick={() => window.history.back()}
                    style={{
                        padding: '12px 30px',
                        background: 'white',
                        color: '#f5576c',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600'
                    }}
                >
                    ← Go Back
                </button>
            </div>
        );
    }

    // If module is specified, check if user has access
    if (module) {
        if (safeUser?.role === 'super_admin' || safeUser?.role === 'superadmin') {
            return children;
        }

        const modulesToCheck = Array.isArray(module) ? module : [module];
        let hasAccess = false;

        try {
            hasAccess = modulesToCheck.some(m => hasModuleAccess(safeUser, m));
        } catch (error) {
            console.error('ProtectedRoute permission check failed:', error);
            hasAccess = false;
        }

        if (!hasAccess) {
            return (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    flexDirection: 'column',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '80px', marginBottom: '30px' }}>🚫</div>
                    <h1 style={{ fontSize: '32px', marginBottom: '15px' }}>Access Denied</h1>
                    <p style={{ fontSize: '18px', marginBottom: '30px', opacity: 0.9 }}>
                        You don't have permission to access this module.
                    </p>
                    <p style={{ fontSize: '16px', opacity: 0.8 }}>
                        Your Role: <strong>{safeUser?.role || 'unknown'}</strong>
                    </p>
                    <button
                        onClick={() => window.history.back()}
                        style={{
                            marginTop: '30px',
                            padding: '12px 30px',
                            fontSize: '16px',
                            background: 'white',
                            color: '#f5576c',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                    >
                        ← Go Back
                    </button>
                </div>
            );
        }
    }

    // User is authenticated and has access
    return children;
};

export default ProtectedRoute;
