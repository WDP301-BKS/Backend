const nodemailer = require('nodemailer');
require('dotenv').config();

// Cấu hình transporter cho Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail', // Sử dụng Gmail làm dịch vụ gửi email
  auth: {
    user: process.env.EMAIL_USER, // Email người gửi (nên được cấu hình trong file .env)
    pass: process.env.EMAIL_PASS // Mật khẩu ứng dụng Gmail (nên được cấu hình trong file .env)
  }
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

module.exports = {
  sendEmail,
  sendRegistrationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail
}; 