const { Field, User, Location, SubField } = require('../models');
const { successResponse, errorResponse, forbiddenResponse } = require('../common/responses/apiResponse');
const { USER_ROLES } = require('../common/constants');

class AdminController {
  // Lấy danh sách field chờ duyệt
  async getPendingFields(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const { count, rows } = await Field.findAndCountAll({
        where: { is_verified: false },
        include: [
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'name', 'email', 'phone', 'business_license_image', 'identity_card_image'],
            where: { role: USER_ROLES.OWNER }
          },
          {
            model: Location,
            as: 'location',
            attributes: ['address_text', 'city', 'district', 'ward', 'latitude', 'longitude']
          },
          {
            model: SubField,
            as: 'subfields',
            attributes: ['id', 'name', 'field_type', 'image']
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
        limit,
        offset,
        order: [['created_at', 'ASC']]
      });

      const totalPages = Math.ceil(count / limit);

      return successResponse(res, 'Lấy danh sách sân chờ duyệt thành công', {
        items: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages
        }
      });

    } catch (error) {
      console.error('Error getting pending fields:', error);
      return errorResponse(res, 'Lỗi lấy danh sách sân chờ duyệt', 500);
    }
  }

  // Duyệt sân
  async approveField(req, res) {
    try {
      const { fieldId } = req.params;
      const { approved, reason } = req.body;

      const field = await Field.findByPk(fieldId, {
        include: [
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      if (!field) {
        return errorResponse(res, 'Không tìm thấy sân', 404);
      }

      if (field.is_verified) {
        return errorResponse(res, 'Sân đã được duyệt trước đó', 400);
      }

      if (approved) {
        // Duyệt sân
        await Field.update(
          { is_verified: true },
          { where: { id: fieldId } }
        );

        // TODO: Gửi notification cho owner về việc sân được duyệt
        
        return successResponse(res, 'Duyệt sân thành công', {
          fieldId,
          approved: true,
          ownerName: field.owner.name
        });
      } else {
        // Từ chối sân - có thể xóa hoặc giữ lại với ghi chú
        if (!reason) {
          return errorResponse(res, 'Cần cung cấp lý do từ chối', 400);
        }

        // Ở đây bạn có thể chọn xóa sân hoặc thêm field lý do từ chối
        await Field.destroy({ where: { id: fieldId } });

        // TODO: Gửi notification cho owner về việc sân bị từ chối kèm lý do

        return successResponse(res, 'Từ chối sân thành công', {
          fieldId,
          approved: false,
          reason,
          ownerName: field.owner.name
        });
      }

    } catch (error) {
      console.error('Error approving field:', error);
      return errorResponse(res, 'Lỗi duyệt sân', 500);
    }
  }

  // Lấy thống kê tổng quan
  async getDashboardStats(req, res) {
    try {
      const totalUsers = await User.count();
      const totalOwners = await User.count({ where: { role: USER_ROLES.OWNER } });
      const totalCustomers = await User.count({ where: { role: USER_ROLES.CUSTOMER } });
      const totalFields = await Field.count();
      const verifiedFields = await Field.count({ where: { is_verified: true } });
      const pendingFields = await Field.count({ where: { is_verified: false } });
      
      // Thống kê gói dịch vụ
      const basicPackageUsers = await User.count({ where: { package_type: 'basic' } });
      const premiumPackageUsers = await User.count({ where: { package_type: 'premium' } });
      const noPackageUsers = await User.count({ where: { package_type: 'none' } });

      return successResponse(res, 'Lấy thống kê thành công', {
        users: {
          total: totalUsers,
          owners: totalOwners,
          customers: totalCustomers
        },
        fields: {
          total: totalFields,
          verified: verifiedFields,
          pending: pendingFields
        },
        packages: {
          basic: basicPackageUsers,
          premium: premiumPackageUsers,
          none: noPackageUsers
        }
      });

    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      return errorResponse(res, 'Lỗi lấy thống kê', 500);
    }
  }

  // Lấy danh sách tất cả field (cho admin)
  async getAllFieldsForAdmin(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const status = req.query.status; // 'verified', 'pending', 'all'

      let whereCondition = {};
      if (status === 'verified') {
        whereCondition.is_verified = true;
      } else if (status === 'pending') {
        whereCondition.is_verified = false;
      }

      const { count, rows } = await Field.findAndCountAll({
        where: whereCondition,
        include: [
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'name', 'email', 'phone', 'package_type']
          },
          {
            model: Location,
            as: 'location',
            attributes: ['address_text', 'city', 'district', 'ward']
          }
        ],
        attributes: [
          'id',
          'name',
          'description',
          'price_per_hour',
          'images1',
          'is_verified',
          'created_at'
        ],
        limit,
        offset,
        order: [['created_at', 'DESC']]
      });

      const totalPages = Math.ceil(count / limit);

      return successResponse(res, 'Lấy danh sách sân thành công', {
        items: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages
        }
      });

    } catch (error) {
      console.error('Error getting all fields for admin:', error);
      return errorResponse(res, 'Lỗi lấy danh sách sân', 500);
    }
  }
}

module.exports = new AdminController();
