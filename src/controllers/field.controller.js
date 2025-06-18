const { Field, User, Location, SubField } = require('../models');
const { ValidationError, Op, Sequelize } = require('sequelize');
const responseFormatter = require('../utils/responseFormatter');
const sequelize = require('sequelize');
const { uploadImage } = require('../config/cloudinaryConfig');

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
                    as: 'location',
                    attributes: ['address_text', 'city', 'district', 'ward']
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
                    as: 'location',
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

// Add new field with file upload support
const addFieldWithFiles = async (req, res) => {
    try {
        console.log('=== addFieldWithFiles START ===');
        console.log('Request body:', req.body);
        console.log('Request files:', req.files ? Object.keys(req.files) : 'No files');
        
        const { 
            name, 
            location, 
            address, 
            field_type, 
            sub_field_count, 
            description, 
            price_per_hour,
            city,
            district,
            ward
        } = req.body;
        const owner_id = req.user.id; // Get from authenticated user

        console.log('Parsed data:', { 
            name, location, address, field_type, sub_field_count, 
            price_per_hour, city, district, ward, owner_id 
        });        // Validate required fields
        if (!name || !location || !address || !field_type || !sub_field_count || !price_per_hour) {
            console.log('Validation failed - missing required fields');
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Dữ liệu không hợp lệ',
                details: {
                    name: !name ? 'Tên sân không được để trống' : undefined,
                    location: !location ? 'Quận/huyện không được để trống' : undefined,
                    address: !address ? 'Địa chỉ không được để trống' : undefined,
                    field_type: !field_type ? 'Loại sân không được để trống' : undefined,
                    sub_field_count: !sub_field_count ? 'Số lượng sân con không được để trống' : undefined,
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
        }        // Validate field_type
        const validFieldTypes = ['5vs5', '7vs7'];
        if (!validFieldTypes.includes(field_type)) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Loại sân không hợp lệ. Chỉ chấp nhận 5vs5 hoặc 7vs7'
            }));
        }        // Validate sub_field_count
        const subFieldCount = parseInt(sub_field_count);
        if (isNaN(subFieldCount) || subFieldCount < 1 || subFieldCount > 10) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Số lượng sân con phải từ 1 đến 10'
            }));        }        // Lấy thông tin user hiện tại để kiểm tra giấy tờ đã có
        const currentUser = await User.findByPk(owner_id, {
            attributes: ['id', 'business_license_image', 'identity_card_image', 'identity_card_back_image']
        });

        if (!currentUser) {
            return res.status(404).json(responseFormatter.error({
                code: 'USER_NOT_FOUND',
                message: 'Không tìm thấy thông tin người dùng'
            }));
        }

        // Validate required images and documents
        const uploadedFiles = req.files;
        console.log('Uploaded files check:', uploadedFiles);
        console.log('Current user documents:', {
            business_license: !!currentUser.business_license_image,
            identity_card: !!currentUser.identity_card_image,
            identity_card_back: !!currentUser.identity_card_back_image
        });
        
        // Kiểm tra 3 ảnh sân bóng bắt buộc
        if (!uploadedFiles || !uploadedFiles.image1 || !uploadedFiles.image2 || !uploadedFiles.image3) {
            console.log('Missing field images validation failed');
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Cần phải upload đúng 3 ảnh sân bóng'
            }));
        }

        // Kiểm tra ảnh CCCD mặt trước (upload mới hoặc đã có sẵn)
        if (!uploadedFiles.identity_card_image && !currentUser.identity_card_image) {
            console.log('Missing identity card front image');
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Cần phải upload ảnh mặt trước CCCD/CMND'
            }));
        }

        // Kiểm tra ảnh CCCD mặt sau (upload mới hoặc đã có sẵn)
        if (!uploadedFiles.identity_card_back_image && !currentUser.identity_card_back_image) {
            console.log('Missing identity card back image');
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Cần phải upload ảnh mặt sau CCCD/CMND'
            }));
        }

        // Kiểm tra giấy phép kinh doanh (upload mới hoặc đã có sẵn)
        if (!uploadedFiles.business_license_image && !currentUser.business_license_image) {
            console.log('Missing business license image');
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Cần phải upload ảnh giấy phép kinh doanh'
            }));
        }// Handle uploaded files with Cloudinary
        let images1 = null, images2 = null, images3 = null;
        let businessLicenseUrl = null, identityCardUrl = null, identityCardBackUrl = null;

        if (uploadedFiles) {
            try {
                // Handle field images upload to Cloudinary
                if (uploadedFiles.image1) {
                    const result1 = await uploadImage(uploadedFiles.image1[0].buffer, {
                        folder: 'fields',
                        public_id: `field_${owner_id}_image1_${Date.now()}`
                    });
                    images1 = result1.secure_url;
                }
                if (uploadedFiles.image2) {
                    const result2 = await uploadImage(uploadedFiles.image2[0].buffer, {
                        folder: 'fields',
                        public_id: `field_${owner_id}_image2_${Date.now()}`
                    });
                    images2 = result2.secure_url;
                }
                if (uploadedFiles.image3) {
                    const result3 = await uploadImage(uploadedFiles.image3[0].buffer, {
                        folder: 'fields',
                        public_id: `field_${owner_id}_image3_${Date.now()}`
                    });
                    images3 = result3.secure_url;
                }
                
                // Handle business documents upload to Cloudinary
                if (uploadedFiles.business_license_image) {
                    const businessResult = await uploadImage(uploadedFiles.business_license_image[0].buffer, {
                        folder: 'business-licenses',
                        public_id: `business_license_${owner_id}_${Date.now()}`
                    });
                    businessLicenseUrl = businessResult.secure_url;
                }                if (uploadedFiles.identity_card_image) {
                    const identityResult = await uploadImage(uploadedFiles.identity_card_image[0].buffer, {
                        folder: 'identity-cards',
                        public_id: `identity_card_${owner_id}_${Date.now()}`
                    });
                    identityCardUrl = identityResult.secure_url;
                }
                if (uploadedFiles.identity_card_back_image) {
                    const identityBackResult = await uploadImage(uploadedFiles.identity_card_back_image[0].buffer, {
                        folder: 'identity-cards',
                        public_id: `identity_card_back_${owner_id}_${Date.now()}`
                    });
                    identityCardBackUrl = identityBackResult.secure_url;
                }
            } catch (uploadError) {
                console.error('Error uploading to Cloudinary:', uploadError);
                return res.status(500).json(responseFormatter.error({
                    code: 'UPLOAD_ERROR',
                    message: 'Lỗi khi upload ảnh lên Cloudinary',
                    details: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
                }));
            }
        }        // Create location entry first
        const locationData = await Location.create({
            address_text: address,
            city: city || 'Đà Nẵng',
            district: district || location, // Use district if provided, fallback to location
            ward: ward || 'Thuận Thành'
        });

        // Create field
        const field = await Field.create({
            owner_id,
            name,
            location_id: locationData.id,
            description,
            price_per_hour,
            images1,
            images2,
            images3,
            is_verified: false // Needs admin verification
        });        // Create SubFields based on sub_field_count with alphabet naming
        const subFields = [];
        for (let i = 1; i <= subFieldCount; i++) {
            // Convert number to alphabet (1 = A, 2 = B, etc.)
            const alphabetLetter = String.fromCharCode(64 + i); // 65 is 'A', so 64 + 1 = 65 = 'A'
            const subField = await SubField.create({
                field_id: field.id,
                name: ` Sân ${alphabetLetter}`,
                field_type: field_type,
                image: images1 // Use first image as default for all subfields
            });
            subFields.push(subField);
        }        // Update user with business documents (chỉ update những file được upload mới)
        const updateData = {};
        
        // Sử dụng URL mới nếu có upload, nếu không thì giữ nguyên URL cũ
        if (businessLicenseUrl) {
            updateData.business_license_image = businessLicenseUrl;
        } else if (!currentUser.business_license_image) {
            console.error('No business license image available (neither uploaded nor existing)');
            return res.status(500).json(responseFormatter.error({
                code: 'DOCUMENT_ERROR',
                message: 'Không có ảnh giấy phép kinh doanh'
            }));
        }
        
        if (identityCardUrl) {
            updateData.identity_card_image = identityCardUrl;
        } else if (!currentUser.identity_card_image) {
            console.error('No identity card front image available (neither uploaded nor existing)');
            return res.status(500).json(responseFormatter.error({
                code: 'DOCUMENT_ERROR',
                message: 'Không có ảnh mặt trước CCCD'
            }));
        }
        
        if (identityCardBackUrl) {
            updateData.identity_card_back_image = identityCardBackUrl;
        } else if (!currentUser.identity_card_back_image) {
            console.error('No identity card back image available (neither uploaded nor existing)');
            return res.status(500).json(responseFormatter.error({
                code: 'DOCUMENT_ERROR',
                message: 'Không có ảnh mặt sau CCCD'
            }));
        }
        
        // Chỉ update nếu có dữ liệu mới
        if (Object.keys(updateData).length > 0) {
            await User.update(updateData, {
                where: { id: owner_id }
            });
            console.log('Updated user documents:', updateData);
        } else {
            console.log('No new documents to update, using existing ones');        }
        
        // Fetch created field with relationships including SubFields
        const createdField = await Field.findByPk(field.id, {
            include: [
                {
                    model: Location,
                    as: 'location',
                    attributes: ['address_text', 'city', 'district', 'ward']
                },
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'name', 'phone']
                },
                {
                    model: SubField,
                    as: 'subfields',
                    attributes: ['id', 'name', 'field_type', 'image']
                }
            ]
        });

        return res.status(201).json(responseFormatter.success({
            message: 'Sân bóng đã được tạo thành công và đang chờ xét duyệt',
            data: {
                field: createdField,
                subFields: subFields,
                totalSubFields: subFieldCount
            }
        }));    } catch (error) {
        console.error('Error in addFieldWithFiles:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi tạo sân bóng',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }));
    }
};

