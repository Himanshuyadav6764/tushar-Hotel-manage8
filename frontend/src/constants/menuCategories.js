export const FIXED_MENU_CATEGORIES = [
    'Starters',
    'Main Course',
    'Breakfast',
    'Rice',
    'Desserts',
    'Beverages',
    'Chinese',
    'Continental',
    'Dinner'
];

export const FIXED_CATEGORY_ICONS = {
    Starters: '🍴',
    'Main Course': '🍛',
    Breakfast: '☕',
    Rice: '🍚',
    Desserts: '🍨',
    Beverages: '🥤',
    Chinese: '🥡',
    Continental: '🍝',
    Dinner: '🍽️'
};

export const normalizeCategoryName = (value = '') => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    return normalized
        .split(' ')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
};

export const mergeCategoryLists = (...lists) => {
    const out = [];
    const seen = new Set();

    lists.flat().forEach((item) => {
        const name = normalizeCategoryName(item);
        if (!name) return;

        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(name);
    });

    return out;
};
