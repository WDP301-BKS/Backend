const { Field, User, Location, SubField } = require('../models');
const { ValidationError } = require('sequelize');
const responseFormatter = require('../utils/responseFormatter');

// Get all fields without pagination
const getAllFields = async (req, res) => {
    try {
        const fields = await Field.findAll({
            include: [
                {
                    model: Location,
                    attributes: ['address_text', 'city', 'district', 'ward']
                },
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'name', 'phone']
                },
                {
                    model: SubField,
                    attributes: ['id', 'name', 'field_type']
                }
            ],
            attributes: [
                'id', 
                'name', 
                'description', 
                'price_per_hour', 
                'images1', 
                'images2', 
                'images3', 
                'is_verified', 
                'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        return res.json({
            success: true,
            data: fields
        });
    } catch (error) {
        console.error('Error in getAllFields:', error);
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

// Get list of fields with simple pagination (10 items per page)
const getFields = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Fixed limit of 10 items
        const offset = (page - 1) * limit;

        const { count, rows } = await Field.findAndCountAll({
            include: [
                {
                    model: Location,
                    attributes: ['address_text']
                },
                {
                    model: User,
                    as: 'owner',
                    attributes: ['name']
                }
            ],
            limit,
            offset,
            attributes: ['id', 'name', 'price_per_hour', 'images1','images2','images3', 'is_verified', 'created_at'],
            order: [['created_at', 'DESC']] // Default sort by newest first
        });

        const totalPages = Math.ceil(count / limit);

        return res.json({
            success: true,
            data: {
                items: rows,
                pagination: {
                    total: count,
                    page,
                    limit,
                    total_pages: totalPages
                }
            }
        });
    } catch (error) {
        console.error('Error in getFields:', error);
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

// Add new field
const addField = async (req, res) => {
    try {
        const { name, location_id, description, price_per_hour, images1, images2, images3 } = req.body;
        const owner_id = req.user.id; // Get from authenticated user

        // Validate required fields
        if (!name || !location_id || !price_per_hour) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Dữ liệu không hợp lệ',
                details: {
                    name: !name ? 'Tên sân không được để trống' : undefined,
                    location_id: !location_id ? 'ID địa điểm không được để trống' : undefined,
                    price_per_hour: !price_per_hour ? 'Giá tiền không được để trống' : undefined
                }
            }));
        }

        // Validate price
        if (price_per_hour <= 0) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Giá tiền phải là số dương'
            }));
        }

        // Check if location exists
        const location = await Location.findByPk(location_id);
        if (!location) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Địa điểm không tồn tại'
            }));
        }

        const field = await Field.create({
            owner_id,
            name,
            location_id,
            description,
            price_per_hour,
            images1,
            images2,
            images3
        });

        return res.json(responseFormatter.success(field));
    } catch (error) {
        console.error('Error in addField:', error);
        if (error instanceof ValidationError) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Dữ liệu không hợp lệ',
                details: error.errors.reduce((acc, curr) => {
                    acc[curr.path] = curr.message;
                    return acc;
                }, {})
            }));
        }
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra'
        }));
    }
};

// Get field detail
const getFieldDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const field = await Field.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'name', 'phone']
                },
                {
                    model: Location,
                    attributes: ['id', 'address_text', 'latitude', 'longitude', 'city', 'district', 'ward']
                },
                {
                    model: SubField,
                    attributes: ['id', 'name', 'field_type']
                }
            ],
            attributes: [
                'id',
                'name',
                'description',
                'price_per_hour',
                'images1',
                'images2',
                'images3',
                'is_verified',
                'created_at',
                'updated_at'
            ]
        });

        if (!field) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Không tìm thấy sân bóng'
                }
            });
        }

        return res.json({
            success: true,
            data: field
        });
    } catch (error) {
        console.error('Error in getFieldDetail:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Đã có lỗi xảy ra khi lấy thông tin sân',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
};

module.exports = {
    getAllFields,
    getFields,
    addField,
    getFieldDetail
}; 