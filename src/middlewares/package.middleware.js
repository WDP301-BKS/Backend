const { User, Field } = require('../models');
const { errorResponse } = require('../common/responses/apiResponse');
const { USER_ROLES } = require('../common/constants');

// Middleware kiểm tra gói dịch vụ
const checkPackageSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      return errorResponse(res, 'Người dùng không tồn tại', 404);
    }

    // Chỉ áp dụng cho owner
    if (user.role !== USER_ROLES.OWNER) {
      return next();
    }

    // Kiểm tra đã mua gói dịch vụ chưa
    if (user.package_type === 'none') {
      return errorResponse(res, 'Bạn cần mua gói dịch vụ trước khi thực hiện hành động này', 400, {
        needPackage: true,
        redirectTo: '/packages'
      });
    }

    // Thêm thông tin gói vào request
    req.userPackage = {
      type: user.package_type,
      purchaseDate: user.package_purchase_date,
      maxFields: user.package_type === 'basic' ? 2 : 5
    };

    next();
  } catch (error) {
    console.error('Error in checkPackageSubscription middleware:', error);
    return errorResponse(res, 'Lỗi server', 500);
  }
};

// Middleware kiểm tra số lượng sân
const checkFieldLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user || user.role !== USER_ROLES.OWNER) {
      return next();
    }

    // Đếm số sân hiện tại
    const currentFieldCount = await Field.count({
      where: { owner_id: userId }
    });

    const maxFields = user.package_type === 'basic' ? 2 : user.package_type === 'premium' ? 5 : 0;

    if (currentFieldCount >= maxFields) {
      return errorResponse(res, `Gói ${user.package_type} chỉ cho phép tạo tối đa ${maxFields} sân`, 400, {
        currentCount: currentFieldCount,
        maxFields: maxFields,
        needUpgrade: user.package_type === 'basic'
      });
    }

    // Thêm thông tin vào request
    req.fieldLimits = {
      current: currentFieldCount,
      max: maxFields,
      canCreate: true
    };

    next();
  } catch (error) {
    console.error('Error in checkFieldLimit middleware:', error);
    return errorResponse(res, 'Lỗi server', 500);
  }
};

// Middleware kiểm tra giấy tờ đã upload
const checkDocuments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user || user.role !== USER_ROLES.OWNER) {
      return next();
    }

    if (!user.business_license_image || !user.identity_card_image) {
      return errorResponse(res, 'Bạn cần upload giấy phép kinh doanh và căn cước công dân', 400, {
        needDocuments: true,
        missingDocuments: {
          businessLicense: !user.business_license_image,
          identityCard: !user.identity_card_image
        }
      });
    }

    next();
  } catch (error) {
    console.error('Error in checkDocuments middleware:', error);
    return errorResponse(res, 'Lỗi server', 500);
  }
};

// Middleware tổng hợp kiểm tra tất cả điều kiện tạo field
const validateFieldCreation = async (req, res, next) => {
  try {
    await checkPackageSubscription(req, res, async () => {
      await checkFieldLimit(req, res, async () => {
        await checkDocuments(req, res, next);
      });
    });
  } catch (error) {
    console.error('Error in validateFieldCreation middleware:', error);
    return errorResponse(res, 'Lỗi server', 500);
  }
};

module.exports = {
  checkPackageSubscription,
  checkFieldLimit,
  checkDocuments,
  validateFieldCreation
};
