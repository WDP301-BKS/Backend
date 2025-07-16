const { sequelize } = require('../config/db.config');
const { Op } = require('sequelize');
const { ReviewReply } = require('../models');

// Revenue Controller
const revenueController = {
  // GET /api/revenue/dashboard
  getDashboardData: async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Lấy dữ liệu thực từ database
      const [stats, fieldRevenue, monthlyRevenue] = await Promise.all([
        revenueController.getDashboardStatsData(userId),
        revenueController.getFieldRevenueData(userId),
        revenueController.getMonthlyRevenueData(userId)
      ]);

      res.json({
        success: true,
        data: {
          stats,
          fieldRevenue,
          monthlyRevenue
        },
        message: 'Dữ liệu revenue dashboard đã được tải thành công'
      });
    } catch (error) {
      console.error('Error in getDashboardData:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải dữ liệu revenue dashboard',
        error: error.message
      });
    }
  },

  // Hàm helper để lấy stats dashboard
  getDashboardStatsData: async (userId) => {
    const currentDate = new Date();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const lastMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);

    // Query tổng doanh thu tháng hiện tại (bao gồm cả paid)
    const currentMonthRevenue = await sequelize.query(`
      SELECT COALESCE(SUM(b.total_price), 0) as total_revenue
      FROM bookings b
      INNER JOIN timeslots t ON b.id = t.booking_id
      INNER JOIN subfields s ON t.sub_field_id = s.id
      INNER JOIN fields f ON s.field_id = f.id
      WHERE f.owner_id = :userId 
        AND b.payment_status IN ('completed', 'paid')
        AND b.booking_date >= :currentMonth
        AND b.booking_date < :nextMonth
    `, {
      replacements: { 
        userId, 
        currentMonth,
        nextMonth: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      },
      type: sequelize.QueryTypes.SELECT
    });

    // Query tổng doanh thu tháng trước (bao gồm cả paid)
    const lastMonthRevenue = await sequelize.query(`
      SELECT COALESCE(SUM(b.total_price), 0) as total_revenue
      FROM bookings b
      INNER JOIN timeslots t ON b.id = t.booking_id
      INNER JOIN subfields s ON t.sub_field_id = s.id
      INNER JOIN fields f ON s.field_id = f.id
      WHERE f.owner_id = :userId 
        AND b.payment_status IN ('completed', 'paid')
        AND b.booking_date >= :lastMonth
        AND b.booking_date <= :lastMonthEnd
    `, {
      replacements: { userId, lastMonth, lastMonthEnd },
      type: sequelize.QueryTypes.SELECT
    });

    // Query tổng số booking tháng hiện tại
    const currentMonthBookings = await sequelize.query(`
      SELECT COUNT(*) as total_bookings
      FROM bookings b
      INNER JOIN timeslots t ON b.id = t.booking_id
      INNER JOIN subfields s ON t.sub_field_id = s.id
      INNER JOIN fields f ON s.field_id = f.id
      WHERE f.owner_id = :userId 
        AND b.booking_date >= :currentMonth
        AND b.booking_date < :nextMonth
    `, {
      replacements: { 
        userId, 
        currentMonth,
        nextMonth: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      },
      type: sequelize.QueryTypes.SELECT
    });

    // Query tổng số booking tháng trước
    const lastMonthBookings = await sequelize.query(`
      SELECT COUNT(*) as total_bookings
      FROM bookings b
      INNER JOIN timeslots t ON b.id = t.booking_id
      INNER JOIN subfields s ON t.sub_field_id = s.id
      INNER JOIN fields f ON s.field_id = f.id
      WHERE f.owner_id = :userId 
        AND b.booking_date >= :lastMonth
        AND b.booking_date <= :lastMonthEnd
    `, {
      replacements: { userId, lastMonth, lastMonthEnd },
      type: sequelize.QueryTypes.SELECT
    });

    // Query khách hàng mới tháng hiện tại
    const newCustomers = await sequelize.query(`
      SELECT COUNT(DISTINCT b.user_id) as new_customers
      FROM bookings b
      INNER JOIN timeslots t ON b.id = t.booking_id
      INNER JOIN subfields s ON t.sub_field_id = s.id
      INNER JOIN fields f ON s.field_id = f.id
      WHERE f.owner_id = :userId 
        AND b.booking_date >= :currentMonth
        AND b.booking_date < :nextMonth
        AND b.user_id IS NOT NULL
        AND b.user_id NOT IN (
          SELECT DISTINCT b2.user_id 
          FROM bookings b2
          INNER JOIN timeslots t2 ON b2.id = t2.booking_id
          INNER JOIN subfields s2 ON t2.sub_field_id = s2.id
          INNER JOIN fields f2 ON s2.field_id = f2.id
          WHERE f2.owner_id = :userId 
            AND b2.booking_date < :currentMonth
            AND b2.user_id IS NOT NULL
        )
    `, {
      replacements: { 
        userId, 
        currentMonth,
        nextMonth: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      },
      type: sequelize.QueryTypes.SELECT
    });

    // Tính tỷ lệ tăng trưởng
    const currentRevenue = parseFloat(currentMonthRevenue[0].total_revenue) || 0;
    const lastRevenue = parseFloat(lastMonthRevenue[0].total_revenue) || 0;
    const currentBookings = parseInt(currentMonthBookings[0].total_bookings) || 0;
    const lastBookings = parseInt(lastMonthBookings[0].total_bookings) || 0;

    const revenueGrowth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue * 100) : 0;
    const bookingGrowth = lastBookings > 0 ? ((currentBookings - lastBookings) / lastBookings * 100) : 0;

    // Tính điểm đánh giá trung bình
    const avgRating = await sequelize.query(`
      SELECT COALESCE(AVG(r.rating), 0) as avg_rating,
             COUNT(r.id) as total_reviews
      FROM reviews r
      INNER JOIN fields f ON r.field_id = f.id
      WHERE f.owner_id = :userId
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });

    // Tính điểm đánh giá tháng trước để so sánh
    const lastMonthRating = await sequelize.query(`
      SELECT COALESCE(AVG(r.rating), 0) as avg_rating
      FROM reviews r
      INNER JOIN fields f ON r.field_id = f.id
      WHERE f.owner_id = :userId
        AND r.created_at >= :lastMonth
        AND r.created_at < :currentMonth
    `, {
      replacements: { userId, lastMonth, currentMonth },
      type: sequelize.QueryTypes.SELECT
    });

    const currentAvgRating = parseFloat(avgRating[0].avg_rating) || 0;
    const lastAvgRating = parseFloat(lastMonthRating[0].avg_rating) || 0;
    const ratingGrowth = lastAvgRating > 0 ? ((currentAvgRating - lastAvgRating) / lastAvgRating * 100) : 0;

    return {
      totalRevenue: currentRevenue,
      totalBookings: currentBookings,
      newCustomers: parseInt(newCustomers[0].new_customers) || 0,
      averageRating: Math.round(currentAvgRating * 10) / 10, // Thay thế utilizationRate
      totalReviews: parseInt(avgRating[0].total_reviews) || 0,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      bookingGrowth: Math.round(bookingGrowth * 10) / 10,
      customerGrowth: 12.5, // Tạm thời hardcode
      ratingGrowth: Math.round(ratingGrowth * 10) / 10 // Thay thế utilizationGrowth
    };
  },

  // Hàm helper để lấy doanh thu theo sân (bao gồm cả điểm đánh giá)
  getFieldRevenueData: async (userId) => {
    const currentDate = new Date();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const fieldRevenue = await sequelize.query(`
      SELECT 
        f.id,
        f.name,
        COALESCE(SUM(b.total_price), 0) as revenue,
        COUNT(b.id) as bookings,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.id) as total_reviews
      FROM fields f
      LEFT JOIN subfields s ON f.id = s.field_id
      LEFT JOIN timeslots t ON s.id = t.sub_field_id
      LEFT JOIN bookings b ON t.booking_id = b.id 
        AND b.payment_status IN ('completed', 'paid')
        AND b.booking_date >= :currentMonth
        AND b.booking_date < :nextMonth
      LEFT JOIN reviews r ON f.id = r.field_id
      WHERE f.owner_id = :userId
      GROUP BY f.id, f.name
      ORDER BY revenue DESC
      LIMIT 5
    `, {
      replacements: { 
        userId, 
        currentMonth,
        nextMonth: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      },
      type: sequelize.QueryTypes.SELECT
    });

    // Tính tổng doanh thu để tính phần trăm
    const totalRevenue = fieldRevenue.reduce((sum, field) => sum + parseFloat(field.revenue || 0), 0);

    return fieldRevenue.map(field => ({
      id: field.id,
      name: field.name,
      revenue: parseFloat(field.revenue || 0),
      bookings: parseInt(field.bookings || 0),
      averageRating: Math.round(parseFloat(field.avg_rating || 0) * 10) / 10, // Điểm đánh giá riêng cho từng sân
      totalReviews: parseInt(field.total_reviews || 0), // Số lượng review riêng cho từng sân
      growth: Math.random() * 20, // Tạm thời random, có thể tính growth thực tế sau
      percentage: totalRevenue > 0 ? Math.round((parseFloat(field.revenue || 0) / totalRevenue) * 100) : 0
    }));
  },

  // Hàm helper để lấy doanh thu theo tháng
  getMonthlyRevenueData: async (userId) => {
    const currentDate = new Date();
    const monthsData = [];

    for (let i = 4; i >= 0; i--) {
      const month = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 1);
      
      const revenue = await sequelize.query(`
        SELECT COALESCE(SUM(b.total_price), 0) as total_revenue
        FROM bookings b
        INNER JOIN timeslots t ON b.id = t.booking_id
        INNER JOIN subfields s ON t.sub_field_id = s.id
        INNER JOIN fields f ON s.field_id = f.id
        WHERE f.owner_id = :userId 
          AND b.payment_status IN ('completed', 'paid')
          AND b.booking_date >= :month
          AND b.booking_date < :nextMonth
      `, {
        replacements: { userId, month, nextMonth },
        type: sequelize.QueryTypes.SELECT
      });

      monthsData.push({
        month: `T${month.getMonth() + 1}`,
        revenue: parseFloat(revenue[0].total_revenue) || 0
      });
    }

    return monthsData;
  },

  // GET /api/revenue/dashboard-stats
  getDashboardStats: async (req, res) => {
    try {
      const userId = req.user.id;
      const stats = await revenueController.getDashboardStatsData(userId);

      res.json({
        success: true,
        data: stats,
        message: 'Dữ liệu thống kê dashboard đã được tải thành công'
      });
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải dữ liệu thống kê dashboard',
        error: error.message
      });
    }
  },

  // GET /api/revenue/field-revenue
  getFieldRevenue: async (req, res) => {
    try {
      const userId = req.user.id;
      const fieldRevenue = await revenueController.getFieldRevenueData(userId);

      res.json({
        success: true,
        data: fieldRevenue,
        message: 'Dữ liệu doanh thu theo sân đã được tải thành công'
      });
    } catch (error) {
      console.error('Error in getFieldRevenue:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải dữ liệu doanh thu theo sân',
        error: error.message
      });
    }
  },

  // GET /api/revenue/monthly-revenue
  getMonthlyRevenue: async (req, res) => {
    try {
      const userId = req.user.id;
      const monthlyRevenue = await revenueController.getMonthlyRevenueData(userId);

      res.json({
        success: true,
        data: monthlyRevenue,
        message: 'Dữ liệu doanh thu theo tháng đã được tải thành công'
      });
    } catch (error) {
      console.error('Error in getMonthlyRevenue:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải dữ liệu doanh thu theo tháng',
        error: error.message
      });
    }
  },

  // GET /api/revenue/recent-bookings
  getRecentBookings: async (req, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 5;
      
      const recentBookings = await sequelize.query(`
        SELECT 
          b.id,
          b.booking_date,
          b.status,
          b.payment_status,
          b.created_at,
          u.name as customer_name,
          u.email as customer_email,
          f.name as field_name,
          CASE 
            WHEN u.name IS NOT NULL THEN 
              UPPER(SUBSTRING(u.name, 1, 1)) || 
              UPPER(SUBSTRING(TRIM(SUBSTRING(u.name FROM POSITION(' ' IN u.name) + 1)), 1, 1))
            ELSE 'GU'
          END as avatar_initials
        FROM bookings b
        INNER JOIN timeslots t ON b.id = t.booking_id
        INNER JOIN subfields s ON t.sub_field_id = s.id
        INNER JOIN fields f ON s.field_id = f.id
        LEFT JOIN users u ON b.user_id = u.id
        WHERE f.owner_id = :userId
        ORDER BY b.created_at DESC
        LIMIT :limit
      `, {
        replacements: { userId, limit },
        type: sequelize.QueryTypes.SELECT
      });

      const formattedBookings = recentBookings.map(booking => ({
        id: booking.id,
        customerName: booking.customer_name || 'Khách vãng lai',
        fieldName: booking.field_name,
        date: new Date(booking.booking_date).toLocaleDateString('vi-VN'),
        status: booking.status,
        avatar: booking.avatar_initials,
        createdAt: booking.created_at
      }));

      res.json({
        success: true,
        data: formattedBookings,
        message: 'Dữ liệu đặt sân gần đây đã được tải thành công'
      });
    } catch (error) {
      console.error('Error in getRecentBookings:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải dữ liệu đặt sân gần đây',
        error: error.message
      });
    }
  },

  // GET /api/revenue/popular-timeslots
  getPopularTimeSlots: async (req, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 5;
      
      const popularTimeSlots = await sequelize.query(`
        SELECT 
          CONCAT(t.start_time, ' - ', t.end_time) as time_range,
          COUNT(b.id) as bookings_count,
          t.start_time,
          t.end_time
        FROM timeslots t
        INNER JOIN subfields s ON t.sub_field_id = s.id
        INNER JOIN fields f ON s.field_id = f.id
        LEFT JOIN bookings b ON t.booking_id = b.id
          AND b.status IN ('confirmed', 'completed')
          AND b.booking_date >= DATE_TRUNC('month', CURRENT_DATE)
        WHERE f.owner_id = :userId
        GROUP BY t.start_time, t.end_time
        ORDER BY bookings_count DESC, t.start_time ASC
        LIMIT :limit
      `, {
        replacements: { userId, limit },
        type: sequelize.QueryTypes.SELECT
      });

      // Tính tổng bookings để tính phần trăm
      const totalBookings = popularTimeSlots.reduce((sum, slot) => sum + parseInt(slot.bookings_count || 0), 0);
      const maxBookings = Math.max(...popularTimeSlots.map(slot => parseInt(slot.bookings_count || 0)));

      const formattedTimeSlots = popularTimeSlots.map((slot, index) => ({
        id: `${index + 1}`,
        timeRange: slot.time_range,
        bookings: parseInt(slot.bookings_count || 0),
        // Tính phần trăm dựa trên slot có booking nhiều nhất
        percentage: maxBookings > 0 ? Math.round((parseInt(slot.bookings_count || 0) / maxBookings) * 100) : 0
      }));

      res.json({
        success: true,
        data: formattedTimeSlots,
        message: 'Dữ liệu khung giờ phổ biến đã được tải thành công'
      });
    } catch (error) {
      console.error('Error in getPopularTimeSlots:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải dữ liệu khung giờ phổ biến',
        error: error.message
      });
    }
  },

  // GET /api/revenue/recent-reviews
  getRecentReviews: async (req, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 5;
      
      const recentReviews = await sequelize.query(`
        SELECT 
          r.id,
          r.rating,
          r.comment,
          r.created_at,
          f.name as field_name,
          u.name as user_name,
          u.email as user_email,
          CASE 
            WHEN u.name IS NOT NULL THEN 
              UPPER(SUBSTRING(u.name, 1, 1)) || 
              UPPER(SUBSTRING(TRIM(SUBSTRING(u.name FROM POSITION(' ' IN u.name) + 1)), 1, 1))
            ELSE 'KH'
          END as avatar_initials
        FROM reviews r
        INNER JOIN fields f ON r.field_id = f.id
        LEFT JOIN users u ON r.user_id = u.id
        WHERE f.owner_id = :userId
        ORDER BY r.created_at DESC
        LIMIT :limit
      `, {
        replacements: { userId, limit },
        type: sequelize.QueryTypes.SELECT
      });

      const formattedReviews = recentReviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment || 'Không có nhận xét',
        fieldName: review.field_name,
        userName: review.user_name || 'Khách vãng lai',
        userEmail: review.user_email,
        avatar: review.avatar_initials,
        createdAt: review.created_at,
        timeAgo: getTimeAgo(review.created_at)
      }));

      res.json({
        success: true,
        data: formattedReviews,
        message: 'Dữ liệu đánh giá gần đây đã được tải thành công'
      });
    } catch (error) {
      console.error('Error in getRecentReviews:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải dữ liệu đánh giá gần đây',
        error: error.message
      });
    }
  },

  // GET /api/revenue/reviews-detailed - Lấy danh sách đánh giá với phân trang
  getReviewsWithPagination: async (req, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const rating = req.query.rating;
      const search = req.query.search;
      const sortBy = req.query.sortBy || 'newest';
      
      // Build WHERE conditions
      let whereConditions = 'WHERE f.owner_id = :userId';
      const replacements = { userId, limit, offset };
      
      if (rating) {
        whereConditions += ' AND r.rating = :rating';
        replacements.rating = rating;
      }
      
      if (search) {
        whereConditions += ' AND (u.name ILIKE :search OR f.name ILIKE :search OR r.comment ILIKE :search)';
        replacements.search = `%${search}%`;
      }
      
      // Build ORDER BY
      let orderBy = 'ORDER BY r.created_at DESC';
      switch (sortBy) {
        case 'oldest':
          orderBy = 'ORDER BY r.created_at ASC';
          break;
        case 'rating_high':
          orderBy = 'ORDER BY r.rating DESC, r.created_at DESC';
          break;
        case 'rating_low':
          orderBy = 'ORDER BY r.rating ASC, r.created_at DESC';
          break;
        default:
          orderBy = 'ORDER BY r.created_at DESC';
      }
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM reviews r
        INNER JOIN fields f ON r.field_id = f.id
        LEFT JOIN users u ON r.user_id = u.id
        ${whereConditions}
      `;
      
      const countResult = await sequelize.query(countQuery, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });
      
      const totalCount = parseInt(countResult[0].total);
      const totalPages = Math.ceil(totalCount / limit);
      
      // Get reviews with replies
      const reviewsQuery = `
        SELECT 
          r.id,
          r.rating,
          r.comment,
          r.created_at,
          f.name as field_name,
          u.name as user_name,
          u.email as user_email,
          CASE 
            WHEN u.name IS NOT NULL THEN 
              UPPER(SUBSTRING(u.name, 1, 1)) || 
              UPPER(SUBSTRING(TRIM(SUBSTRING(u.name FROM POSITION(' ' IN u.name) + 1)), 1, 1))
            ELSE 'KH'
          END as avatar_initials,
          rr.id as reply_id,
          rr.content as reply_content,
          rr.created_at as reply_created_at
        FROM reviews r
        INNER JOIN fields f ON r.field_id = f.id
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN review_replies rr ON r.id = rr.review_id
        ${whereConditions}
        ${orderBy}
        LIMIT :limit OFFSET :offset
      `;
      
      const reviews = await sequelize.query(reviewsQuery, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });
      
      const formattedReviews = reviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment || 'Không có nhận xét',
        fieldName: review.field_name,
        userName: review.user_name || 'Khách vãng lai',
        userEmail: review.user_email,
        avatar: review.avatar_initials,
        createdAt: review.created_at,
        timeAgo: getTimeAgo(review.created_at),
        reply: review.reply_id ? {
          id: review.reply_id,
          content: review.reply_content,
          createdAt: review.reply_created_at,
          timeAgo: getTimeAgo(review.reply_created_at)
        } : null
      }));
      
      res.json({
        success: true,
        data: {
          reviews: formattedReviews,
          totalCount,
          totalPages,
          currentPage: page
        },
        message: 'Dữ liệu đánh giá chi tiết đã được tải thành công'
      });
    } catch (error) {
      console.error('Error in getReviewsWithPagination:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải dữ liệu đánh giá chi tiết',
        error: error.message
      });
    }
  },

  // POST /api/revenue/reviews/:reviewId/reply - Phản hồi đánh giá
  replyToReview: async (req, res) => {
    try {
      const userId = req.user.id;
      const reviewId = req.params.reviewId;
      const { content } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nội dung phản hồi không được để trống'
        });
      }
      
      // Kiểm tra xem review có thuộc về owner này không
      const reviewCheck = await sequelize.query(`
        SELECT r.id
        FROM reviews r
        INNER JOIN fields f ON r.field_id = f.id
        WHERE r.id = :reviewId AND f.owner_id = :userId
      `, {
        replacements: { reviewId, userId },
        type: sequelize.QueryTypes.SELECT
      });
      
      if (reviewCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đánh giá hoặc bạn không có quyền phản hồi'
        });
      }
      
      // Kiểm tra xem đã có phản hồi chưa
      const existingReply = await sequelize.query(`
        SELECT id FROM review_replies WHERE review_id = :reviewId
      `, {
        replacements: { reviewId },
        type: sequelize.QueryTypes.SELECT
      });
      
      if (existingReply.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Đánh giá này đã có phản hồi'
        });
      }
      
      // Tạo phản hồi mới
      const newReply = await ReviewReply.create({
        reviewId: reviewId,
        content: content.trim()
      });
      
      res.json({
        success: true,
        data: {
          id: newReply.id,
          content: newReply.content,
          createdAt: newReply.createdAt
        },
        message: 'Phản hồi đã được gửi thành công'
      });
    } catch (error) {
      console.error('Error in replyToReview:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi gửi phản hồi',
        error: error.message
      });
    }
  },

  // PUT /api/revenue/reviews/:reviewId/reply/:replyId - Cập nhật phản hồi
  updateReply: async (req, res) => {
    try {
      const userId = req.user.id;
      const reviewId = req.params.reviewId;
      const replyId = req.params.replyId;
      const { content } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nội dung phản hồi không được để trống'
        });
      }
      
      // Kiểm tra quyền sở hữu
      const ownershipCheck = await sequelize.query(`
        SELECT rr.id
        FROM review_replies rr
        INNER JOIN reviews r ON rr.review_id = r.id
        INNER JOIN fields f ON r.field_id = f.id
        WHERE rr.id = :replyId AND r.id = :reviewId AND f.owner_id = :userId
      `, {
        replacements: { replyId, reviewId, userId },
        type: sequelize.QueryTypes.SELECT
      });
      
      if (ownershipCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy phản hồi hoặc bạn không có quyền sửa'
        });
      }
      
      // Cập nhật phản hồi
      const updatedReply = await ReviewReply.update(
        { content: content.trim() },
        { 
          where: { id: replyId },
          returning: true,
          plain: true
        }
      );
      
      res.json({
        success: true,
        data: {
          id: replyId,
          content: content.trim(),
          updatedAt: new Date()
        },
        message: 'Phản hồi đã được cập nhật thành công'
      });
    } catch (error) {
      console.error('Error in updateReply:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật phản hồi',
        error: error.message
      });
    }
  },

  // DELETE /api/revenue/reviews/:reviewId/reply/:replyId - Xóa phản hồi
  deleteReply: async (req, res) => {
    try {
      const userId = req.user.id;
      const reviewId = req.params.reviewId;
      const replyId = req.params.replyId;
      
      // Kiểm tra quyền sở hữu
      const ownershipCheck = await sequelize.query(`
        SELECT rr.id
        FROM review_replies rr
        INNER JOIN reviews r ON rr.review_id = r.id
        INNER JOIN fields f ON r.field_id = f.id
        WHERE rr.id = :replyId AND r.id = :reviewId AND f.owner_id = :userId
      `, {
        replacements: { replyId, reviewId, userId },
        type: sequelize.QueryTypes.SELECT
      });
      
      if (ownershipCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy phản hồi hoặc bạn không có quyền xóa'
        });
      }
      
      // Xóa phản hồi
      await ReviewReply.destroy({
        where: { id: replyId }
      });
      
      res.json({
        success: true,
        message: 'Phản hồi đã được xóa thành công'
      });
    } catch (error) {
      console.error('Error in deleteReply:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa phản hồi',
        error: error.message
      });
    }
  },

  // GET /api/revenue/owner-bookings
  getOwnerBookings: async (req, res) => {
    try {
      const userId = req.user.id;
      const { 
        page = 1, 
        limit = 10, 
        status, 
        startDate, 
        endDate, 
        search, 
        sortBy = 'booking_date', 
        sortOrder = 'desc' 
      } = req.query;

      const offset = (page - 1) * limit;
      let whereClause = '';
      let searchClause = '';
      let statusClause = '';
      let dateClause = '';

      // Owner filter - chỉ lấy booking của các field thuộc owner
      const ownerClause = `
        AND EXISTS (
          SELECT 1 FROM fields f 
          WHERE f.id = s.field_id 
          AND f.owner_id = :userId
        )
      `;

      // Status filter
      if (status && status !== 'all') {
        statusClause = `AND b.status = :status`;
      }

      // Date range filter
      if (startDate && endDate) {
        dateClause = `AND b.booking_date BETWEEN :startDate AND :endDate`;
      }

      // Search filter
      if (search) {
        searchClause = `
          AND (
            b.booking_metadata->>'customerName' ILIKE :search OR
            b.booking_metadata->>'customerEmail' ILIKE :search OR
            b.booking_metadata->>'customerPhone' ILIKE :search OR
            f.name ILIKE :search
          )
        `;
      }

      whereClause = `WHERE 1=1 ${ownerClause} ${statusClause} ${dateClause} ${searchClause}`;

      // Get bookings with pagination
      const bookingsQuery = `
        SELECT 
          b.id,
          b.booking_date,
          b.status,
          b.total_price,
          b.payment_status,
          b.payment_method,
          b.created_at,
          b.booking_metadata,
          b.user_id,
          f.name as field_name,
          f.location_id,
          l.address_text as location_address,
          l.city,
          l.district,
          u.name as user_name,
          u.email as user_email,
          u.phone as user_phone,
          r.rating,
          r.comment as review_comment
        FROM bookings b
        INNER JOIN timeslots ts ON b.id = ts.booking_id
        INNER JOIN subfields s ON ts.sub_field_id = s.id
        INNER JOIN fields f ON s.field_id = f.id
        LEFT JOIN locations l ON f.location_id = l.id
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN reviews r ON r.field_id = f.id AND r.user_id = b.user_id
        ${whereClause}
        GROUP BY b.id, f.id, l.id, u.id, r.rating, r.comment
        ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
        LIMIT :limit OFFSET :offset
      `;

      // Get timeslots separately to avoid JSON issues
      const timeslotsQuery = `
        SELECT 
          b.id as booking_id,
          ts.id as timeslot_id,
          ts.start_time,
          ts.end_time,
          ts.date,
          ts.sub_field_id,
          s.name as sub_field_name,
          s.field_type as sub_field_type
        FROM bookings b
        INNER JOIN timeslots ts ON b.id = ts.booking_id
        INNER JOIN subfields s ON ts.sub_field_id = s.id
        INNER JOIN fields f ON s.field_id = f.id
        ${whereClause}
        ORDER BY ts.start_time
      `;

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT b.id) as total
        FROM bookings b
        INNER JOIN timeslots ts ON b.id = ts.booking_id
        INNER JOIN subfields s ON ts.sub_field_id = s.id
        INNER JOIN fields f ON s.field_id = f.id
        LEFT JOIN locations l ON f.location_id = l.id
        ${whereClause}
      `;

      const replacements = {
        userId,
        limit: parseInt(limit),
        offset: parseInt(offset),
        ...(status && status !== 'all' && { status }),
        ...(startDate && endDate && { startDate, endDate }),
        ...(search && { search: `%${search}%` })
      };

      const [bookings, timeslots, countResult] = await Promise.all([
        sequelize.query(bookingsQuery, {
          replacements,
          type: sequelize.QueryTypes.SELECT
        }),
        sequelize.query(timeslotsQuery, {
          replacements,
          type: sequelize.QueryTypes.SELECT
        }),
        sequelize.query(countQuery, {
          replacements,
          type: sequelize.QueryTypes.SELECT
        })
      ]);

      // Group timeslots by booking_id
      const timeslotsByBooking = {};
      timeslots.forEach(ts => {
        if (!timeslotsByBooking[ts.booking_id]) {
          timeslotsByBooking[ts.booking_id] = [];
        }
        timeslotsByBooking[ts.booking_id].push({
          id: ts.timeslot_id,
          start_time: ts.start_time,
          end_time: ts.end_time,
          date: ts.date,
          sub_field_id: ts.sub_field_id,
          sub_field_name: ts.sub_field_name,
          sub_field_type: ts.sub_field_type
        });
      });

      const total = parseInt(countResult[0].total);
      const totalPages = Math.ceil(total / limit);

      // Transform bookings for frontend
      const transformedBookings = bookings.map(booking => {
        // Get timeslots for this booking
        const bookingTimeslots = timeslotsByBooking[booking.id] || [];
        
        // Get customer info from user table or booking metadata
        const customerInfo = {
          name: booking.user_name || booking.booking_metadata?.customerName || 'Khách vãng lai',
          email: booking.user_email || booking.booking_metadata?.customerEmail || '',
          phone: booking.user_phone || booking.booking_metadata?.customerPhone || ''
        };

        // Get payment method info
        const paymentMethodMap = {
          'credit_card': 'Thẻ tín dụng',
          'stripe': 'Stripe',
          'cash': 'Tiền mặt',
          'bank_transfer': 'Chuyển khoản ngân hàng',
          'online': 'Thanh toán online'
        };

        const paymentMethod = paymentMethodMap[booking.payment_method] || booking.payment_method || 'Chuyển khoản';

        // Process sub-fields used
        const subFieldsUsed = bookingTimeslots.map(slot => ({
          id: slot.sub_field_id,
          name: slot.sub_field_name,
          type: slot.sub_field_type,
          timeSlot: `${slot.start_time} - ${slot.end_time}`
        }));

        return {
          ...booking,
          customer_info: customerInfo,
          field_info: {
            id: booking.field_id,
            name: booking.field_name,
            type: subFieldsUsed.length > 0 ? subFieldsUsed[0].type : 'Không xác định',
            subFields: subFieldsUsed, // Array of sub-fields used
            location: `${booking.location_address}, ${booking.district}, ${booking.city}`
          },
          payment_method: paymentMethod,
          timeSlots: bookingTimeslots,
          review_rating: booking.rating,
          review_comment: booking.review_comment
        };
      });

      // Get stats
      const stats = await revenueController.getOwnerBookingStats(userId);

      res.json({
        success: true,
        data: {
          bookings: transformedBookings,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages,
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1
          },
          stats
        },
        message: 'Dữ liệu booking owner đã được tải thành công'
      });
    } catch (error) {
      console.error('Error in getOwnerBookings:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải dữ liệu booking owner',
        error: error.message
      });
    }
  },

  // GET /api/revenue/owner-booking-stats
  getOwnerBookingStats: async (userId) => {
    try {
      const ownerStatsQuery = `
        SELECT 
          COUNT(DISTINCT b.id) as total_bookings,
          COUNT(DISTINCT CASE WHEN b.status = 'confirmed' THEN b.id END) as confirmed_bookings,
          COUNT(DISTINCT CASE WHEN b.payment_status = 'refunded' THEN b.id END) as refund_bookings,
          COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_bookings,
          COUNT(DISTINCT CASE WHEN b.status = 'cancelled' THEN b.id END) as cancelled_bookings,
          COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_price END), 0) as total_revenue,
          COALESCE(AVG(r.rating), 0) as average_rating,
          COUNT(DISTINCT f.id) as total_fields
        FROM bookings b
        INNER JOIN timeslots ts ON b.id = ts.booking_id
        INNER JOIN subfields s ON ts.sub_field_id = s.id
        INNER JOIN fields f ON s.field_id = f.id
        LEFT JOIN reviews r ON r.field_id = f.id
        WHERE f.owner_id = :userId
      `;

      const [stats] = await sequelize.query(ownerStatsQuery, {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      });

      return {
        totalBookings: parseInt(stats.total_bookings) || 0,
        confirmedBookings: parseInt(stats.confirmed_bookings) || 0,
        refundBookings: parseInt(stats.refund_bookings) || 0,
        completedBookings: parseInt(stats.completed_bookings) || 0,
        cancelledBookings: parseInt(stats.cancelled_bookings) || 0,
        totalRevenue: parseFloat(stats.total_revenue) || 0,
        averageRating: parseFloat(stats.average_rating) || 0,
        totalFields: parseInt(stats.total_fields) || 0
      };
    } catch (error) {
      console.error('Error in getOwnerBookingStats:', error);
      throw error;
    }
  },

  // Endpoint wrapper for getOwnerBookingStats
  getOwnerBookingStatsEndpoint: async (req, res) => {
    try {
      const userId = req.user.id;
      const stats = await revenueController.getOwnerBookingStats(userId);
      
      res.json({
        success: true,
        data: stats,
        message: 'Thống kê booking owner đã được tải thành công'
      });
    } catch (error) {
      console.error('Error in getOwnerBookingStatsEndpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải thống kê booking owner',
        error: error.message
      });
    }
  },

  // ...existing code...
};

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) {
    return `${minutes} phút trước`;
  } else if (hours < 24) {
    return `${hours} giờ trước`;
  } else if (days < 7) {
    return `${days} ngày trước`;
  } else {
    return new Date(date).toLocaleDateString('vi-VN');
  }
}

module.exports = revenueController;
