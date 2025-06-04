const { Review, Field, User, Booking, TimeSlot, SubField } = require('../models');
const { v4: uuidv4 } = require('uuid');

const createReview = async (req, res) => {
  try {
    const { field_id, rating, comment } = req.body;
    const user_id = req.user?.id;

    // Bước 1: Kiểm tra dữ liệu đầu vào
    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Bạn cần đăng nhập để gửi đánh giá.',
      });
    }

    if (!field_id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp field_id và rating hợp lệ (từ 1 đến 5).',
      });
    }

    // Bước 2: Kiểm tra xem người dùng đã đánh giá sân này chưa
    const existingReview = await Review.findOne({
      where: {
        user_id,
        field_id
      }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh giá sân này rồi. Mỗi người chỉ được đánh giá một lần cho mỗi sân.',
      });
    }

    // Bước 3: Kiểm tra xem sân có tồn tại không
    const field = await Field.findByPk(field_id);
    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Sân bóng không tồn tại.',
      });
    }

    // Bước 4: Kiểm tra xem người dùng có booking "completed" cho sân này không
    const completedBooking = await Booking.findOne({
      include: [{
        model: TimeSlot,
        include: [{
          model: SubField,
          where: { field_id }
        }]
      }],
      where: {
        user_id,
        status: 'completed'
      }
    });

    if (!completedBooking) {
      return res.status(403).json({
        success: false,
        message: 'Bạn cần có ít nhất một booking đã hoàn thành để đánh giá sân này.',
      });
    }

    // Bước 5: Tạo đánh giá mới
    const review = await Review.create({
      id: uuidv4(),
      user_id,
      field_id,
      rating,
      comment: comment || null,
      created_at: new Date(),
    });

    // Bước 6: Lấy thông tin đánh giá kèm user và field
    const reviewWithDetails = await Review.findOne({
      where: { id: review.id },
      include: [
        { model: User, attributes: ['id', 'name', 'profileImage'] },
        { model: Field, attributes: ['id', 'name'] },
      ],
    });

    return res.status(201).json({
      success: true,
      message: 'Đã tạo đánh giá thành công.',
      data: reviewWithDetails,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo đánh giá.',
      error: error.message,
    });
  }
};

const getReviewsByField = async (req, res) => {
  const { field_id } = req.params;
  const user_id = req.user?.id;

  try {
    const reviews = await Review.findAll({
      where: { field_id },
      include: [
        { model: User, attributes: ['id', 'name', 'profileImage'] },
        { model: Field, attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
    });

    // Kiểm tra xem người dùng đã đánh giá sân này chưa
    let canReview = false;
    let hasReviewed = false;
    
    if (user_id) {
      const existingReview = await Review.findOne({
        where: {
          user_id,
          field_id
        }
      });
      
      hasReviewed = !!existingReview;
      // Kiểm tra nếu người dùng có booking "completed" để cho phép đánh giá
      const completedBooking = await Booking.findOne({
        include: [{
          model: TimeSlot,
          include: [{
            model: SubField,
            where: { field_id }
          }]
        }],
        where: {
          user_id,
          status: 'completed'
        }
      });
      canReview = !hasReviewed && !!completedBooking;
    }

    if (!reviews || reviews.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Chưa có đánh giá nào cho sân này',
        data: [],
        canReview,
        hasReviewed,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Danh sách đánh giá',
      data: reviews,
      canReview,
      hasReviewed,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách đánh giá',
      error: error.message,
      canReview: false,
      hasReviewed: false,
    });
  }
};


module.exports = { 
  createReview, 
  getReviewsByField, 

};