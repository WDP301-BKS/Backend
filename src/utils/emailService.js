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

// Kiểm tra kết nối khi khởi động
(async function verifyEmailConnection() {
  try {
    await transporter.verify();
    console.log('Email service is ready to send emails');
  } catch (error) {
    console.error('Email service configuration error:', error);
  }
})();

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
  const subject = 'Xác nhận đặt sân bóng đá';
  const text = `Xin chào ${username},\n\nĐơn đặt sân của bạn đã được xác nhận với các thông tin sau:\n\nSân: ${bookingDetails.fieldName}\nNgày: ${bookingDetails.date}\nThời gian: ${bookingDetails.startTime} - ${bookingDetails.endTime}\nTổng tiền: ${bookingDetails.totalAmount}\n\nCảm ơn bạn đã sử dụng dịch vụ của chúng tôi.\n\nTrân trọng,\nĐội ngũ hỗ trợ Football Field Booking`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Xác nhận đặt sân bóng đá</h2>
      <p>Xin chào <strong>${username}</strong>,</p>
      <p>Đơn đặt sân của bạn đã được xác nhận với các thông tin sau:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f2f2f2;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Thông tin</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Chi tiết</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">Sân</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingDetails.fieldName}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">Ngày</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingDetails.date}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">Thời gian</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingDetails.startTime} - ${bookingDetails.endTime}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">Tổng tiền</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingDetails.totalAmount}</td>
        </tr>
      </table>
      <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.</p>
      <p>Trân trọng,<br>Đội ngũ hỗ trợ Football Field Booking</p>
    </div>
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
  const subject = 'Thông báo có đặt sân mới';
  const text = `Xin chào ${ownerName},\n\nBạn có một đơn đặt sân mới với các thông tin sau:\n\nSân: ${bookingDetails.fieldName}\nKhách hàng: ${bookingDetails.customerName}\nSố điện thoại: ${bookingDetails.customerPhone}\nNgày: ${bookingDetails.date}\nThời gian: ${bookingDetails.startTime} - ${bookingDetails.endTime}\nTổng tiền: ${bookingDetails.totalAmount}\n\nVui lòng chuẩn bị sân cho khách hàng.\n\nTrân trọng,\nHệ thống Football Field Booking`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2196F3;">Thông báo đặt sân mới</h2>
      <p>Xin chào <strong>${ownerName}</strong>,</p>
      <p>Bạn có một đơn đặt sân mới với các thông tin sau:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f2f2f2;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Thông tin</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Chi tiết</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">Sân</td>
          <td style="border: 1px solid #ddd; padding: 8px;"><strong>${bookingDetails.fieldName}</strong></td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">Khách hàng</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingDetails.customerName}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">Số điện thoại</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingDetails.customerPhone}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">Email</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingDetails.customerEmail}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">Ngày</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingDetails.date}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">Thời gian</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${bookingDetails.startTime} - ${bookingDetails.endTime}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">Tổng tiền</td>
          <td style="border: 1px solid #ddd; padding: 8px;"><strong style="color: #4CAF50;">${bookingDetails.totalAmount}</strong></td>
        </tr>
      </table>
      <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0; color: #2e7d32;"><strong>Lưu ý:</strong> Vui lòng chuẩn bị sân cho khách hàng đúng giờ đã đặt.</p>
      </div>
      <p>Trân trọng,<br>Hệ thống Football Field Booking</p>
    </div>
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