// Update field with file uploads (owner only) - Sets is_verified to false for re-approval
const updateFieldWithFiles = async (req, res) => {
    try {
        console.log('=== updateFieldWithFiles START ===');
        console.log('Field ID:', req.params.id);
        console.log('Request body:', req.body);
        console.log('Request files:', req.files ? Object.keys(req.files) : 'No files');
        
        const fieldId = req.params.id;
        const { 
            name, 
            location, 
            address, 
            field_type, 
            sub_field_count, 
            description, 
            price_per_hour,
            city,
            district,
            ward
        } = req.body;
        const owner_id = req.user.id; // Get from authenticated user
        const uploadedFiles = req.files;

        // Find existing field and verify ownership
        const existingField = await Field.findOne({
            where: { 
                id: fieldId,
                owner_id: owner_id // Ensure owner can only edit their own fields
            },
            include: [
                {
                    model: Location,
                    as: 'location',
                    attributes: ['id']
                }
            ]
        });

        if (!existingField) {
            return res.status(404).json(responseFormatter.error({
                code: 'NOT_FOUND',
                message: 'Không tìm thấy sân bóng hoặc bạn không có quyền chỉnh sửa'
            }));
        }

        console.log('Found existing field:', existingField.name);

        // Validate required fields
        if (!name || !location || !address || !field_type || !sub_field_count || !price_per_hour) {
            console.log('Validation failed - missing required fields');
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Dữ liệu không hợp lệ',
                details: {
                    name: !name ? 'Tên sân không được để trống' : undefined,
                    location: !location ? 'Quận/huyện không được để trống' : undefined,
                    address: !address ? 'Địa chỉ không được để trống' : undefined,
                    field_type: !field_type ? 'Loại sân không được để trống' : undefined,
                    sub_field_count: !sub_field_count ? 'Số lượng sân con không được để trống' : undefined,
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

        // Validate field_type
        const validFieldTypes = ['5vs5', '7vs7'];
        if (!validFieldTypes.includes(field_type)) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Loại sân không hợp lệ. Chỉ chấp nhận 5vs5 hoặc 7vs7'
            }));
        }

        // Validate sub_field_count
        const subFieldCount = parseInt(sub_field_count);
        if (isNaN(subFieldCount) || subFieldCount < 1 || subFieldCount > 10) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Số lượng sân con phải từ 1 đến 10'
            }));
        }

        // Initialize image URLs with existing values
        let images1 = existingField.images1;
        let images2 = existingField.images2;
        let images3 = existingField.images3;

        // Handle image uploads if provided
        if (uploadedFiles) {
            console.log('Processing file uploads...');
            
            try {
                // Upload new images to Cloudinary
                if (uploadedFiles.image1) {
                    const result1 = await uploadImage(uploadedFiles.image1[0].buffer, {
                        folder: 'fields',
                        public_id: `field_${owner_id}_image1_${Date.now()}`
                    });
                    images1 = result1.secure_url;
                }
                if (uploadedFiles.image2) {
                    const result2 = await uploadImage(uploadedFiles.image2[0].buffer, {
                        folder: 'fields',
                        public_id: `field_${owner_id}_image2_${Date.now()}`
                    });
                    images2 = result2.secure_url;
                }
                if (uploadedFiles.image3) {
                    const result3 = await uploadImage(uploadedFiles.image3[0].buffer, {
                        folder: 'fields',
                        public_id: `field_${owner_id}_image3_${Date.now()}`
                    });
                    images3 = result3.secure_url;
                }
            } catch (uploadError) {
                console.error('Error uploading to Cloudinary:', uploadError);
                return res.status(500).json(responseFormatter.error({
                    code: 'UPLOAD_ERROR',
                    message: 'Lỗi khi upload ảnh lên Cloudinary',
                    details: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
                }));
            }
        }

        // Update location
        await Location.update({
            address_text: address,
            city: city || 'Đà Nẵng',
            district: district || location,
            ward: ward || 'Thuận Thành'
        }, {
            where: { id: existingField.location.id }
        });

        // Update field - IMPORTANT: Set is_verified to false for re-approval
        const updatedField = await Field.update({
            name,
            description,
            price_per_hour,
            images1,
            images2,
            images3,
            is_verified: false // This field needs re-approval after editing
        }, {
            where: { id: fieldId },
            returning: true
        });

        // Update SubFields if field type or count changed
        const currentSubFields = await SubField.findAll({
            where: { field_id: fieldId }
        });

        // If sub field count changed, recreate subfields
        if (currentSubFields.length !== subFieldCount) {
            // Delete existing subfields
            await SubField.destroy({ where: { field_id: fieldId } });
            
            // Create new subfields
            const subFields = [];
            for (let i = 1; i <= subFieldCount; i++) {
                const alphabetLetter = String.fromCharCode(64 + i);
                const subField = await SubField.create({
                    field_id: fieldId,
                    name: `Sân ${alphabetLetter}`,
                    field_type: field_type,
                    image: images1
                });
                subFields.push(subField);
            }
        } else {
            // Just update field type if it changed
            await SubField.update({
                field_type: field_type,
                image: images1
            }, {
                where: { field_id: fieldId }
            });
        }

        // Fetch updated field with relationships
        const updatedFieldData = await Field.findByPk(fieldId, {
            include: [
                {
                    model: Location,
                    as: 'location',
                    attributes: ['address_text', 'city', 'district', 'ward']
                },
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'name', 'phone']
                },
                {
                    model: SubField,
                    as: 'subfields',
                    attributes: ['id', 'name', 'field_type', 'image']
                }
            ]
        });

        return res.json(responseFormatter.success({
            message: 'Cập nhật sân bóng thành công. Sân đang chờ xét duyệt lại.',
            data: {
                field: updatedFieldData,
                verification_required: true,
                updated_images: {
                    images1: images1 !== existingField.images1,
                    images2: images2 !== existingField.images2,
                    images3: images3 !== existingField.images3
                }
            }
        }));

    } catch (error) {
        console.error('Error in updateFieldWithFiles:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi cập nhật sân bóng',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }));
    }
};

