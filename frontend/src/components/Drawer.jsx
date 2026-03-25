import { motion, AnimatePresence } from 'framer-motion';
import './Drawer.css';

const Drawer = ({ isOpen, onClose, title, subtitle, icon, children, height = '600px' }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="drawer-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        className={`drawer-container ${height === 'premium' ? 'premium' : ''}`}
                        style={{ height: height === 'premium' ? undefined : height }}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                        {/* Header */}
                        <div className="drawer-header">
                            <div className="drawer-header-icon-wrap" aria-hidden="true">
                                <span className="drawer-header-icon">{icon || '⚙️'}</span>
                            </div>

                            <div className="drawer-header-text">
                                <h2 className="drawer-title">{title}</h2>
                                <span className="drawer-subtitle">{subtitle || 'PROCESS REQUEST'}</span>
                            </div>

                            <button className="drawer-close-btn" onClick={onClose}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Content - Scrollable */}
                        <div className="drawer-content">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default Drawer;
