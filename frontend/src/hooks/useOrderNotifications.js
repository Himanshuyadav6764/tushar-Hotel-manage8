import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiCall } from '../config/api';
import opsNotificationCenter from '../services/opsNotificationCenter';

const FEED_KEY = 'order_notification_feed_v1';
const MAX_FEED_ITEMS = 100;

const ROOM_TYPES = ['post to room', 'room order', 'room service'];
const ONLINE_TYPES = ['online', 'online order', 'delivery'];
const TABLE_TYPES = ['dine in', 'dine-in', 'direct payment', 'table order', 'table'];

const normalize = (value) => String(value || '').trim().toLowerCase();

const safeJsonParse = (raw, fallback) => {
    try {
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
};

const readFeed = () => {
    if (typeof window === 'undefined') return [];
    return safeJsonParse(localStorage.getItem(FEED_KEY) || '[]', []);
};

const writeFeed = (feed) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(FEED_KEY, JSON.stringify(feed.slice(0, MAX_FEED_ITEMS)));
};

const scopeSeenKey = (scope) => `order_notification_seen_${scope}`;
const scopeDismissedKey = (scope) => `order_notification_dismissed_${scope}`;

const readSeenTs = (scope) => {
    if (typeof window === 'undefined') return 0;
    const raw = localStorage.getItem(scopeSeenKey(scope));
    const value = Number(raw || 0);
    return Number.isFinite(value) ? value : 0;
};

const writeSeenTs = (scope, ts) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(scopeSeenKey(scope), String(ts));
};

const readDismissedOrderIds = (scope) => {
    if (typeof window === 'undefined') return new Set();
    const raw = localStorage.getItem(scopeDismissedKey(scope)) || '[]';
    const parsed = safeJsonParse(raw, []);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((v) => String(v || '')).filter(Boolean));
};

const writeDismissedOrderIds = (scope, idSet) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(scopeDismissedKey(scope), JSON.stringify(Array.from(idSet)));
};

const isOpenLikeStatus = (status) => !['closed', 'billed', 'cancelled', 'completed', 'settled'].includes(normalize(status));

const forScope = (scope, order) => {
    if (scope === 'housekeeping') return true;

    const orderType = normalize(order.orderType);
    const status = normalize(order.status);

    if (scope === 'room-service') return ROOM_TYPES.includes(orderType);
    if (scope === 'online-order') return ONLINE_TYPES.includes(orderType);
    if (scope === 'table-view') return TABLE_TYPES.includes(orderType);
    if (scope === 'cashier') {
        return ['pending payment', 'billed', 'closed', 'completed', 'settled'].includes(status);
    }
    if (scope === 'kot-view') return isOpenLikeStatus(status);

    return false;
};

const toOrderSnapshot = (order) => ({
    id: String(order._id || ''),
    status: String(order.status || ''),
    updatedAt: String(order.updatedAt || order.createdAt || ''),
    orderType: String(order.orderType || ''),
    guestName: String(order.guestName || 'Guest'),
    roomNumber: String(order.roomNumber || ''),
    tableNumber: String(order.tableNumber || ''),
    createdAt: String(order.createdAt || ''),
});

const toHousekeepingSnapshot = (task) => ({
    id: String(task._id || ''),
    status: String(task.status || 'pending'),
    roomNumber: String(task.roomNumber || ''),
    pendingAcknowledged: Boolean(task.pendingAcknowledged),
    updatedAt: String(task.updatedAt || task.pendingAcknowledgedAt || task.createdAt || ''),
    createdAt: String(task.createdAt || ''),
});

const buildTitle = (scope) => {
    if (scope === 'room-service') return 'Room Service Order Alert';
    if (scope === 'online-order') return 'Online Order Alert';
    if (scope === 'table-view') return 'Table Order Alert';
    if (scope === 'cashier') return 'Cashier Order Alert';
    if (scope === 'housekeeping') return 'Housekeeping Task Alert';
    return 'KOT Order Alert';
};

const buildOrderMessage = (scope, order, changeType) => {
    const shortId = String(order.id || '').slice(-6).toUpperCase();
    const place = order.roomNumber
        ? `Room ${order.roomNumber}`
        : order.tableNumber
            ? `Table ${order.tableNumber}`
            : order.guestName || 'Guest';

    if (changeType === 'new') {
        if (scope === 'cashier') {
            return `Order #${shortId} moved to Pending Payment (${place}).`;
        }
        return `New ${order.orderType || 'order'} #${shortId} received for ${place}.`;
    }

    return `Order #${shortId} status updated to ${order.status} (${place}).`;
};

