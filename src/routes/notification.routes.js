const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Lấy danh sách notification của user
router.get('/', authMiddleware, notificationController.getUserNotifications);

// Đánh dấu notification đã đọc
router.put('/:notificationId/read', authMiddleware, notificationController.markNotificationAsRead);

module.exports = router;
