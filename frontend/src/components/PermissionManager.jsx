import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../config/rbac';
import { getSubscriptionPricing } from '../../utils/subscriptionCheck';
import ActivityLog from '../../components/ActivityLog';
import './PermissionManager.css';

/**
 * Permission Manager Component
 * Admin-only interface for viewing and managing role permissions
 */
const PermissionManager = () => {
    const { user } = useAuth();
    const [selectedRole, setSelectedRole] = useState(ROLES.MANAGER);
    const [viewMode, setViewMode] = useState('matrix'); // 'matrix' or 'list'

    // Only Admin and Super Admin can access
    if (user.role !== ROLES.ADMIN && user.role !== ROLES.SUPER_ADMIN) {
        return (
            <div className="permission-manager-denied">
                <h3>🔒 Access Restricted</h3>
                <p>Only Admins can manage permissions</p>
            </div>
        );
    }

    const { MODULES, ACCESS_MATRIX, PERMISSIONS } = require('../../config/rbac');

    const allRoles = Object.values(ROLES);
    const allModules = Object.keys(MODULES).map(key => ({
        id: MODULES[key],
        name: key.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
    }));

    const getPermissionIcon = (permission) => {
        switch (permission) {
            case PERMISSIONS.VIEW: return '👁️';
            case PERMISSIONS.CREATE: return '➕';
            case PERMISSIONS.EDIT: return '✏️';
            case PERMISSIONS.DELETE: return '🗑️';
            case PERMISSIONS.FULL: return '⭐';
            default: return '•';
        }
    };

    const getPermissionColor = (permission) => {
        switch (permission) {
            case PERMISSIONS.VIEW: return '#3b82f6';
            case PERMISSIONS.CREATE: return '#10b981';
            case PERMISSIONS.EDIT: return '#f59e0b';
            case PERMISSIONS.DELETE: return '#d41424';
            case PERMISSIONS.FULL: return '#8b5cf6';
            default: return '#6b7280';
        }
    };

    return (
        <div className="permission-manager">
            <div className="permission-header">
                <div>
                    <h2>🔐 Permission Management</h2>
                    <p className="permission-subtitle">View and understand role-based access control</p>
                </div>
                <div className="permission-controls">
                    <select
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value)}
                        className="view-mode-select"
                    >
                        <option value="matrix">Matrix View</option>
                        <option value="list">List View</option>
                    </select>
                </div>
            </div>

            {viewMode === 'matrix' ? (
                <>
                    {/* Role Selector */}
                    <div className="role-selector">
                        {allRoles.map(role => (
                            <button
                                key={role}
                                className={`role-btn ${selectedRole === role ? 'active' : ''}`}
                                onClick={() => setSelectedRole(role)}
                            >
                                {role}
                            </button>
                        ))}
                    </div>

                    {/* Permission Matrix for Selected Role */}
                    <div className="permission-matrix-card">
                        <h3>Permissions for: <span className="role-highlight">{selectedRole}</span></h3>

                        <div className="permission-grid">
                            {allModules.map(module => {
                                const permissions = ACCESS_MATRIX[module.id]?.[selectedRole] || [];

                                return (
                                    <div key={module.id} className="module-permission-row">
                                        <div className="module-name">{module.name}</div>
                                        <div className="module-permissions">
                                            {permissions.length === 0 ? (
                                                <span className="no-access">❌ No Access</span>
                                            ) : (
                                                permissions.map(perm => (
                                                    <span
                                                        key={perm}
                                                        className="permission-badge"
                                                        style={{
                                                            background: `${getPermissionColor(perm)}20`,
                                                            color: getPermissionColor(perm),
                                                            border: `1px solid ${getPermissionColor(perm)}40`
                                                        }}
                                                    >
                                                        {getPermissionIcon(perm)} {perm}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            ) : (
                /* Complete Access Matrix - All Roles */
                <div className="full-matrix-view">
                    <div className="matrix-table-container">
                        <table className="access-matrix-table">
                            <thead>
                                <tr>
                                    <th>Module</th>
                                    {allRoles.map(role => (
                                        <th key={role}>{role}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {allModules.map(module => (
                                    <tr key={module.id}>
                                        <td className="module-cell">{module.name}</td>
                                        {allRoles.map(role => {
                                            const permissions = ACCESS_MATRIX[module.id]?.[role] || [];
                                            return (
                                                <td key={role} className="permission-cell">
                                                    {permissions.length === 0 ? (
                                                        <span className="no-access-mini">-</span>
                                                    ) : (
                                                        <div className="permissions-list">
                                                            {permissions.map(perm => (
                                                                <span
                                                                    key={perm}
                                                                    className="perm-mini"
                                                                    style={{ color: getPermissionColor(perm) }}
                                                                    title={perm}
                                                                >
                                                                    {getPermissionIcon(perm)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="permission-legend">
                <h4>Permission Types:</h4>
                <div className="legend-items">
                    {Object.values(PERMISSIONS).map(perm => (
                        <div key={perm} className="legend-item">
                            <span style={{ color: getPermissionColor(perm), fontSize: '18px' }}>
                                {getPermissionIcon(perm)}
                            </span>
                            <span>{perm}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Info Note */}
            <div className="permission-note">
                <strong>ℹ️ Note:</strong> This is a read-only view of the current permission structure.
                To modify permissions, update the RBAC configuration file and redeploy the application.
            </div>
        </div>
    );
};

export default PermissionManager;