// Get field detail
const getFieldDetail = async (req, res) => {
    try {
        const fieldId = req.params.id;

        const field = await Field.findByPk(fieldId, {
            include: [
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'name', 'phone']
                },
                {
                    model: Location,
                    as: 'location',
                    attributes: ['id', 'address_text', 'latitude', 'longitude', 'city', 'district', 'ward']
                },
                {
                    model: SubField,
                    as: 'subfields',
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
                    as: 'location',
                    attributes: ['address_text', 'city', 'district', 'ward']
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
                    as: 'location',
                    attributes: ['address_text', 'city', 'district', 'ward']
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

// Get user license information
const getUserLicense = async (req, res) => {
    try {
        const userId = req.user.id; // Get user ID from authenticated user

        const user = await User.findByPk(userId, {
            attributes: [
                'id', 
                'name', 
                'email', 
                'business_license_image',
                'identity_card_image',
                'identity_card_back_image',
                'created_at',
                'updated_at'
            ]
        });

        if (!user) {
            return res.status(404).json(responseFormatter.error({
                code: 'NOT_FOUND',
                message: 'Không tìm thấy thông tin người dùng'
            }));
        }

        // Check if user has complete license documentation
        const hasBusinessLicense = !!user.business_license_image;
        const hasIdentityCardFront = !!user.identity_card_image;
        const hasIdentityCardBack = !!user.identity_card_back_image;
        const hasCompleteLicense = hasBusinessLicense && hasIdentityCardFront && hasIdentityCardBack;

        return res.json(responseFormatter.success({
            license: {
                business_license_image: user.business_license_image,
                identity_card_image: user.identity_card_image,
                identity_card_back_image: user.identity_card_back_image,
                has_complete_license: hasCompleteLicense,
                has_business_license: hasBusinessLicense,
                has_identity_card_front: hasIdentityCardFront,
                has_identity_card_back: hasIdentityCardBack,
                last_updated: user.updated_at
            },
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        }));
    } catch (error) {
        console.error('Error in getUserLicense:', error);
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi lấy thông tin giấy phép',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }));
    }
};

// Update user license documents
const updateUserLicense = async (req, res) => {
    try {
        const userId = req.user.id; // Get user ID from authenticated user
        const uploadedFiles = req.files;

        console.log('=== updateUserLicense START ===');
        console.log('User ID:', userId);
        console.log('Uploaded files:', uploadedFiles ? Object.keys(uploadedFiles) : 'No files');

        // Check if at least one file is uploaded
        if (!uploadedFiles || Object.keys(uploadedFiles).length === 0) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Cần phải upload ít nhất một tài liệu'
            }));
        }

        // Validate file types (optional specific validation)
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        for (const [fieldName, files] of Object.entries(uploadedFiles)) {
            if (files && files[0] && !allowedTypes.includes(files[0].mimetype)) {
                return res.status(400).json(responseFormatter.error({
                    code: 'VALIDATION_ERROR',
                    message: `File ${fieldName} phải là ảnh (JPG, JPEG, PNG, GIF)`
                }));
            }
        }

        // Get current user data
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json(responseFormatter.error({
                code: 'NOT_FOUND',
                message: 'Không tìm thấy thông tin người dùng'
            }));
        }

        // Prepare update data object
        const updateData = {};
        const uploadResults = {};

        try {
            // Handle business license upload
            if (uploadedFiles.business_license_image) {
                const businessResult = await uploadImage(uploadedFiles.business_license_image[0].buffer, {
                    folder: 'business-licenses',
                    public_id: `business_license_${userId}_${Date.now()}`
                });
                updateData.business_license_image = businessResult.secure_url;
                uploadResults.business_license = businessResult.secure_url;
            }

            // Handle identity card front upload
            if (uploadedFiles.identity_card_image) {
                const identityResult = await uploadImage(uploadedFiles.identity_card_image[0].buffer, {
                    folder: 'identity-cards',
                    public_id: `identity_card_front_${userId}_${Date.now()}`
                });
                updateData.identity_card_image = identityResult.secure_url;
                uploadResults.identity_card_front = identityResult.secure_url;
            }

            // Handle identity card back upload
            if (uploadedFiles.identity_card_back_image) {
                const identityBackResult = await uploadImage(uploadedFiles.identity_card_back_image[0].buffer, {
                    folder: 'identity-cards',
                    public_id: `identity_card_back_${userId}_${Date.now()}`
                });
                updateData.identity_card_back_image = identityBackResult.secure_url;
                uploadResults.identity_card_back = identityBackResult.secure_url;
            }
        } catch (uploadError) {
            console.error('Error uploading to Cloudinary:', uploadError);
            return res.status(500).json(responseFormatter.error({
                code: 'UPLOAD_ERROR',
                message: 'Lỗi khi upload ảnh lên Cloudinary',
                details: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
            }));
        }

        // Update user with new document URLs
        if (Object.keys(updateData).length > 0) {
            await User.update(updateData, {
                where: { id: userId }
            });

            // Get updated user data
            const updatedUser = await User.findByPk(userId, {
                attributes: [
                    'id', 
                    'name', 
                    'email', 
                    'business_license_image',
                    'identity_card_image',
                    'identity_card_back_image',
                    'updated_at'
                ]
            });

            // Check completion status
            const hasBusinessLicense = !!updatedUser.business_license_image;
            const hasIdentityCardFront = !!updatedUser.identity_card_image;
            const hasIdentityCardBack = !!updatedUser.identity_card_back_image;
            const hasCompleteLicense = hasBusinessLicense && hasIdentityCardFront && hasIdentityCardBack;

            return res.json(responseFormatter.success({
                message: 'Cập nhật tài liệu thành công',
                license: {
                    business_license_image: updatedUser.business_license_image,
                    identity_card_image: updatedUser.identity_card_image,
                    identity_card_back_image: updatedUser.identity_card_back_image,
                    has_complete_license: hasCompleteLicense,
                    has_business_license: hasBusinessLicense,
                    has_identity_card_front: hasIdentityCardFront,
                    has_identity_card_back: hasIdentityCardBack,
                    last_updated: updatedUser.updated_at
                },
                upload_results: uploadResults,
                updated_fields: Object.keys(updateData)
            }));
        } else {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Không có tài liệu nào được upload'
            }));
        }

    } catch (error) {
        console.error('Error in updateUserLicense:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi cập nhật giấy phép',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }));
    }
};

