const nodemailer = require('nodemailer');
require('dotenv').config();

// Cấu hình transporter cho Nodemailer
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail', // Sử dụng từ biến môi trường
  auth: {
    user: process.env.EMAIL_USER, // Email người gửi
    pass: process.env.EMAIL_PASS  // Mật khẩu ứng dụng Gmail
  },
  // Thêm tùy chọn tránh lỗi xác thực PLAIN
  secure: true, // Sử dụng SSL
  tls: {
    rejectUnauthorized: false
  }
});

// Kiểm tra kết nối khi khởi động (không đồng bộ)
transporter.verify()
  .then(() => {
    console.log('Email service is ready to send emails');
  })
  .catch((error) => {
    console.error('Email service configuration error:', error);
  });

/**
 * Gửi email
 * @param {string} to - Địa chỉ email người nhận
 * @param {string} subject - Tiêu đề email
 * @param {string} text - Nội dung email dạng văn bản thuần
 * @param {string} html - Nội dung email dạng HTML (tùy chọn)
 * @returns {Promise} - Promise chứa kết quả gửi email
 */
const sendEmail = async (to, subject, text, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html: html || text // Nếu không có HTML thì sử dụng text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Gửi email xác nhận đăng ký
 * @param {string} to - Email người nhận
 * @param {string} username - Tên người dùng
 * @param {string} confirmationLink - Đường dẫn xác nhận
 * @returns {Promise} - Promise chứa kết quả gửi email
 */
const sendRegistrationEmail = async (to, username, confirmationLink) => {
  const subject = 'Xác nhận đăng ký tài khoản';
  const text = `Xin chào ${username},\n\nCảm ơn bạn đã đăng ký tài khoản. Vui lòng click vào đường dẫn sau để xác nhận tài khoản của bạn: ${confirmationLink}\n\nTrân trọng,\nĐội ngũ hỗ trợ Football Field Booking`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Xác nhận đăng ký tài khoản</h2>
      <p>Xin chào <strong>${username}</strong>,</p>
      <p>Cảm ơn bạn đã đăng ký tài khoản trên hệ thống Football Field Booking.</p>
      <p>Vui lòng click vào nút bên dưới để xác nhận tài khoản của bạn:</p>
      <p>
        <a href="${confirmationLink}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          Xác nhận tài khoản
        </a>
      </p>
      <p>Hoặc bạn có thể copy và paste đường dẫn sau vào trình duyệt:</p>
      <p>${confirmationLink}</p>
      <p>Trân trọng,<br>Đội ngũ hỗ trợ Football Field Booking</p>
    </div>
  `;

  return sendEmail(to, subject, text, html);
};

/**
 * Gửi email đặt lại mật khẩu
 * @param {string} to - Email người nhận
 * @param {string} username - Tên người dùng
 * @param {string} resetLink - Đường dẫn đặt lại mật khẩu
 * @returns {Promise} - Promise chứa kết quả gửi email
 */
const sendPasswordResetEmail = async (to, username, resetLink) => {
  const subject = 'Đặt lại mật khẩu';
  const text = `Xin chào ${username},\n\nBạn đã yêu cầu đặt lại mật khẩu. Vui lòng click vào đường dẫn sau để đặt lại mật khẩu của bạn: ${resetLink}\n\nĐường dẫn này sẽ hết hạn sau 1 giờ.\n\nNếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.\n\nTrân trọng,\nĐội ngũ hỗ trợ Football Field Booking`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Đặt lại mật khẩu</h2>
      <p>Xin chào <strong>${username}</strong>,</p>
      <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình.</p>
      <p>Vui lòng click vào nút bên dưới để đặt lại mật khẩu:</p>
      <p>
        <a href="${resetLink}" style="display: inline-block; background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          Đặt lại mật khẩu
        </a>
      </p>
      <p>Hoặc bạn có thể copy và paste đường dẫn sau vào trình duyệt:</p>
      <p>${resetLink}</p>
      <p>Đường dẫn này sẽ hết hạn sau 1 giờ.</p>
      <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
      <p>Trân trọng,<br>Đội ngũ hỗ trợ Football Field Booking</p>
    </div>
  `;

  return sendEmail(to, subject, text, html);
};

/**
 * Gửi email xác nhận đặt sân
 * @param {string} to - Email người nhận
 * @param {string} username - Tên người dùng
 * @param {Object} bookingDetails - Chi tiết đơn đặt sân
 * @returns {Promise} - Promise chứa kết quả gửi email
 */
const sendBookingConfirmationEmail = async (to, username, bookingDetails) => {
  const subject = '🎉 Đặt sân thành công - Xác nhận booking của bạn';
  
  // Format date and time
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  };

  // Extract booking information with better fallback
  const bookingId = bookingDetails.id || 'N/A';
  const fieldName = bookingDetails.fieldName || bookingDetails.field?.name || 'Sân bóng';
  const bookingDate = formatDate(bookingDetails.date || bookingDetails.bookingDate);
  const totalAmount = formatCurrency(bookingDetails.totalAmount);
  
  // Get field location with multiple fallback options
  const fieldLocation = bookingDetails.field?.location || bookingDetails.fieldLocation || {};
  const fieldAddress = bookingDetails.fieldAddress || bookingDetails.address || fieldLocation.formatted_address;
  
  // Build full address with priority for fieldAddress, then construct from components
  let fullAddress = '';
  if (fieldAddress) {
    fullAddress = fieldAddress;
  } else {
    const addressComponents = [
      fieldLocation.address_text || fieldLocation.address || fieldLocation.street_address,
      fieldLocation.ward || fieldLocation.ward_name,
      fieldLocation.district || fieldLocation.district_name,
      fieldLocation.city || fieldLocation.city_name || fieldLocation.province
    ].filter(Boolean);
    
    if (addressComponents.length > 0) {
      fullAddress = addressComponents.join(', ');
    } else {
      fullAddress = 'Chưa có thông tin địa chỉ';
    }
  }

  // Handle multiple time slots from different subfields
  const timeSlots = bookingDetails.timeSlots || [];
  let timeSlotsText = '';
  let timeSlotsHtml = '';
  
  if (timeSlots.length > 0) {
    timeSlotsText = timeSlots.map(slot => 
      `${slot.startTime || slot.start_time} - ${slot.endTime || slot.end_time}`
    ).join(', ');
    
    timeSlotsHtml = timeSlots.map(slot => `
      <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 10px; margin: 5px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
          <span style="font-weight: 600; color: #0369a1;">⏰ ${slot.startTime || slot.start_time} - ${slot.endTime || slot.end_time}</span>
          <span style="color: #64748b; font-size: 14px;">Sân ${slot.subfield?.name || 'N/A'}</span>
        </div>
      </div>
    `).join('');
  } else {
    timeSlotsText = 'Chưa có thông tin thời gian';
    timeSlotsHtml = '<div style="color: #64748b;">Chưa có thông tin thời gian</div>';
  }

  const text = `🎉 ĐẶT SÂN THÀNH CÔNG!

Xin chào ${username},

Chúc mừng! Đơn đặt sân của bạn đã được xác nhận thành công.

📋 THÔNG TIN ĐẶT SÂN:
- Mã đặt sân: ${bookingId}
- Sân bóng: ${fieldName}
- Địa chỉ: ${fullAddress}
- Ngày đá bóng: ${bookingDate}
- Khung giờ đã đặt: ${timeSlotsText}
- Tổng tiền: ${totalAmount}

✅ Trạng thái: Đã thanh toán thành công
📞 Liên hệ hỗ trợ: support@footballbooking.com

Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của chúng tôi!

Trân trọng,
Đội ngũ Football Field Booking`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Đặt sân thành công</title>
        <style>
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; margin: 0 !important; }
            .header { padding: 20px 15px !important; }
            .content { padding: 20px 15px !important; }
            .steps { display: none !important; }
            .booking-detail { padding: 15px !important; }
            .flex-row { flex-direction: column !important; gap: 10px !important; }
            .btn { display: block !important; margin: 5px 0 !important; }
          }
        </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa; line-height: 1.6;">
        <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div class="header" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px 20px; text-align: center; color: white;">
                <div style="background-color: rgba(255,255,255,0.2); border-radius: 50%; width: 60px; height: 60px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 30px;">⚽</span>
                </div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Đặt sân thành công!</h1>
                <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Cảm ơn bạn đã sử dụng dịch vụ</p>
            </div>

            <!-- Success Steps (Hidden on mobile) -->
            <div class="steps" style="padding: 20px; background-color: #f8f9fa; border-bottom: 2px solid #22c55e;">
                <div style="display: flex; justify-content: space-between; align-items: center; max-width: 350px; margin: 0 auto;">
                    <div style="text-align: center; flex: 1;">
                        <div style="width: 30px; height: 30px; background-color: #22c55e; border-radius: 50%; margin: 0 auto 5px; display: flex; align-items: center; justify-content: center;">
                            <span style="color: white; font-size: 14px;">✓</span>
                        </div>
                        <span style="font-size: 10px; color: #6b7280;">Chọn sân</span>
                    </div>
                    <div style="flex: 1; height: 1px; background-color: #22c55e; margin: 0 5px;"></div>
                    <div style="text-align: center; flex: 1;">
                        <div style="width: 30px; height: 30px; background-color: #22c55e; border-radius: 50%; margin: 0 auto 5px; display: flex; align-items: center; justify-content: center;">
                            <span style="color: white; font-size: 14px;">✓</span>
                        </div>
                        <span style="font-size: 10px; color: #6b7280;">Thanh toán</span>
                    </div>
                    <div style="flex: 1; height: 1px; background-color: #22c55e; margin: 0 5px;"></div>
                    <div style="text-align: center; flex: 1;">
                        <div style="width: 30px; height: 30px; background-color: #22c55e; border-radius: 50%; margin: 0 auto 5px; display: flex; align-items: center; justify-content: center;">
                            <span style="color: white; font-size: 14px;">✓</span>
                        </div>
                        <span style="font-size: 10px; color: #6b7280;">Hoàn thành</span>
                    </div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="content" style="padding: 25px 20px;">
                <h2 style="color: #1f2937; margin: 0 0 8px 0; font-size: 20px;">Xin chào <strong style="color: #22c55e;">${username}</strong>,</h2>
                <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 14px;">
                    Chúc mừng! Đơn đặt sân của bạn đã được xác nhận thành công.
                </p>

                <!-- Booking ID Badge -->
                <div style="background: linear-gradient(90deg, #22c55e, #16a34a); padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                    <p style="color: rgba(255,255,255,0.8); margin: 0 0 3px 0; font-size: 12px;">Mã đặt sân:</p>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: 700;">${bookingId}</p>
                </div>

                <!-- Booking Details -->
                <div class="booking-detail" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">📋 Chi tiết đặt sân</h3>
                    
                    <!-- Field Info -->
                    <div style="margin-bottom: 12px;">
                        <div style="color: #6b7280; font-size: 13px; margin-bottom: 3px;">🏟️ Sân bóng:</div>
                        <div style="color: #1f2937; font-weight: 600; font-size: 15px;">${fieldName}</div>
                    </div>
                    
                    <!-- Address -->
                    <div style="margin-bottom: 12px;">
                        <div style="color: #6b7280; font-size: 13px; margin-bottom: 3px;">📍 Địa chỉ:</div>
                        <div style="color: #1f2937; font-size: 14px; line-height: 1.4;">${fullAddress}</div>
                    </div>
                    
                    <!-- Date -->
                    <div style="margin-bottom: 12px;">
                        <div style="color: #6b7280; font-size: 13px; margin-bottom: 3px;">📅 Ngày:</div>
                        <div style="color: #1f2937; font-weight: 600;">${bookingDate}</div>
                    </div>
                    
                    <!-- Time Slots -->
                    <div style="margin-bottom: 15px;">
                        <div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">⏰ Khung giờ đã đặt:</div>
                        ${timeSlotsHtml}
                    </div>
                    
                    <!-- Total Amount -->
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 12px;">
                        <div class="flex-row" style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #6b7280; font-weight: 500; font-size: 14px;">💰 Tổng tiền:</span>
                            <strong style="color: #22c55e; font-size: 18px; font-weight: 700;">${totalAmount}</strong>
                        </div>
                    </div>
                </div>

                <!-- Payment Status -->
                <div style="background-color: #dcfce7; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center;">
                        <div style="background-color: #22c55e; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; margin-right: 10px; flex-shrink: 0;">
                            <span style="color: white; font-size: 12px;">✓</span>
                        </div>
                        <div>
                            <p style="margin: 0; color: #166534; font-weight: 600; font-size: 14px;">Thanh toán thành công!</p>
                            <p style="margin: 2px 0 0 0; color: #16a34a; font-size: 12px;">Cảm ơn bạn đã sử dụng dịch vụ</p>
                        </div>
                    </div>
                </div>

                <!-- Important Notes -->
                <div style="background-color: #fef3c7; border: 1px solid #fed7aa; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <h4 style="color: #92400e; margin: 0 0 10px 0; font-size: 14px;">⚠️ Lưu ý quan trọng:</h4>
                    <ul style="color: #92400e; margin: 0; padding-left: 15px; font-size: 13px; line-height: 1.5;">
                        <li>Có mặt tại sân đúng giờ đã đặt</li>
                        <li>Mang theo giấy tờ tùy thân</li>
                        <li>Hotline: 0124-456-789</li>
                    </ul>
                </div>

                <!-- Support Contact -->
                <div style="text-align: center; padding: 15px; background-color: #f1f5f9; border-radius: 8px;">
                    <h4 style="color: #1f2937; margin: 0 0 10px 0; font-size: 14px;">📞 Cần hỗ trợ?</h4>
                    <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                        <a href="tel:0124456789" class="btn" style="background-color: #3b82f6; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500;">📞 Hotline</a>
                        <a href="mailto:support@footballbooking.com" class="btn" style="background-color: #6b7280; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500;">📧 Email</a>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1f2937; padding: 20px; text-align: center;">
                <h3 style="color: #22c55e; margin: 0 0 5px 0; font-size: 16px;">⚽ Football Field Booking</h3>
                <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 12px;">Nền tảng đặt sân bóng đá hàng đầu</p>
                <div style="border-top: 1px solid #374151; padding-top: 10px; margin-top: 10px;">
                    <p style="color: #6b7280; margin: 0; font-size: 11px;">
                        © 2025 Football Field Booking. Email tự động, vui lòng không trả lời.
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;

  return sendEmail(to, subject, text, html);
};

