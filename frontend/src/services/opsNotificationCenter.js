import { io } from 'socket.io-client';
import API_URL from '../config/api';
import soundManager from '../utils/soundManager';

const SOCKET_EVENT = 'ops:notification';
const KEY_TTL_MS = 30000;

class OpsNotificationCenter {
    constructor() {
        this.initialized = false;
        this.socket = null;
        this.listeners = new Set();
        this.connectionListeners = new Set();
        this.recentEventKeys = new Map();
        this.recentAlertKeys = new Map();
        this.audioPrimed = false;
    }

    init() {
        if (typeof window === 'undefined' || this.initialized) return;

        this.initialized = true;
        this.attachInteractionBootstrap();
        this.ensureSocketConnection();
    }

    attachInteractionBootstrap() {
        const bootstrap = () => {
            this.primeAudio();
            this.requestBrowserPermission();
        };

        ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
            window.addEventListener(eventName, bootstrap, { passive: true, once: true });
        });
    }

    primeAudio() {
        if (this.audioPrimed) return;

        this.audioPrimed = true;
        soundManager.warmup('notification');
    }

    requestBrowserPermission() {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') {
            return;
        }

        if (Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {
                // Ignore permission errors.
            });
        }
    }

    ensureSocketConnection() {
        if (typeof window === 'undefined' || this.socket) return;

        const endpoint = API_URL || window.location.origin;
        this.socket = io(endpoint, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            timeout: 8000,
        });

        this.socket.on('connect', () => {
            this.emitConnectionState(true);
        });

        this.socket.on('disconnect', () => {
            this.emitConnectionState(false);
        });

        this.socket.on(SOCKET_EVENT, (payload) => {
            this.handleIncomingRealtime(payload || {});
        });
    }

    handleIncomingRealtime(payload) {
        const eventId = String(payload.eventId || `${payload.entity || 'ops'}-${payload.entityId || 'unknown'}-${Date.now()}`);
        if (!this.consumeEventKey(eventId)) return;

        const normalizedPayload = {
            ...payload,
            eventId,
        };

        this.listeners.forEach((listener) => {
            listener(normalizedPayload);
        });

        this.triggerAlert({
            alertKey: eventId,
            title: payload.title || 'New operational alert',
            message: payload.message || 'A new operational update is available.',
            tag: payload.module || payload.entity || 'ops-notification',
            data: normalizedPayload,
        });
    }

    subscribe(listener) {
        this.init();
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    subscribeConnection(listener) {
        this.init();
        this.connectionListeners.add(listener);

        return () => {
            this.connectionListeners.delete(listener);
        };
    }

    emitConnectionState(isConnected) {
        this.connectionListeners.forEach((listener) => {
            listener(Boolean(isConnected));
        });
    }

    triggerAlert({ alertKey, title, message, tag, data }) {
        const safeKey = String(alertKey || `${tag || 'ops'}-${Date.now()}`);
        if (!this.consumeAlertKey(safeKey)) return false;

        soundManager.play('notification', { force: true });

        if (typeof window !== 'undefined' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                new Notification(title || 'Notification', {
                    body: message || 'New update received.',
                    tag: String(tag || 'ops-alert'),
                    renotify: true,
                    data,
                });
            } catch (_) {
                // Ignore browser notification failures.
            }
        }

        return true;
    }

    consumeEventKey(key) {
        this.evictExpired(this.recentEventKeys);
        if (this.recentEventKeys.has(key)) return false;

        this.recentEventKeys.set(key, Date.now() + KEY_TTL_MS);
        return true;
    }

    consumeAlertKey(key) {
        this.evictExpired(this.recentAlertKeys);
        if (this.recentAlertKeys.has(key)) return false;

        this.recentAlertKeys.set(key, Date.now() + KEY_TTL_MS);
        return true;
    }

    evictExpired(store) {
        const now = Date.now();
        for (const [key, expiresAt] of store.entries()) {
            if (expiresAt <= now) {
                store.delete(key);
            }
        }
    }
}

const opsNotificationCenter = new OpsNotificationCenter();
export default opsNotificationCenter;