const buildHousekeepingMessage = (task, changeType) => {
    const roomLabel = task.roomNumber ? `Room ${task.roomNumber}` : 'A room';

    if (changeType === 'new') {
        return `${roomLabel} requires housekeeping attention.`;
    }

    if (task.pendingAcknowledged) {
        return `${roomLabel} follow-up marked as pending.`;
    }

    if (normalize(task.status) === 'completed') {
        return `${roomLabel} has been marked clean.`;
    }

    return `${roomLabel} housekeeping status updated.`;
};

const isPayloadRelevantToScope = (scope, payload) => {
    const entity = normalize(payload?.entity);
    if (scope === 'housekeeping') {
        return entity === 'housekeeping-task';
    }

    if (entity !== 'order') return false;

    const data = payload?.data || {};
    return forScope(scope, {
        orderType: data.orderType,
        status: data.status,
    });
};

export const useOrderNotifications = (scope, options = {}) => {
    const { pollMs = 5000, enabled = true, seedOnFirstLoad = true } = options;
    const [feed, setFeed] = useState(() => readFeed());
    const [panelOpen, setPanelOpen] = useState(false);
    const [socketConnected, setSocketConnected] = useState(false);
    const prevMapRef = useRef(new Map());
    const initializedRef = useRef(false);
    const socketDebounceRef = useRef(null);

    const scopedFeed = useMemo(
        () => feed.filter((n) => n.scope === scope).slice(0, 30),
        [feed, scope]
    );

    const unreadCount = useMemo(() => {
        const seenTs = readSeenTs(scope);
        return scopedFeed.filter((n) => Number(n.ts || 0) > seenTs).length;
    }, [scopedFeed, scope]);

    const pushNotifications = useCallback((newItems, { silent = false } = {}) => {
        if (!newItems.length) return;

        const acceptedItemsRef = { current: [] };

        setFeed((prev) => {
            const seen = new Set(prev.map((item) => String(item.id || '')));
            const uniqueItems = newItems.filter((item) => !seen.has(String(item.id || '')));
            if (!uniqueItems.length) return prev;

            acceptedItemsRef.current = uniqueItems;
            const next = [...uniqueItems, ...prev].slice(0, MAX_FEED_ITEMS);
            writeFeed(next);
            return next;
        });

        if (!silent) {
            acceptedItemsRef.current.forEach((item) => {
                opsNotificationCenter.triggerAlert({
                    alertKey: item.alertKey || item.id,
                    title: item.title,
                    message: item.message,
                    tag: `ops-${item.scope || scope}`,
                    data: item,
                });
            });
        }
    }, [scope]);

    const markRead = useCallback(() => {
        writeSeenTs(scope, Date.now());
    }, [scope]);

    const removeNotification = useCallback((notificationId) => {
        setFeed((prev) => {
            const target = prev.find((n) => n.id === notificationId);
            if (target?.orderId) {
                const dismissed = readDismissedOrderIds(scope);
                dismissed.add(String(target.orderId));
                writeDismissedOrderIds(scope, dismissed);
            }
            const next = prev.filter((n) => n.id !== notificationId);
            writeFeed(next);
            return next;
        });
    }, [scope]);

    const clearAllForScope = useCallback(() => {
        setFeed((prev) => {
            const dismissed = readDismissedOrderIds(scope);
            prev.forEach((n) => {
                if (n.scope === scope && n.orderId) {
                    dismissed.add(String(n.orderId));
                }
            });
            writeDismissedOrderIds(scope, dismissed);

            const next = prev.filter((n) => n.scope !== scope);
            writeFeed(next);
            return next;
        });
        writeSeenTs(scope, Date.now());
    }, [scope]);

    const togglePanel = useCallback(() => {
        setPanelOpen((prev) => {
            const next = !prev;
            if (next) markRead();
            return next;
        });
    }, [markRead]);

    const closePanel = useCallback(() => {
        setPanelOpen(false);
        markRead();
    }, [markRead]);

    const poll = useCallback(async ({ silentEvents = false } = {}) => {
        if (!enabled) return;

        try {
            const dismissedOrderIds = readDismissedOrderIds(scope);

            if (scope === 'housekeeping') {
                const response = await apiCall('/api/housekeeping/list');
                const data = await response.json();
                if (!response.ok || !data.success || !Array.isArray(data.data)) return;

                const snapshotList = data.data.map(toHousekeepingSnapshot).filter((task) => task.id);
                const nextMap = new Map(snapshotList.map((task) => [task.id, task]));

                if (!initializedRef.current) {
                    if (seedOnFirstLoad && snapshotList.length) {
                        const existingScopeItems = readFeed().filter((n) => n.scope === scope);
                        const existingOrderIds = new Set(
                            existingScopeItems.map((n) => String(n.orderId || '')).filter(Boolean)
                        );

                        const backfill = snapshotList
                            .filter((task) => !existingOrderIds.has(String(task.id)))
                            .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0))
                            .slice(0, 10);

                        if (backfill.length) {
                            const seedItems = backfill.map((task, idx) => ({
                                id: `${scope}-seed-init-${task.id}-${idx}`,
                                alertKey: `${scope}-seed-init-${task.id}`,
                                scope,
                                ts: Date.now() + idx,
                                title: buildTitle(scope),
                                message: buildHousekeepingMessage(task, 'new'),
                                orderId: task.id,
                                orderType: 'Housekeeping',
                                status: task.status,
                                eventTime: task.createdAt || task.updatedAt || new Date().toISOString(),
                            }));
                            pushNotifications(seedItems, { silent: true });
                        }
                    }

                    prevMapRef.current = nextMap;
                    initializedRef.current = true;
                    return;
                }

                const events = [];
                nextMap.forEach((task, id) => {
                    const prev = prevMapRef.current.get(id);
                    if (!prev) {
                        events.push({ task, changeType: 'new' });
                        return;
                    }

                    if (
                        normalize(prev.status) !== normalize(task.status)
                        || Boolean(prev.pendingAcknowledged) !== Boolean(task.pendingAcknowledged)
                    ) {
                        events.push({ task, changeType: 'status' });
                    }
                });

                if (events.length) {
                    const now = Date.now();
                    const notifications = events.map((evt, idx) => ({
                        id: `${scope}-${evt.task.id}-${evt.task.updatedAt || now}-${idx}`,
                        alertKey: `${scope}-${evt.task.id}-${evt.task.updatedAt || now}`,
                        scope,
                        ts: now + idx,
                        title: buildTitle(scope),
                        message: buildHousekeepingMessage(evt.task, evt.changeType),
                        orderId: evt.task.id,
                        orderType: 'Housekeeping',
                        status: evt.task.status,
                        eventTime: evt.task.createdAt || evt.task.updatedAt || new Date().toISOString(),
                    }));
                    pushNotifications(notifications, { silent: silentEvents });
                }

                prevMapRef.current = nextMap;
                return;
            }

            const response = await apiCall('/api/guest-meal/orders');
            const data = await response.json();
            if (!response.ok || !data.success || !Array.isArray(data.data)) return;

            const filtered = data.data.filter((order) => forScope(scope, order));
            const snapshotList = filtered.map(toOrderSnapshot).filter((o) => o.id);
            const nextMap = new Map(snapshotList.map((o) => [o.id, o]));

            if (!initializedRef.current) {
                if (seedOnFirstLoad) {
                    const existingScopeItems = readFeed().filter((n) => n.scope === scope);
                    const existingOrderIds = new Set(
                        existingScopeItems.map((n) => String(n.orderId || '')).filter(Boolean)
                    );

                    const backfill = snapshotList
                        .filter((order) => (
                            order.id
                            && !dismissedOrderIds.has(String(order.id))
                            && !existingOrderIds.has(String(order.id))
                        ))
                        .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0))
                        .slice(0, 10);

                    if (backfill.length) {
                        const seedItems = backfill.map((order, idx) => ({
                            id: `${scope}-seed-init-${order.id}-${idx}`,
                            alertKey: `${scope}-seed-init-${order.id}`,
                            scope,
                            ts: Date.now() + idx,
                            title: buildTitle(scope),
                            message: buildOrderMessage(scope, order, 'new'),
                            orderId: order.id,
                            orderType: order.orderType,
                            status: order.status,
                            eventTime: order.createdAt || order.updatedAt || new Date().toISOString(),
                        }));
                        pushNotifications(seedItems, { silent: true });
                    }
                }

                prevMapRef.current = nextMap;
                initializedRef.current = true;
                return;
            }

            const events = [];
            nextMap.forEach((order, id) => {
                if (dismissedOrderIds.has(String(id))) return;

                const prev = prevMapRef.current.get(id);
                if (!prev) {
                    events.push({ order, changeType: 'new' });
                    return;
                }

                if (normalize(prev.status) !== normalize(order.status)) {
                    events.push({ order, changeType: 'status' });
                }
            });

            if (events.length) {
                const now = Date.now();
                const notifications = events.map((evt, idx) => ({
                    id: `${scope}-${evt.order.id}-${evt.order.updatedAt || now}-${idx}`,
                    alertKey: `${scope}-${evt.order.id}-${evt.order.updatedAt || now}`,
                    scope,
                    ts: now + idx,
                    title: buildTitle(scope),
                    message: buildOrderMessage(scope, evt.order, evt.changeType),
                    orderId: evt.order.id,
                    orderType: evt.order.orderType,
                    status: evt.order.status,
                    eventTime: evt.order.createdAt || evt.order.updatedAt || new Date().toISOString(),
                }));
                pushNotifications(notifications, { silent: silentEvents });
            } else if (seedOnFirstLoad) {
                const hasScopeFeed = readFeed().some((n) => n.scope === scope);
                if (!hasScopeFeed && snapshotList.length) {
                    const seedItems = snapshotList
                        .slice()
                        .filter((order) => !dismissedOrderIds.has(String(order.id)))
                        .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0))
                        .slice(0, 8)
                        .map((order, idx) => ({
                            id: `${scope}-seed-refresh-${order.id}-${idx}`,
                            alertKey: `${scope}-seed-refresh-${order.id}`,
                            scope,
                            ts: Date.now() + idx,
                            title: buildTitle(scope),
                            message: buildOrderMessage(scope, order, 'new'),
                            orderId: order.id,
                            orderType: order.orderType,
                            status: order.status,
                            eventTime: order.createdAt || order.updatedAt || new Date().toISOString(),
                        }));
                    pushNotifications(seedItems, { silent: true });
                }
            }

            prevMapRef.current = nextMap;
        } catch (_) {
            // Silent fail for resilient polling.
        }
    }, [enabled, pushNotifications, scope, seedOnFirstLoad]);

    useEffect(() => {
        opsNotificationCenter.init();

        const unsubscribeSocket = opsNotificationCenter.subscribe((payload) => {
            if (!isPayloadRelevantToScope(scope, payload)) return;

            if (socketDebounceRef.current) {
                clearTimeout(socketDebounceRef.current);
            }

            socketDebounceRef.current = setTimeout(() => {
                poll({ silentEvents: true });
            }, 120);
        });

        const unsubscribeConnection = opsNotificationCenter.subscribeConnection((connected) => {
            setSocketConnected(Boolean(connected));
        });

        return () => {
            unsubscribeSocket();
            unsubscribeConnection();
            if (socketDebounceRef.current) {
                clearTimeout(socketDebounceRef.current);
            }
        };
    }, [poll, scope]);

    useEffect(() => {
        poll({ silentEvents: false });

        // Keep periodic fallback polling if socket stream is unavailable.
        const effectivePollMs = socketConnected ? Math.max(pollMs, 15000) : pollMs;
        const id = setInterval(() => {
            poll({ silentEvents: false });
        }, effectivePollMs);

        return () => clearInterval(id);
    }, [poll, pollMs, socketConnected]);

    useEffect(() => {
        if (!enabled) return undefined;

        const handleFocusRefresh = () => {
            poll({ silentEvents: true });
        };

        window.addEventListener('focus', handleFocusRefresh);
        document.addEventListener('visibilitychange', handleFocusRefresh);

        return () => {
            window.removeEventListener('focus', handleFocusRefresh);
            document.removeEventListener('visibilitychange', handleFocusRefresh);
        };
    }, [enabled, poll]);

    return {
        notifications: scopedFeed,
        unreadCount,
        panelOpen,
        togglePanel,
        closePanel,
        markRead,
        forceRefresh: () => poll({ silentEvents: true }),
        removeNotification,
        clearAllForScope,
    };
};
