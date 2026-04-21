const MenuItem = require('../models/Menu');

const normalizeCategoryName = (value = '') => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    return normalized
        .split(' ')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
};

// @desc    Get all menu items
// @route   GET /api/menu/list
// @access  Public
const getMenuItems = async (req, res) => {
    try {
        const { category, search } = req.query;

        let query = {};

        // Filter by category if provided
        if (category && category !== 'All Categories') {
            query.category = normalizeCategoryName(category);
        }

        // Search by item name if provided
        if (search) {
            query.itemName = { $regex: search, $options: 'i' };
        }

        const menuItems = await MenuItem.find(query).sort({ updatedAt: -1, createdAt: -1 });

        res.status(200).json({
            success: true,
            count: menuItems.length,
            data: menuItems
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching menu items',
            error: error.message
        });
    }
};

// @desc    Add new menu item
// @route   POST /api/menu/add
// @access  Private/Admin
const addMenuItem = async (req, res) => {
    try {
        const { itemName, foodCode, category, price, description, status, quantity, unit, image } = req.body;

        const normalizedItemName = String(itemName || '').replace(/\s+/g, ' ').trim();
        const normalizedFoodCode = String(foodCode || '').replace(/\s+/g, '').trim().toUpperCase();
        const normalizedCategory = normalizeCategoryName(category);
        const normalizedStatus = String(status || 'Active').trim();

        // Validation
        if (!normalizedItemName || !normalizedFoodCode || !normalizedCategory || !price) {
            return res.status(400).json({
                success: false,
                message: 'Please provide item name, food code, category, and price'
            });
        }

        // Check if food code already exists
        const existingItem = await MenuItem.findOne({ foodCode: normalizedFoodCode });
        if (existingItem) {
            return res.status(400).json({
                success: false,
                message: 'Food code must be unique'
            });
        }

        // Create new menu item
        const newItemData = {
            itemName: normalizedItemName,
            foodCode: normalizedFoodCode,
            category: normalizedCategory,
            price,
            description: description || '',
            image: typeof image === 'string' ? image.trim() : '',
            status: normalizedStatus || 'Active',
            quantity: (quantity !== undefined && quantity !== null) ? Number(quantity) : 0,
            unit: unit || 'PCS'
        };

        console.log('Creating Menu Item with Data:', newItemData); // Debug log

        const menuItem = await MenuItem.create(newItemData);

        res.status(201).json({
            success: true,
            message: 'Menu item added successfully',
            data: menuItem
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding menu item',
            error: error.message
        });
    }
};

// @desc    Update menu item
// @route   PUT /api/menu/update/:id
// @access  Private/Admin
const updateMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        let updateData = { ...req.body };

        if (updateData.itemName !== undefined) {
            updateData.itemName = String(updateData.itemName || '').replace(/\s+/g, ' ').trim();
        }

        if (updateData.foodCode !== undefined) {
            updateData.foodCode = String(updateData.foodCode || '').replace(/\s+/g, '').trim().toUpperCase();
        }

        if (updateData.category !== undefined) {
            updateData.category = normalizeCategoryName(updateData.category);
        }

        // Ensure quantity is a number if present
        if (updateData.quantity !== undefined && updateData.quantity !== null) {
            updateData.quantity = Number(updateData.quantity);
        }

        console.log('Updating Menu Item:', id, updateData); // Debug log

        // Find and update menu item
        const menuItem = await MenuItem.findByIdAndUpdate(
            id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Menu item updated successfully',
            data: menuItem
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating menu item',
            error: error.message
        });
    }
};

// @desc    Delete menu item
// @route   DELETE /api/menu/delete/:id
// @access  Private/Admin
const deleteMenuItem = async (req, res) => {
    try {
        const { id } = req.params;

        const menuItem = await MenuItem.findByIdAndDelete(id);

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Menu item deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting menu item',
            error: error.message
        });
    }
};

// @desc    Get single menu item
// @route   GET /api/menu/:id
// @access  Public
const getMenuItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const menuItem = await MenuItem.findById(id);

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        res.status(200).json({
            success: true,
            data: menuItem
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching menu item',
            error: error.message
        });
    }
};

// @desc    Toggle menu item status
// @route   PATCH /api/menu/toggle-status/:id
// @access  Private/Admin
const toggleMenuItemStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const menuItem = await MenuItem.findById(id);

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        // Toggle status
        menuItem.status = menuItem.status === 'Active' ? 'Inactive' : 'Active';
        await menuItem.save();

        res.status(200).json({
            success: true,
            message: 'Menu item status toggled successfully',
            data: menuItem
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error toggling menu item status',
            error: error.message
        });
    }
};

// @desc    Migrate old categories to new ones
// @route   POST /api/menu/migrate-categories
// @access  Private/Admin
const migrateCategoriesCategories = async (req, res) => {
    try {
        const categoryMapping = {
            'chicken': 'Chicken',
            'nithai': 'Mithai',
            'milk': 'Milk',
            'veg': 'Vegetarian'
        };

        let updatedCount = 0;

        for (const [oldCategory, newCategory] of Object.entries(categoryMapping)) {
            const result = await MenuItem.updateMany(
                { category: oldCategory },
                { $set: { category: newCategory } }
            );
            updatedCount += result.modifiedCount;
        }

        res.status(200).json({
            success: true,
            message: `Categories migrated successfully. ${updatedCount} items updated.`,
            updatedCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error migrating categories',
            error: error.message
        });
    }
};

module.exports = {
    getMenuItems,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    getMenuItemById,
    toggleMenuItemStatus,
    migrateCategoriesCategories
};
