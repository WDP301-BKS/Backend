const express = require('express');
const router = express.Router();
const fieldController = require('../controllers/field.controller');
const { authMiddleware, isOwner } = require('../middlewares/auth.middleware');

// Public routes
router.get('/search', fieldController.searchFields);
router.get('/all', fieldController.getAllFields);
router.get('/', fieldController.getFields);

// Owner specific routes (must be before /:id route)
router.get('/owner/my-fields', authMiddleware, isOwner, fieldController.getOwnerFields);

router.get('/:id', fieldController.getFieldDetail);

// Protected routes (require authentication)
router.post('/', authMiddleware, isOwner, fieldController.addField);

module.exports = router;