const express = require('express');
const router = express.Router();
const packageController = require('../controllers/package.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Lấy thông tin các gói dịch vụ (public)
router.get('/', packageController.getPackages);

// Mua gói dịch vụ (require authentication)
router.post('/purchase', authMiddleware, packageController.purchasePackage);

// Kiểm tra gói hiện tại (require authentication)
router.get('/current', authMiddleware, packageController.getCurrentPackage);

module.exports = router;
