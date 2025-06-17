const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { 
  createReview, 
  getReviewsByField,
  getOwnerFieldsReviews 
} = require('../controllers/review.controller');

// Tạo đánh giá mới
router.post('/create', authMiddleware, createReview);

// Lấy danh sách đánh giá theo sân
router.get('/field/:field_id', getReviewsByField);

// Lấy tất cả đánh giá của các sân của owner
router.get('/owner/fields-reviews', authMiddleware, getOwnerFieldsReviews);

module.exports = router;