const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authMiddleware, isAdmin } = require('../middlewares/auth.middleware');

// Tất cả routes admin đều cần authentication và role admin
router.use(authMiddleware, isAdmin);

// Thống kê tổng quan
router.get('/dashboard/stats', adminController.getDashboardStats);

// Quản lý field
router.get('/fields', adminController.getAllFieldsForAdmin);
router.get('/fields/pending', adminController.getPendingFields);
router.put('/fields/:fieldId/approve', adminController.approveField);

module.exports = router;
