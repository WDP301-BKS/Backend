const { User } = require('../models');
const { successResponse, errorResponse, forbiddenResponse } = require('../common/responses/apiResponse');
const { USER_ROLES } = require('../common/constants');

class PackageController {
  // Lấy thông tin các gói dịch vụ
  async getPackages(req, res) {
    try {
      const packages = [
        {
          type: 'basic',
          name: 'Gói Cơ Bản',
          price: 299000,
          features: [
            'Tạo tối đa 2 sân bóng',
            'Quản lý lịch đặt sân',
            'Báo cáo doanh thu cơ bản',
            'Hỗ trợ khách hàng qua email'
          ],
          maxFields: 2,
          duration: '1 tháng'
        },
        {
          type: 'premium',
          name: 'Gói Nâng Cao',
          price: 599000,
          features: [
            'Tạo tối đa 5 sân bóng',
            'Quản lý lịch đặt sân nâng cao',
            'Báo cáo doanh thu chi tiết',
            'Hỗ trợ khách hàng 24/7',
            'Quảng cáo ưu tiên',
            'Tích hợp thanh toán'
          ],
          maxFields: 5,
          duration: '1 tháng'
        }
      ];

      return successResponse(res, 'Lấy thông tin gói dịch vụ thành công', packages);
    } catch (error) {
      console.error('Error getting packages:', error);
      return errorResponse(res, 'Lỗi server', 500);
    }
  }

  // Mua gói dịch vụ
  async purchasePackage(req, res) {
    try {
      const userId = req.user.id;
      const { packageType, paymentMethod } = req.body;

      if (!['basic', 'premium'].includes(packageType)) {
        return errorResponse(res, 'Gói dịch vụ không hợp lệ', 400);
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return errorResponse(res, 'Người dùng không tồn tại', 404);
      }

      // Kiểm tra role
      if (user.role !== USER_ROLES.OWNER) {
        return forbiddenResponse(res, 'Chỉ chủ sân mới có thể mua gói dịch vụ');
      }

      // Simulate payment process (trong thực tế sẽ tích hợp với cổng thanh toán)
      // Ở đây giả sử thanh toán thành công

      await User.update(
        {
          package_type: packageType,
          package_purchase_date: new Date()
        },
        {
          where: { id: userId }
        }
      );

      return successResponse(res, 'Mua gói dịch vụ thành công', {
        packageType,
        purchaseDate: new Date(),
        message: 'Vui lòng upload giấy phép kinh doanh và căn cước công dân để tiếp tục'
      });

    } catch (error) {
      console.error('Error purchasing package:', error);
      return errorResponse(res, 'Lỗi mua gói dịch vụ', 500);
    }
  }

  // Kiểm tra gói hiện tại của user
  async getCurrentPackage(req, res) {
    try {
      const userId = req.user.id;
      
      const user = await User.findByPk(userId, {
        attributes: ['package_type', 'package_purchase_date', 'business_license_image', 'identity_card_image']
      });

      if (!user) {
        return errorResponse(res, 'Người dùng không tồn tại', 404);
      }

      return successResponse(res, 'Lấy thông tin gói hiện tại thành công', user);

    } catch (error) {
      console.error('Error getting current package:', error);
      return errorResponse(res, 'Lỗi server', 500);
    }
  }
}

module.exports = new PackageController();
