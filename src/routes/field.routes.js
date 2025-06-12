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

// New routes for package system
router.get('/check/create-condition', authMiddleware, isOwner, fieldController.checkPackageBeforeCreate);
router.post('/create-with-check', authMiddleware, isOwner, fieldController.createFieldWithPackageCheck);
router.post('/upload-documents', authMiddleware, isOwner, fieldController.uploadDocuments);
router.get('/owner/my-fields', authMiddleware, isOwner, fieldController.getOwnerFields);

module.exports = router;