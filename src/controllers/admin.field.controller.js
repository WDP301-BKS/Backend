const { Field, User, Location, SubField } = require('../models');
const { ValidationError, Op } = require('sequelize');
const responseFormatter = require('../utils/responseFormatter');
const logger = require('../utils/logger');

// Get all fields for admin with optional status filter
const getAdminFields = async (req, res) => {
    try {
        const { status } = req.query;
        
        // Build where clause based on status
        const whereClause = {};
        if (status === 'pending') {
            whereClause.is_verified = false;
        } else if (status === 'verified') {
            whereClause.is_verified = true;
        } else if (status === 'rejected') {
            whereClause.is_verified = null;
        }
        // 'all' status will have no where clause for is_verified

        const fields = await Field.findAll({
            where: whereClause,
            include: [
                {
                    model: Location,
                    as: 'location',
                    attributes: ['address_text', 'city', 'district', 'ward', 'latitude', 'longitude']
                },
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'name', 'phone']
                },
                {
                    model: SubField,
                    as: 'subfields',
                    attributes: ['id', 'name', 'field_type']
                }
            ],
            attributes: [
                'id', 'name', 'description', 'price_per_hour', 
                'images1', 'images2', 'images3', 'is_verified', 
                'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        return res.json({
            success: true,
            data: fields
        });
    } catch (error) {
        console.error('Error in getAdminFields:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Đã có lỗi xảy ra khi lấy danh sách sân',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
};

// Get paginated fields for admin with optional status filter and search
const getAdminFieldsPaginated = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const { status, search, sort = 'created_at', order = 'DESC' } = req.query;
        
        console.log(`Received request with status: '${status}', page: ${page}, search: ${search || 'none'}`);
        
        // Build where clause based on status
        const whereClause = {};
        if (status === 'pending') {
            whereClause.is_verified = false;
        } else if (status === 'verified') {
            whereClause.is_verified = true;
        } else if (status === 'rejected') {
            whereClause.is_verified = null;
        } else if (status !== 'all') {
            // Default to pending if status is not recognized and not 'all'
            whereClause.is_verified = false;
        }
        // 'all' status will have no where clause for is_verified
        console.log('Applied where clause:', JSON.stringify(whereClause));
        
        // Add search functionality if search term is provided
        const includeOptions = [
            {
                model: Location,
                as: 'location',
                attributes: ['address_text', 'city', 'district', 'ward', 'latitude', 'longitude']
            },
            {
                model: User,
                as: 'owner',
                attributes: ['id', 'name', 'phone']
            },
            {
                model: SubField,
                as: 'subfields',
                attributes: ['id', 'name', 'field_type']
            }
        ];
        
        // If search is provided, modify the where clause - safer implementation
        if (search && search.trim() !== '') {
            // Use a safer approach that won't crash with empty or null values
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
                // Searching through relationships is handled differently in Sequelize
            ];
        }

        // Get total count and paginated results
        const { count, rows } = await Field.findAndCountAll({
            where: whereClause,
            include: includeOptions,
            attributes: [
                'id', 'name', 'description', 'price_per_hour', 
                'images1', 'images2', 'images3', 'is_verified', 
                'created_at'
            ],
            order: [[sort, order]],
            limit,
            offset
        });

        // Calculate total pages
        const totalPages = Math.ceil(count / limit);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page,
                limit,
                total_pages: totalPages
            }
        });
    } catch (error) {
        console.error('Error in getAdminFieldsPaginated:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Đã có lỗi xảy ra khi lấy danh sách sân',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
};

// Get detailed field information for admin
const getAdminFieldDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const field = await Field.findByPk(id, {
            include: [
                {
                    model: Location,
                    as: 'location',
                    attributes: ['address_text', 'city', 'district', 'ward', 'latitude', 'longitude']
                },
                {
                    model: User,
                    as: 'owner',
                    attributes: [
                        'id', 'name', 'phone', 
                        'business_license_image', 
                        'identity_card_image', 
                        'identity_card_back_image'
                    ]
                },
                {
                    model: SubField,
                    as: 'subfields',
                    attributes: ['id', 'name', 'field_type']
                }
            ]
        });

        if (!field) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'FIELD_NOT_FOUND',
                    message: 'Không tìm thấy sân bóng'
                }
            });
        }

        return res.json({
            success: true,
            data: field
        });
    } catch (error) {
        console.error('Error in getAdminFieldDetail:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Đã có lỗi xảy ra khi lấy thông tin sân bóng',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
};

// Verify (approve) a field
const verifyField = async (req, res) => {
    try {
        const { id } = req.params;

        const field = await Field.findByPk(id);
        
        if (!field) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'FIELD_NOT_FOUND',
                    message: 'Không tìm thấy sân bóng'
                }
            });
        }

        // Update field status
        await field.update({ is_verified: true });

        // Log the approval action
        logger.info(`Admin ${req.user.id} approved field ${id}`);

        return res.json({
            success: true,
            message: 'Sân bóng đã được duyệt thành công',
            data: { id: field.id, is_verified: field.is_verified }
        });
    } catch (error) {
        console.error('Error in verifyField:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Đã có lỗi xảy ra khi duyệt sân bóng',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
};

// Reject a field
const rejectField = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body; // Optional rejection reason

        const field = await Field.findByPk(id);
        
        if (!field) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'FIELD_NOT_FOUND',
                    message: 'Không tìm thấy sân bóng'
                }
            });
        }

        // Set is_verified to null to indicate rejection
        await field.update({ 
            is_verified: null,
            rejection_reason: reason || 'Không đáp ứng tiêu chuẩn'
        });

        // Log the rejection action
        logger.info(`Admin ${req.user.id} rejected field ${id}. Reason: ${reason || 'No reason provided'}`);

        return res.json({
            success: true,
            message: 'Sân bóng đã bị từ chối',
            data: { id: field.id, is_verified: field.is_verified }
        });
    } catch (error) {
        console.error('Error in rejectField:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Đã có lỗi xảy ra khi từ chối sân bóng',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
};

module.exports = {
    getAdminFields,
    getAdminFieldsPaginated,
    getAdminFieldDetail,
    verifyField,
    rejectField
};