/**
 * Gửi email thông báo cho chủ sân về booking mới
 * @param {string} to - Email chủ sân
 * @param {string} ownerName - Tên chủ sân
 * @param {Object} bookingDetails - Chi tiết đơn đặt sân
 * @returns {Promise} - Promise chứa kết quả gửi email
 */
const sendOwnerBookingNotificationEmail = async (to, ownerName, bookingDetails) => {
  const subject = '🔔 Thông báo đặt sân mới - Có khách hàng mới đặt sân!';
  
  // Format helper functions
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  };

  const bookingId = bookingDetails.id || 'N/A';
  const fieldName = bookingDetails.fieldName || bookingDetails.field?.name || 'Sân bóng';
  
  // Extract customer info from customerInfo object or fallback to direct properties
  const customerInfo = bookingDetails.customerInfo || {};
  const customerName = customerInfo.name || bookingDetails.customerName || 'Khách hàng';
  const customerPhone = customerInfo.phone || bookingDetails.customerPhone || 'Chưa cung cấp';
  const customerEmail = customerInfo.email || bookingDetails.customerEmail || 'Chưa cung cấp';
  
  const bookingDate = formatDate(bookingDetails.date || bookingDetails.bookingDate);
  const startTime = bookingDetails.startTime || '00:00';
  const endTime = bookingDetails.endTime || '00:00';
  const totalAmount = formatCurrency(bookingDetails.totalAmount);
  
  // Get field location with multiple fallback options (same as customer email)
  const fieldLocation = bookingDetails.field?.location || bookingDetails.fieldLocation || {};
  const fieldAddress = bookingDetails.fieldAddress || bookingDetails.address || fieldLocation.formatted_address;
  
  // Build full address with priority for fieldAddress, then construct from components
  let fullAddress = '';
  if (fieldAddress) {
    fullAddress = fieldAddress;
  } else {
    const addressComponents = [
      fieldLocation.address_text || fieldLocation.address || fieldLocation.street_address,
      fieldLocation.ward || fieldLocation.ward_name,
      fieldLocation.district || fieldLocation.district_name,
      fieldLocation.city || fieldLocation.city_name || fieldLocation.province
    ].filter(Boolean);
    
    if (addressComponents.length > 0) {
      fullAddress = addressComponents.join(', ');
    } else {
      fullAddress = 'Chưa có thông tin địa chỉ';
    }
  }

  // Handle multiple time slots from different subfields for owner email too
  const timeSlots = bookingDetails.timeSlots || [];
  let timeSlotsText = '';
  let timeSlotsHtml = '';
  
  if (timeSlots.length > 0) {
    timeSlotsText = timeSlots.map(slot => 
      `${slot.startTime || slot.start_time} - ${slot.endTime || slot.end_time} (Sân ${slot.subfield?.name || 'N/A'})`
    ).join(', ');
    
    timeSlotsHtml = timeSlots.map(slot => `
      <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 10px; margin: 5px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
          <span style="font-weight: 600; color: #0369a1;">⏰ ${slot.startTime || slot.start_time} - ${slot.endTime || slot.end_time}</span>
          <span style="color: #64748b; font-size: 14px;">Sân ${slot.subfield?.name || 'N/A'}</span>
        </div>
      </div>
    `).join('');
  } else {
    // Fallback to single time slot
    timeSlotsText = `${startTime} - ${endTime}`;
    timeSlotsHtml = `
      <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 10px; margin: 5px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
          <span style="font-weight: 600; color: #0369a1;">⏰ ${startTime} - ${endTime}</span>
          <span style="color: #64748b; font-size: 14px;">Sân chính</span>
        </div>
      </div>
    `;
  }

  const text = `🔔 THÔNG BÁO ĐẶT SÂN MỚI!

Xin chào ${ownerName},

Bạn có một đơn đặt sân mới cần được xác nhận và chuẩn bị.

📋 THÔNG TIN ĐẶT SÂN:
- Mã booking: ${bookingId}
- Sân: ${fieldName}
- Địa chỉ: ${fullAddress}
- Khách hàng: ${customerName}
- Số điện thoại: ${customerPhone}
- Email: ${customerEmail}
- Ngày đá bóng: ${bookingDate}
- Khung giờ: ${timeSlotsText}
- Tổng tiền: ${totalAmount}
- Thời gian: ${startTime} - ${endTime}
- Tổng tiền: ${totalAmount}

✅ Trạng thái: Đã thanh toán thành công
⚠️ Lưu ý: Vui lòng chuẩn bị sân cho khách hàng đúng giờ đã đặt.

Trân trọng,
Hệ thống Football Field Booking`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thông báo đặt sân mới</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px 20px; text-align: center;">
                <div style="background-color: rgba(255,255,255,0.2); border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 40px;">🔔</span>
                </div>
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Đặt sân mới!</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Bạn có khách hàng mới đặt sân</p>
            </div>

            <!-- Notification Badge -->
            <div style="background: linear-gradient(90deg, #ef4444, #dc2626); color: white; text-align: center; padding: 15px; font-weight: 600;">
                <span style="font-size: 16px;">🚨 KHẨN CẤP - CẦN XỬ LÝ NGAY</span>
            </div>

            <!-- Main Content -->
            <div style="padding: 30px 20px;">
                <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px;">Xin chào <strong style="color: #3b82f6;">${ownerName}</strong>,</h2>
                <p style="color: #6b7280; margin: 0 0 30px 0; font-size: 16px; line-height: 1.5;">
                    Bạn có một đơn đặt sân mới đã được thanh toán thành công. Vui lòng xem thông tin chi tiết và chuẩn bị sân cho khách hàng.
                </p>

                <!-- Booking ID Badge -->
                <div style="background: linear-gradient(90deg, #3b82f6, #1d4ed8); padding: 15px; border-radius: 12px; margin-bottom: 25px; text-align: center;">
                    <p style="color: rgba(255,255,255,0.8); margin: 0 0 5px 0; font-size: 14px;">Mã đặt sân:</p>
                    <p style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 1px;">${bookingId}</p>
                </div>

                <!-- Customer Info -->
                <div style="background-color: #f1f5f9; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                    <h3 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px; display: flex; align-items: center;">
                        <span style="margin-right: 10px;">👤</span> Thông tin khách hàng
                    </h3>
                    
                    <div style="space-y: 15px;">
                        <!-- Customer Name -->
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                            <span style="color: #6b7280; font-weight: 500;">👤 Tên khách hàng:</span>
                            <strong style="color: #1f2937; font-size: 16px;">${customerName}</strong>
                        </div>
                        
                        <!-- Phone -->
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                            <span style="color: #6b7280; font-weight: 500;">📞 Số điện thoại:</span>
                            <strong style="color: #1f2937;"><a href="tel:${customerPhone}" style="color: #3b82f6; text-decoration: none;">${customerPhone}</a></strong>
                        </div>
                        
                        <!-- Email -->
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
                            <span style="color: #6b7280; font-weight: 500;">📧 Email:</span>
                            <strong style="color: #1f2937;"><a href="mailto:${customerEmail}" style="color: #3b82f6; text-decoration: none;">${customerEmail}</a></strong>
                        </div>
                    </div>
                </div>

                <!-- Booking Details -->
                <div style="background-color: #f8f9fa; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                    <h3 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px; display: flex; align-items: center;">
                        <span style="margin-right: 10px;">📋</span> Chi tiết đặt sân
                    </h3>
                    
                    <div style="space-y: 15px;">
                        <!-- Field Info -->
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                            <span style="color: #6b7280; font-weight: 500;">🏟️ Sân bóng:</span>
                            <strong style="color: #1f2937; font-size: 16px;">${fieldName}</strong>
                        </div>
                        
                        <!-- Address -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                            <span style="color: #6b7280; font-weight: 500;">� Địa chỉ:</span>
                            <div style="color: #1f2937; font-size: 14px; line-height: 1.4; text-align: right; max-width: 60%;">${fullAddress}</div>
                        </div>
                        
                        <!-- Date -->
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                            <span style="color: #6b7280; font-weight: 500;">📅 Ngày:</span>
                            <strong style="color: #1f2937;">${bookingDate}</strong>
                        </div>
                        
                        <!-- Time Slots -->
                        <div style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                            <div style="color: #6b7280; font-weight: 500; margin-bottom: 8px;">⏰ Khung giờ đã đặt:</div>
                            ${timeSlotsHtml}
                        </div>
                        
                        <!-- Total Amount -->
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 0;">
                            <span style="color: #6b7280; font-weight: 500; font-size: 16px;">💰 Tổng tiền:</span>
                            <strong style="color: #22c55e; font-size: 20px; font-weight: 700;">${totalAmount}</strong>
                        </div>
                    </div>
                </div>

                <!-- Payment Status -->
                <div style="background-color: #dcfce7; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                    <div style="display: flex; align-items: center;">
                        <div style="background-color: #22c55e; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                            <span style="color: white; font-size: 14px;">✓</span>
                        </div>
                        <div>
                            <p style="margin: 0; color: #166534; font-weight: 600; font-size: 16px;">Khách hàng đã thanh toán thành công!</p>
                            <p style="margin: 5px 0 0 0; color: #16a34a; font-size: 14px;">Số tiền đã được chuyển vào tài khoản của bạn</p>
                        </div>
                    </div>
                </div>

                <!-- Action Required -->
                <div style="background-color: #fef3c7; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                    <h4 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center;">
                        <span style="margin-right: 8px;">⚠️</span> Các việc cần làm:
                    </h4>
                    <ul style="color: #92400e; margin: 0; padding-left: 20px; line-height: 1.6;">
                        <li><strong>Chuẩn bị sân</strong> - Kiểm tra và dọn dẹp sân bóng</li>
                        <li><strong>Kiểm tra thiết bị</strong> - Đảm bảo lưới, cầu môn, bóng sẵn sàng</li>
                        <li><strong>Liên hệ khách hàng</strong> - Xác nhận lại thông tin nếu cần</li>
                        <li><strong>Có mặt đúng giờ</strong> - Đón khách hàng và hướng dẫn</li>
                    </ul>
                </div>

                <!-- Quick Actions -->
                <div style="text-align: center; padding: 20px; background-color: #f1f5f9; border-radius: 12px;">
                    <h4 style="color: #1f2937; margin: 0 0 15px 0;">🚀 Hành động nhanh</h4>
                    <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
                        <a href="tel:${customerPhone}" style="background-color: #22c55e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center;">
                            📞 Gọi khách hàng
                        </a>
                        <a href="mailto:${customerEmail}" style="background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center;">
                            📧 Gửi email
                        </a>
                        <a href="sms:${customerPhone}" style="background-color: #8b5cf6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center;">
                            💬 Nhắn tin
                        </a>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #1f2937; padding: 30px 20px; text-align: center;">
                <h3 style="color: #3b82f6; margin: 0 0 10px 0; font-size: 20px;">⚽ Football Field Booking</h3>
                <p style="color: #9ca3af; margin: 0 0 15px 0;">Hệ thống quản lý đặt sân chuyên nghiệp</p>
                <div style="border-top: 1px solid #374151; padding-top: 20px; margin-top: 20px;">
                    <p style="color: #6b7280; margin: 0; font-size: 14px;">
                        © 2025 Football Field Booking. Mọi quyền được bảo lưu.<br>
                        Đây là email thông báo tự động, vui lòng không trả lời.
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;

  return sendEmail(to, subject, text, html);
};

