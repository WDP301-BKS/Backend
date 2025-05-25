const express = require('express');
const router = express.Router();
const fieldController = require('../controllers/field.controller');
const { authMiddleware, isOwner } = require('../middlewares/auth.middleware');

// Public routes
router.get('/all', fieldController.getAllFields);
router.get('/', fieldController.getFields);
router.get('/:id', fieldController.getFieldDetail);

// Protected routes (require authentication)
router.post('/', authMiddleware, isOwner, fieldController.addField);

module.exports = router; 