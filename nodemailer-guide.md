# Hướng dẫn sử dụng Nodemailer trong dự án

## Cài đặt

Module Nodemailer đã được cài đặt trong dự án. Nếu bạn chưa cài đặt, sử dụng lệnh:

```bash
npm install nodemailer
```

## Cấu hình trong file .env

Bạn cần thêm những cấu hình sau vào file `.env` của dự án:

```
# Email configuration (Gmail)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000
```

**Lưu ý về EMAIL_PASS**: 
- Nếu bạn sử dụng Gmail, bạn cần tạo "App Password" thay vì sử dụng mật khẩu Gmail thông thường.
- Để tạo App Password: 
  1. Đi đến tài khoản Google của bạn
  2. Chọn "Security" (Bảo mật)
  3. Bật xác thực 2 bước (2-Step Verification) nếu chưa bật
  4. Sau đó, tìm "App passwords" (Mật khẩu ứng dụng)
  5. Tạo một mật khẩu mới cho ứng dụng

## Cách sử dụng module emailService

Module `emailService.js` đã được tạo trong thư mục `src/utils/` và cung cấp các hàm sau:

### 1. Gửi email cơ bản

```javascript
const { sendEmail } = require('../utils/emailService');

// Sử dụng trong controller hoặc service
try {
  await sendEmail(
    'recipient@example.com',
    'Tiêu đề email',
    'Nội dung email dạng văn bản',
    '<p>Nội dung email dạng HTML (tùy chọn)</p>'
  );
  // Xử lý khi gửi email thành công
} catch (error) {
  // Xử lý khi gửi email thất bại
  console.error('Lỗi gửi email:', error);
}
```

### 2. Gửi email xác nhận đăng ký

```javascript
const { sendRegistrationEmail } = require('../utils/emailService');

// Trong controller đăng ký
const register = async (req, res) => {
  try {
    // ... Xử lý đăng ký người dùng
    
    // Tạo link xác nhận
    const token = generateToken(); // Hàm tạo token
    const confirmationLink = `${process.env.FRONTEND_URL}/confirm-account?token=${token}`;
    
    // Gửi email xác nhận
    await sendRegistrationEmail(
      user.email,
      user.username,
      confirmationLink
    );
    
    // ... Phản hồi cho client
  } catch (error) {
    // Xử lý lỗi
  }
};
```

### 3. Gửi email đặt lại mật khẩu

```javascript
const { sendPasswordResetEmail } = require('../utils/emailService');

// Trong controller quên mật khẩu
const forgotPassword = async (req, res) => {
  try {
    // ... Xử lý tìm kiếm người dùng
    
    // Tạo token đặt lại mật khẩu
    const resetToken = generateResetToken(); // Hàm tạo token
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    // Gửi email đặt lại mật khẩu
    await sendPasswordResetEmail(
      user.email,
      user.username,
      resetLink
    );
    
    // ... Phản hồi cho client
  } catch (error) {
    // Xử lý lỗi
  }
};
```

### 4. Gửi email xác nhận đặt sân

```javascript
const { sendBookingConfirmationEmail } = require('../utils/emailService');

// Trong controller đặt sân
const createBooking = async (req, res) => {
  try {
    // ... Xử lý tạo đơn đặt sân
    
    // Chuẩn bị thông tin đặt sân
    const bookingDetails = {
      fieldName: field.name,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalAmount: booking.totalAmount
    };
    
    // Gửi email xác nhận đặt sân
    await sendBookingConfirmationEmail(
      user.email,
      user.username,
      bookingDetails
    );
    
    // ... Phản hồi cho client
  } catch (error) {
    // Xử lý lỗi
  }
};
```

## Tùy chỉnh mẫu email

Bạn có thể tùy chỉnh nội dung HTML và văn bản của các email trong file `src/utils/emailService.js`. Mỗi hàm gửi email đã bao gồm một mẫu HTML dễ đọc và một phiên bản văn bản thuần cho các trình email không hỗ trợ HTML.

## Xử lý lỗi

Module này đã bao gồm xử lý lỗi cơ bản. Trong các hàm sử dụng, bạn nên:

1. Bao các lệnh gửi email trong khối try-catch
2. Ghi log lỗi nếu có
3. Có kế hoạch dự phòng nếu việc gửi email thất bại (ví dụ: lưu trữ email trong hàng đợi để thử lại sau) 