const express = require('express');
const router = express.Router();
const HousekeepingTask = require('../models/HousekeepingTask');
const Room = require('../models/Room');

// GET all pending housekeeping tasks
router.get('/list', async (req, res) => {
    try {
        const tasks = await HousekeepingTask.find({ status: 'pending' }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: tasks
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching housekeeping tasks',
            error: error.message
        });
    }
});

// POST mark room as clean
router.post('/mark-clean', async (req, res) => {
    try {
        const { taskId, roomNumber } = req.body;

        if (!taskId && !roomNumber) {
            return res.status(400).json({ success: false, message: ' taskId or roomNumber is required' });
        }

        let task;
        if (taskId) {
            task = await HousekeepingTask.findById(taskId);
        } else {
            task = await HousekeepingTask.findOne({ roomNumber, status: 'pending' });
        }

        if (!task) {
            return res.status(404).json({ success: false, message: 'Pending task not found' });
        }

        // 1. Update Room
        await Room.findOneAndUpdate(
            { roomNumber: task.roomNumber },
            { housekeepingStatus: 'clean' }
        );

        // 2. Update Task
        task.status = 'completed';
        task.pendingAcknowledged = false;
        task.pendingAcknowledgedAt = null;
        await task.save();

        res.json({
            success: true,
            message: `Room ${task.roomNumber} marked as clean`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating housekeeping status',
            error: error.message
        });
    }
});

// POST mark room as pending (needs follow-up)
router.post('/mark-pending', async (req, res) => {
    try {
        const { taskId, roomNumber } = req.body;

        if (!taskId && !roomNumber) {
            return res.status(400).json({ success: false, message: 'taskId or roomNumber is required' });
        }

        let task = null;
        if (taskId) {
            task = await HousekeepingTask.findById(taskId);
        }

        if (!task && roomNumber) {
            task = await HousekeepingTask.findOne({ roomNumber }).sort({ createdAt: -1 });
        }

        const effectiveRoomNumber = task?.roomNumber || roomNumber;
        if (!effectiveRoomNumber) {
            return res.status(404).json({ success: false, message: 'Task/room not found' });
        }

        // 1. Update Room housekeeping state so Dashboard graph can count it under Pending.
        await Room.findOneAndUpdate(
            { roomNumber: effectiveRoomNumber },
            { housekeepingStatus: 'pending' }
        );

        // 2. Keep/reopen task as pending for housekeeping queue.
        if (task) {
            task.status = 'pending';
            task.pendingAcknowledged = true;
            task.pendingAcknowledgedAt = new Date();
            await task.save();
        }

        res.json({
            success: true,
            message: `Room ${effectiveRoomNumber} marked as pending`,
            data: {
                taskId: task ? String(task._id) : null,
                pendingAcknowledged: true
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating housekeeping status',
            error: error.message
        });
    }
});

module.exports = router;