/**
 * Gửi email thông báo hủy booking do bảo trì
 */
const sendMaintenanceCancellationEmail = async (to, customerName, bookingDetails) => {
  // 🔍 DEBUG: Log email sending attempt
  console.log('📧 EMAIL SERVICE: sendMaintenanceCancellationEmail called');
  console.log('- To:', to);
  console.log('- Customer Name:', customerName);
  console.log('- Booking Details:', JSON.stringify(bookingDetails, null, 2));
  console.log('- Stack trace:', new Error().stack);
  
  const subject = 'Thông báo hủy đặt sân do bảo trì';
  
  // Support both single time slot (old format) and multiple time slots (new format)
  const timeSlots = bookingDetails.timeSlots || [{
    subField: 'N/A',
    fieldName: bookingDetails.fieldName,
    startTime: bookingDetails.startTime,
    endTime: bookingDetails.endTime,
    date: bookingDetails.bookingDate
  }];
  
  // Create text version
  let timeSlotText = '';
  if (timeSlots.length === 1) {
    timeSlotText = `- Thời gian: ${timeSlots[0].startTime} - ${timeSlots[0].endTime}`;
  } else {
    timeSlotText = `- Các khung giờ:\n${timeSlots.map(ts => `  + ${ts.startTime} - ${ts.endTime} (${ts.subField})`).join('\n')}`;
  }
  
  const text = `Xin chào ${customerName},\n\nChúng tôi rất tiếc phải thông báo rằng đặt sân của bạn đã bị hủy do sân cần bảo trì.\n\nThông tin đặt sân:\n- Sân: ${bookingDetails.fieldName}\n- Ngày: ${bookingDetails.bookingDate}\n${timeSlotText}\n- Lý do bảo trì: ${bookingDetails.maintenanceReason}\n\n${bookingDetails.willRefund ? `Thông tin hoàn tiền:\n- Tổng giá trị booking: ${bookingDetails.totalPrice ? bookingDetails.totalPrice.toLocaleString('vi-VN') : bookingDetails.refundAmount.toLocaleString('vi-VN')}đ\n- Số tiền hoàn lại: ${bookingDetails.refundAmount.toLocaleString('vi-VN')}đ (100%)\n- Thời gian hoàn tiền: 5-10 ngày làm việc` : 'Không có khoản phí nào được thu.'}\n\nChúng tôi xin lỗi vì sự bất tiện này.\n\nTrân trọng,\nĐội ngũ hỗ trợ Football Field Booking`;
  
  // Create HTML version with support for multiple time slots
  let timeSlotHtml = '';
  if (timeSlots.length === 1) {
    timeSlotHtml = `
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Thời gian:</td>
        <td style="padding: 8px 0; color: #111827; font-weight: 600;">${timeSlots[0].startTime} - ${timeSlots[0].endTime}</td>
      </tr>`;
  } else {
    timeSlotHtml = `
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Các khung giờ:</td>
        <td style="padding: 8px 0; color: #111827; font-weight: 600;">
          ${timeSlots.map(ts => `
            <div style="padding: 4px 0; border-left: 3px solid #dc2626; padding-left: 8px; margin: 2px 0;">
              <strong>${ts.startTime} - ${ts.endTime}</strong><br>
              <small style="color: #6b7280;">${ts.subField}</small>
            </div>
          `).join('')}
        </td>
      </tr>`;
  }
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #fee2e2; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
        <h2 style="color: #dc2626; margin: 0;">⚠️ Thông báo hủy đặt sân</h2>
      </div>
      
      <p>Xin chào <strong>${customerName}</strong>,</p>
      
      <p>Chúng tôi rất tiếc phải thông báo rằng đặt sân của bạn đã bị hủy do sân cần bảo trì khẩn cấp.</p>
      
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #374151; margin-top: 0;">📋 Thông tin đặt sân bị hủy:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Sân:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600;">${bookingDetails.fieldName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Ngày:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600;">${bookingDetails.bookingDate}</td>
          </tr>
          ${timeSlotHtml}
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Lý do bảo trì:</td>
            <td style="padding: 8px 0; color: #dc2626; font-weight: 600;">${bookingDetails.maintenanceReason}</td>
          </tr>
        </table>
      </div>
      
      ${bookingDetails.willRefund ? `
      <div style="background-color: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #16a34a; margin-top: 0;">💰 Thông tin hoàn tiền</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #15803d; font-weight: 500;">Tổng giá trị booking:</td>
            <td style="padding: 8px 0; color: #15803d; font-weight: 600;">${bookingDetails.totalPrice ? bookingDetails.totalPrice.toLocaleString('vi-VN') : bookingDetails.refundAmount.toLocaleString('vi-VN')}đ</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #15803d; font-weight: 500;">Số tiền hoàn lại:</td>
            <td style="padding: 8px 0; color: #15803d; font-weight: 600;">${bookingDetails.refundAmount.toLocaleString('vi-VN')}đ</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #15803d; font-weight: 500;">Tỷ lệ hoàn tiền:</td>
            <td style="padding: 8px 0; color: #15803d; font-weight: 600;">100%</td>
          </tr>
        </table>
        <p style="color: #15803d; margin: 10px 0 0 0;">
          Số tiền sẽ được hoàn về thẻ thanh toán của bạn trong vòng <strong>5-10 ngày làm việc</strong>.
        </p>
      </div>
      ` : ''}
      
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #92400e; margin: 0;">
          <strong>Xin lỗi vì sự bất tiện:</strong> Chúng tôi hiểu rằng việc hủy đặt sân có thể gây ra bất tiện cho bạn. 
          Để bù đắp, chúng tôi sẽ ưu tiên phục vụ bạn trong các lần đặt sân tiếp theo.
        </p>
      </div>
      
      <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.</p>
      
      <p>Trân trọng,<br>
      <strong>Đội ngũ hỗ trợ Football Field Booking</strong></p>
    </div>
  `;

  return sendEmail(to, subject, text, html);
};

module.exports = {
  sendEmail,
  sendRegistrationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendOwnerBookingNotificationEmail,
  sendMaintenanceCancellationEmail
};