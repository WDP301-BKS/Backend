const { Field, User, Location, SubField } = require('../models');
const { ValidationError, Op, Sequelize } = require('sequelize');
const responseFormatter = require('../utils/responseFormatter');
const sequelize = require('sequelize');

// Get all fields without pagination
const getAllFields = async (req, res) => {
    try {
        const fields = await Field.findAll({
            where: {
                is_verified: true
            },
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

// Search fields by name
const searchFields = async (req, res) => {
    try {
        let { name } = req.query;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Vui lòng nhập tên sân cần tìm'
                }
            });
        }

        // Chuẩn hóa chuỗi tìm kiếm
        name = decodeURIComponent(name).trim();
        console.log('Search term after decode:', name);

        const fields = await Field.findAll({
            where: {
                name: {
                    [Op.iLike]: `%${name}%`
                }
            },
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

        console.log('Found fields:', fields.map(f => f.name));

        return res.json({
            success: true,
            data: fields
        });
    } catch (error) {
        console.error('Error in searchFields:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Đã có lỗi xảy ra khi tìm kiếm sân',
                details: error.message
            }
        });
    }
};

// Kiểm tra gói dịch vụ trước khi tạo field
const checkPackageBeforeCreate = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Người dùng không tồn tại'
                }
            });
        }

        // Kiểm tra người dùng có phải owner không
        if (user.role !== 'owner') {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Chỉ chủ sân mới có thể tạo sân bóng'
                }
            });
        }

        // Kiểm tra đã mua gói dịch vụ chưa
        if (user.package_type === 'none') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'PACKAGE_REQUIRED',
                    message: 'Bạn cần mua gói dịch vụ trước khi tạo sân',
                    data: {
                        needPackage: true,
                        redirectTo: '/packages'
                    }
                }
            });
        }

        // Kiểm tra số lượng sân hiện tại
        const currentFieldCount = await Field.count({
            where: { owner_id: userId }
        });

        let maxFields = 0;
        if (user.package_type === 'basic') {
            maxFields = 2;
        } else if (user.package_type === 'premium') {
            maxFields = 5;
        }

        if (currentFieldCount >= maxFields) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'FIELD_LIMIT_EXCEEDED',
                    message: `Gói ${user.package_type} chỉ cho phép tạo tối đa ${maxFields} sân`,
                    data: {
                        currentCount: currentFieldCount,
                        maxFields: maxFields,
                        needUpgrade: user.package_type === 'basic'
                    }
                }
            });
        }

        // Kiểm tra đã upload giấy tờ chưa
        if (!user.business_license_image || !user.identity_card_image) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'DOCUMENTS_REQUIRED',
                    message: 'Bạn cần upload giấy phép kinh doanh và căn cước công dân',
                    data: {
                        needDocuments: true,
                        missingDocuments: {
                            businessLicense: !user.business_license_image,
                            identityCard: !user.identity_card_image
                        }
                    }
                }
            });
        }

        return res.json({
            success: true,
            message: 'Có thể tạo sân mới',
            data: {
                canCreate: true,
                currentCount: currentFieldCount,
                maxFields: maxFields,
                packageType: user.package_type
            }
        });

    } catch (error) {
        console.error('Error checking package:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Lỗi server'
            }
        });
    }
};

// Upload documents
const uploadDocuments = async (req, res) => {
    try {
        const userId = req.user.id;
        const { business_license_image, identity_card_image } = req.body;

        if (!business_license_image || !identity_card_image) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Cần upload đầy đủ giấy phép kinh doanh và căn cước công dân'
                }
            });
        }

        await User.update(
            {
                business_license_image,
                identity_card_image
            },
            {
                where: { id: userId }
            }
        );

        return res.json({
            success: true,
            message: 'Upload giấy tờ thành công'
        });

    } catch (error) {
        console.error('Error uploading documents:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Lỗi upload giấy tờ'
            }
        });
    }
};

