import { useAuth } from '../context/AuthContext';
import { ROLES } from '../config/rbac';
import './RoleBadge.css';

/**
 * Role Badge Component
 * Displays the current user's role as a visual badge
 */
const RoleBadge = () => {
    const { user } = useAuth();

    if (!user) return null;

    const getRoleColor = (role) => {
        switch (role) {
            case ROLES.SUPER_ADMIN: return { bg: '#f59e0b', text: '#78350f' }; // Orange
            case ROLES.ADMIN: return { bg: '#8b5cf6', text: '#4c1d95' }; // Purple
            case ROLES.MANAGER: return { bg: '#3b82f6', text: '#1e3a8a' }; // Blue
            case ROLES.RECEPTIONIST: return { bg: '#10b981', text: '#065f46' }; // Green
            case ROLES.ACCOUNTANT: return { bg: '#d41424', text: '#7f1d1d' }; // Red
            case ROLES.WAITER: return { bg: '#ec4899', text: '#831843' }; // Pink
            case ROLES.STAFF: return { bg: '#6b7280', text: '#1f2937' }; // Gray
            default: return { bg: '#9ca3af', text: '#374151' };
        }
    };

    const getRoleIcon = (role) => {
        switch (role) {
            case ROLES.SUPER_ADMIN: return '👑';
            case ROLES.ADMIN: return '⚡';
            case ROLES.MANAGER: return '📊';
            case ROLES.RECEPTIONIST: return '📋';
            case ROLES.ACCOUNTANT: return '💰';
            case ROLES.WAITER: return '🍽️';
            case ROLES.STAFF: return '👤';
            default: return '•';
        }
    };

    const colors = getRoleColor(user.role);

    return (
        <div
            className="role-badge"
            style={{
                background: `${colors.bg}20`,
                border: `2px solid ${colors.bg}`,
                color: colors.text
            }}
            title={`Logged in as ${user.role}`}
        >
            <span className="role-icon">{getRoleIcon(user.role)}</span>
            <span className="role-text">{user.role}</span>
        </div>
    );
};

export default RoleBadge;
