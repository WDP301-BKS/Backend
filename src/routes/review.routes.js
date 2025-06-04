const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { 
  createReview, 
  getReviewsByField, 

} = require('../controllers/review.controller');

// Tạo đánh giá mới
router.post('/create', authMiddleware, createReview);

// Lấy danh sách đánh giá theo sân
router.get('/field/:field_id', getReviewsByField); 


module.exports = router;