// Tạo field mới với kiểm tra gói dịch vụ
const createFieldWithPackageCheck = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            name,
            description,
            price_per_hour,
            images1,
            images2,
            images3,
            // Location data
            latitude,
            longitude,
            address_text,
            city,
            district,
            ward,
            // SubFields data
            subfields,
            // Documents data - THÊM MỚI
            business_license_image,
            identity_card_image
        } = req.body;

        // Kiểm tra điều kiện gói dịch vụ trước
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Người dùng không tồn tại'
                }
            });
        }

        // Kiểm tra gói dịch vụ
        if (user.package_type === 'none') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'PACKAGE_REQUIRED',
                    message: 'Bạn cần mua gói dịch vụ trước khi tạo sân'
                }
            });
        }

        // Kiểm tra số lượng sân
        const currentFieldCount = await Field.count({
            where: { owner_id: userId }
        });

        let maxFields = user.package_type === 'basic' ? 2 : 5;
        if (currentFieldCount >= maxFields) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'FIELD_LIMIT_EXCEEDED',
                    message: `Gói ${user.package_type} chỉ cho phép tạo tối đa ${maxFields} sân`
                }
            });
        }

        // Kiểm tra giấy tờ - CẢ TRONG DB VÀ REQUEST
        const hasDocumentsInDB = user.business_license_image && user.identity_card_image;
        const hasDocumentsInRequest = business_license_image && identity_card_image;
        
        if (!hasDocumentsInDB && !hasDocumentsInRequest) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'DOCUMENTS_REQUIRED',
                    message: 'Bạn cần upload giấy phép kinh doanh và căn cước công dân'
                }
            });
        }

        // UPLOAD DOCUMENTS NẾU CÓ TRONG REQUEST
        if (hasDocumentsInRequest) {
            await User.update(
                {
                    business_license_image,
                    identity_card_image
                },
                {
                    where: { id: userId }
                }
            );
        }

        // Validate required fields
        if (!name || !price_per_hour) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Dữ liệu không hợp lệ',
                details: {
                    name: !name ? 'Tên sân không được để trống' : undefined,
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

        let location_id;

        // Tạo location nếu có thông tin địa điểm
        if (latitude && longitude && address_text) {
            const location = await Location.create({
                latitude,
                longitude,
                geom: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                address_text,
                city,
                district,
                ward
            });
            location_id = location.id;
        } else if (req.body.location_id) {
            // Sử dụng location_id có sẵn
            const location = await Location.findByPk(req.body.location_id);
            if (!location) {
                return res.status(400).json(responseFormatter.error({
                    code: 'VALIDATION_ERROR',
                    message: 'Địa điểm không tồn tại'
                }));
            }
            location_id = req.body.location_id;
        } else {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Cần cung cấp thông tin địa điểm'
            }));
        }

        // Tạo field
        const field = await Field.create({
            owner_id: userId,
            name,
            location_id,
            description,
            price_per_hour,
            images1,
            images2,
            images3,
            is_verified: false // Chờ admin duyệt
        });

        // Tạo subfields nếu có
        if (subfields && Array.isArray(subfields)) {
            const subfieldPromises = subfields.map(subfield => 
                SubField.create({
                    field_id: field.id,
                    name: subfield.name,
                    image: subfield.image,
                    field_type: subfield.field_type
                })
            );
            await Promise.all(subfieldPromises);
        }

        // Lấy thông tin field vừa tạo với các quan hệ
        const newField = await Field.findByPk(field.id, {
            include: [
                {
                    model: Location,
                    attributes: ['id', 'address_text', 'latitude', 'longitude', 'city', 'district', 'ward']
                },
                {
                    model: SubField,
                    attributes: ['id', 'name', 'field_type', 'image']
                }
            ]
        });

        return res.json({
            success: true,
            message: hasDocumentsInRequest ? 
                'Upload giấy tờ và tạo sân thành công! Chờ admin duyệt' : 
                'Tạo sân thành công! Chờ admin duyệt',
            data: {
                field: newField,
                documentsUpdated: hasDocumentsInRequest
            }
        });

    } catch (error) {
        console.error('Error creating field:', error);
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

// Get fields owned by authenticated owner
const getOwnerFields = async (req, res) => {
    try {
        const ownerId = req.user.id; // Get owner ID from authenticated user

        const fields = await Field.findAll({
            where: {
                owner_id: ownerId
            },
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
                'created_at',
                'updated_at'
            ],
            order: [['created_at', 'DESC']]
        });

        return res.json({
            success: true,
            data: fields
        });
    } catch (error) {
        console.error('Error in getOwnerFields:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Đã có lỗi xảy ra khi lấy danh sách sân của owner',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
};

module.exports = {
    getAllFields,
    getFields,
    addField,
    getFieldDetail,
    searchFields,
    // Thêm các chức năng mới
    checkPackageBeforeCreate,
    uploadDocuments,
    createFieldWithPackageCheck,
    getOwnerFields
};