// Delete specific license document
const deleteLicenseDocument = async (req, res) => {
    try {
        const userId = req.user.id;
        const { document_type } = req.params; // 'business_license', 'identity_card_front', 'identity_card_back'

        // Validate document type
        const validDocumentTypes = ['business_license', 'identity_card_front', 'identity_card_back'];
        if (!validDocumentTypes.includes(document_type)) {
            return res.status(400).json(responseFormatter.error({
                code: 'VALIDATION_ERROR',
                message: 'Loại tài liệu không hợp lệ'
            }));
        }

        // Map document type to database field
        const fieldMapping = {
            'business_license': 'business_license_image',
            'identity_card_front': 'identity_card_image',
            'identity_card_back': 'identity_card_back_image'
        };

        const fieldName = fieldMapping[document_type];

        // Get current user data
        const user = await User.findByPk(userId, {
            attributes: ['id', fieldName]
        });

        if (!user) {
            return res.status(404).json(responseFormatter.error({
                code: 'NOT_FOUND',
                message: 'Không tìm thấy thông tin người dùng'
            }));
        }

        // Check if document exists
        if (!user[fieldName]) {
            return res.status(404).json(responseFormatter.error({
                code: 'NOT_FOUND',
                message: 'Tài liệu không tồn tại'
            }));
        }

        // Update user to remove document
        await User.update(
            { [fieldName]: null },
            { where: { id: userId } }
        );

        return res.json(responseFormatter.success({
            message: 'Xóa tài liệu thành công',
            deleted_document: document_type
        }));

    } catch (error) {
        console.error('Error in deleteLicenseDocument:', error);
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi xóa tài liệu',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }));
    }
};


// Get field detail for editing (owner only)
const getFieldForEdit = async (req, res) => {
    try {
        const fieldId = req.params.id;
        const ownerId = req.user.id;

        const field = await Field.findOne({
            where: { 
                id: fieldId,
                owner_id: ownerId
            },
            include: [
                {
                    model: Location,
                    as: 'location',
                    attributes: ['address_text', 'city', 'district', 'ward']
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
            return res.status(404).json(responseFormatter.error({
                code: 'NOT_FOUND',
                message: 'Không tìm thấy sân bóng hoặc bạn không có quyền chỉnh sửa'
            }));
        }

        return res.json(responseFormatter.success(field));
    } catch (error) {
        console.error('Error in getFieldForEdit:', error);
        return res.status(500).json(responseFormatter.error({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Đã có lỗi xảy ra khi lấy thông tin sân bóng',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }));
    }
};

module.exports = {
    getAllFields,
    getFields,
    addField,
    getFieldDetail,
    searchFields,
    // Thêm các chức năng mới
    getOwnerFields,
    addFieldWithFiles,
    updateFieldWithFiles,
    getFieldForEdit,
    // License management functions
    getUserLicense,
    updateUserLicense,
    deleteLicenseDocument
};