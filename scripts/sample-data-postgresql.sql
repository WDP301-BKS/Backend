-- ===========================================
-- SAMPLE DATA FOR FOOTBALL FIELD BOOKING SYSTEM
-- ===========================================
-- Created: July 2025
-- Database: PostgreSQL
-- Purpose: Complete sample data for testing all features
-- 
-- Instructions:
-- 1. Make sure your database schema is created first
-- 2. Run this file to populate sample data
-- 3. This includes all necessary data for testing:
--    - Users (owners & customers)
--    - Locations & Fields & Subfields
--    - Bookings & Timeslots
--    - Reviews & Favorites
-- ===========================================

-- Clear existing data (optional - comment out if you want to keep existing data)
-- DELETE FROM favorites WHERE 1=1;
-- DELETE FROM reviews WHERE 1=1;
-- DELETE FROM timeslots WHERE 1=1;
-- DELETE FROM bookings WHERE 1=1;
-- DELETE FROM subfields WHERE 1=1;
-- DELETE FROM fields WHERE 1=1;
-- DELETE FROM locations WHERE 1=1;
-- DELETE FROM users WHERE role IN ('owner', 'customer');

-- ===========================================
-- 1. USERS TABLE
-- ===========================================

INSERT INTO users (id, name, email, password_hash, phone, "profileImage", bio, gender, "dateOfBirth", address, role, is_active, is_verified, package_type, created_at, updated_at) VALUES

-- Owners
('387ca4ff-5b4a-447e-97e6-433020acff9c', 'Nguyễn Văn An', 'owner1@gmail.com', '$2b$12$LQv3c1yqBwEHxPuNiYspeOH1YHwXUbEGxrZnNmKN8QmjnNfE5YgRm', '0901234568', 'https://example.com/owner1-avatar.jpg', 'Chủ sở hữu sân bóng đá chuyên nghiệp', 'male', '1980-05-20', '456 Owner Ave, Ho Chi Minh City', 'owner', true, true, 'premium', NOW(), NOW()),
('46711d7d-4e6c-4fd6-9be5-1eec9bec4ed8', 'Trần Thị Bình', 'owner2@gamil.com', '$2b$12$LQv3c1yqBwEHxPuNiYspeOH1YHwXUbEGxrZnNmKN8QmjnNfE5YgRm', '0901234569', 'https://example.com/owner2-avatar.jpg', 'Kinh doanh sân thể thao 10 năm kinh nghiệm', 'female', '1978-11-10', '789 Business Blvd, Ho Chi Minh City', 'owner', true, true, 'basic', NOW(), NOW()),
('4d03e04e-23f4-4f46-b9a6-4c669c5ec08b', 'Lê Minh Cường', 'owner3@gmail.com', '$2b$12$LQv3c1yqBwEHxPuNiYspeOH1YHwXUbEGxrZnNmKN8QmjnNfE5YgRm', '0901234570', 'https://example.com/owner3-avatar.jpg', 'Quản lý cụm sân thể thao', 'male', '1982-07-25', '321 Sports Complex, Ho Chi Minh City', 'owner', true, true, 'premium', NOW(), NOW()),

-- Customers
('d4c5de0d-af5c-48b7-938b-ba62102506a6', 'Phạm Văn Đức', 'customer1@gmail.com', '$2b$12$LQv3c1yqBwEHxPuNiYspeOH1YHwXUbEGxrZnNmKN8QmjnNfE5YgRm', '0901234571', 'https://example.com/customer1-avatar.jpg', 'Yêu thích bóng đá', 'male', '1995-03-12', '654 Customer St, Ho Chi Minh City', 'customer', true, true, 'none', NOW(), NOW()),
('1b4a8524-2c79-42a3-bbbb-b1a163960f15', 'Nguyễn Thị Hương', 'customer2@gmail.com', '$2b$12$LQv3c1yqBwEHxPuNiYspeOH1YHwXUbEGxrZnNmKN8QmjnNfE5YgRm', '0901234572', 'https://example.com/customer2-avatar.jpg', 'Chơi thể thao thường xuyên', 'female', '1992-09-08', '987 Sports Fan Ave, Ho Chi Minh City', 'customer', true, true, 'none', NOW(), NOW()),
('55c04c03-1ad9-4605-8ee3-8400f158dc09', 'Hoàng Minh Tuấn', 'customer3@gmail.com', '$2b$12$LQv3c1yqBwEHxPuNiYspeOH1YHwXUbEGxrZnNmKN8QmjnNfE5YgRm', '0901234573', 'https://example.com/customer3-avatar.jpg', 'Đam mê bóng đá', 'male', '1988-12-30', '147 Football St, Ho Chi Minh City', 'customer', true, true, 'none', NOW(), NOW()),
('ef83becb-dd75-4acf-9c71-888a5cb619a1', 'Lê Thị Mai', 'customer4@gmail.com', '$2b$12$LQv3c1yqBwEHxPuNiYspeOH1YHwXUbEGxrZnNmKN8QmjnNfE5YgRm', '0901234574', 'https://example.com/customer4-avatar.jpg', 'Thích thể thao ngoài trời', 'female', '1993-04-18', '258 Active Life Rd, Ho Chi Minh City', 'customer', true, true, 'none', NOW(), NOW()),
('c869a2b9-434a-46c8-9662-f3547ff68fbd', 'Vũ Đình Nam', 'customer5@gmail.com', '$2b$12$LQv3c1yqBwEHxPuNiYspeOH1YHwXUbEGxrZnNmKN8QmjnNfE5YgRm', '0901234575', 'https://example.com/customer5-avatar.jpg', 'Tổ chức các trận đấu', 'male', '1990-06-22', '369 Team Captain Ave, Ho Chi Minh City', 'customer', true, true, 'none', NOW(), NOW()),
('ad1b7983-c738-4b84-a37d-11dd2137af55', 'Đỗ Thị Lan', 'customer6@gmail.com', '$2b$12$LQv3c1yqBwEHxPuNiYspeOH1YHwXUbEGxrZnNmKN8QmjnNfE5YgRm', '0901234576', 'https://example.com/customer6-avatar.jpg', 'Nhóm bóng đá nữ', 'female', '1991-08-14', '741 Women Sports St, Ho Chi Minh City', 'customer', true, true, 'none', NOW(), NOW());



-- ===========================================
-- 2. LOCATIONS TABLE (Updated UUIDs)
-- ===========================================

INSERT INTO locations (id, latitude, longitude, address_text, formatted_address, city, district, ward, country, country_code, created_at, updated_at) VALUES
('b76f8314-80da-497d-ad50-874b6fcbf3e5', 16.047079, 108.206230, '123 Lê Duẩn, Quận Hải Châu', '123 Lê Duẩn, Phường Thạch Thang, Quận Hải Châu, Thành phố Đà Nẵng', 'Da Nang', 'Quận Hải Châu', 'Phường Thạch Thang', 'Vietnam', 'VN', NOW(), NOW()),
('a5dc41eb-fc47-4606-9473-9a77146ea016', 16.061556, 108.223972, '456 Trần Phú, Quận Hải Châu', '456 Trần Phú, Phường Hải Châu I, Quận Hải Châu, Thành phố Đà Nẵng', 'Da Nang', 'Quận Hải Châu', 'Phường Hải Châu I', 'Vietnam', 'VN', NOW(), NOW()),
('24f5811a-c30e-41f7-8888-b224200a1dab', 16.076524, 108.213198, '789 Nguyễn Văn Linh, Quận Thanh Khê', '789 Nguyễn Văn Linh, Phường Thanh Khê Đông, Quận Thanh Khê, Thành phố Đà Nẵng', 'Da Nang', 'Quận Thanh Khê', 'Phường Thanh Khê Đông', 'Vietnam', 'VN', NOW(), NOW()),
('924ca626-4563-417e-bb19-5b7c3affc1ed', 16.093400, 108.236500, '321 Phạm Văn Đồng, Quận Sơn Trà', '321 Phạm Văn Đồng, Phường An Hải Bắc, Quận Sơn Trà, Thành phố Đà Nẵng', 'Da Nang', 'Quận Sơn Trà', 'Phường An Hải Bắc', 'Vietnam', 'VN', NOW(), NOW()),
('5c8a4cc6-1278-4871-baf9-ac65dd96093f', 16.041856, 108.207656, '654 Nguyễn Hữu Thọ, Quận Hải Châu', '654 Nguyễn Hữu Thọ, Phường Hòa Thuận Tây, Quận Hải Châu, Thành phố Đà Nẵng', 'Da Nang', 'Quận Hải Châu', 'Phường Hòa Thuận Tây', 'Vietnam', 'VN', NOW(), NOW()),
('8cc95f59-530b-4090-9c95-5dccf4f89265', 16.066317, 108.195846, '987 Tôn Đức Thắng, Quận Liên Chiểu', '987 Tôn Đức Thắng, Phường Hòa Minh, Quận Liên Chiểu, Thành phố Đà Nẵng', 'Da Nang', 'Quận Liên Chiểu', 'Phường Hòa Minh', 'Vietnam', 'VN', NOW(), NOW());

-- ===========================================
-- 3. FIELDS TABLE
-- ===========================================

-- ===========================================
-- 3. FIELDS TABLE (Updated UUIDs)
-- ===========================================

INSERT INTO fields (id, owner_id, name, location_id, description, price_per_hour, images1, images2, images3, is_verified, created_at, updated_at) VALUES
('b287bb3b-69d6-40c1-9f13-c9ec7b0894cd', '387ca4ff-5b4a-447e-97e6-433020acff9c', 'Sân bóng Green Park', 'b76f8314-80da-497d-ad50-874b6fcbf3e5', 'Sân bóng đá cỏ nhân tạo cao cấp với đầy đủ tiện nghi. Có chỗ đậu xe rộng rãi và khu vực nghỉ ngơi.', 300000.00, 'https://i.pinimg.com/736x/f7/64/86/f76486557fc2845afd897d08e73ddf3e.jpg', 'https://i.pinimg.com/736x/a2/45/0c/a2450cb573c3af160453481c9c157644.jpg', 'https://i.pinimg.com/736x/04/86/1d/04861d962a3322d8c634b350ee3c9818.jpg', true, NOW(), NOW()),
('742aa01f-b74d-4048-a1a6-d5e3b9f31fe9', '46711d7d-4e6c-4fd6-9be5-1eec9bec4ed8', 'Sân thể thao Central', 'a5dc41eb-fc47-4606-9473-9a77146ea016', 'Cụm sân thể thao đa năng với 3 sân bóng đá và khu vực tập luyện. Có căn tin và wifi miễn phí.', 250000.00, 'https://phuongthanhngoc.com/media/data/tin-tuc/danh-cho-nha-dau-tu/chieu-dai-san-bong-da-2.jpg', 'https://i.pinimg.com/736x/03/75/8e/03758ed62920924a6910ee17e32868cd.jpg','https://bulbal.vn/wp-content/uploads/2023/01/TOP-10-SAN-BONG-DA-PHUI-TAI-TPHCM-NAM-2023.jpg', true, NOW(), NOW()),
('6895530d-90cf-4fc4-88ff-c406eaa03bfc', '4d03e04e-23f4-4f46-b9a6-4c669c5ec08b', 'Sân bóng Victory', '24f5811a-c30e-41f7-8888-b224200a1dab', 'Sân bóng đá mini chuyên nghiệp với hệ thống chiếu sáng LED. Thích hợp cho các trận đấu ban đêm.', 350000.00, 'https://hoangdunggreen.com/wp-content/uploads/2021/01/conhantao2.jpg.webp', 'https://vattucongtrinhpan.com/wp-content/uploads/2024/01/11-1.jpg', 'https://thamconhantao.vn/wp-content/uploads/2019/02/co-trong-san-bong-da-1.jpg', true, NOW(), NOW()),
('a7eb59a3-77a3-4352-8025-1d1771cb2f26', '387ca4ff-5b4a-447e-97e6-433020acff9c', 'Sân bóng Thủ Đức', '924ca626-4563-417e-bb19-5b7c3affc1ed', 'Sân bóng đá cỏ tự nhiên với không gian thoáng mát. Có dịch vụ cho thuê giày và trang phục.', 280000.00, 'https://vattucongtrinhpan.com/wp-content/uploads/2024/01/22-1.jpg', 'https://atsport.vn/wp-content/uploads/2021/08/kich-thuoc-san-bong-da-7-nguoi-co-nhan-tao-1-1-800x800.jpg', 'https://chieusangngoaitroi.com/wp-content/uploads/2022/08/den-led-cho-san-bong-da.jpg', true, NOW(), NOW()),
('c0d4b80a-593e-4e92-bd5f-fb3e03a034c3', '46711d7d-4e6c-4fd6-9be5-1eec9bec4ed8', 'Sân bóng Sport Complex', '5c8a4cc6-1278-4871-baf9-ac65dd96093f', 'Khu liên hợp thể thao với nhiều sân bóng đá khác nhau. Có phòng tắm và khu vực thay đồ.', 320000.00, 'https://bizweb.dktcdn.net/100/017/070/files/kich-thuoc-san-bong-da-2-jpeg.jpg?v=1671246545158', 'https://thanhnhua.vn/media/data/tin-tuc/2022/11/bang-gia-thi-cong-san-co-nhan-tao-7-nguoi.jpg', 'https://hidosport.vn/wp-content/uploads/2023/12/cot-co-goc-san-bong-1.jpg', true, NOW(), NOW()),
('67e6e9e3-8983-43d9-b7cc-d6cc0f1a2d50', '4d03e04e-23f4-4f46-b9a6-4c669c5ec08b', 'Sân bóng Tân Bình', '8cc95f59-530b-4090-9c95-5dccf4f89265', 'Sân bóng đá mini tiện lợi gần sân bay. Thích hợp cho các buổi tập và giải đấu nhỏ.', 270000.00, 'https://atsport.vn/wp-content/uploads/2021/07/san-co-nhan-tao-1-27.jpg', 'https://foba.vn/wp-content/uploads/2020/08/den-san-bong.jpg', 'https://www.sport9.vn/images/uploaded/kich-thuoc-chuan-fifa-cua-san-bong-da-5-nguoi-la-bao-nhieu/kich-thuoc-chuan-fifa-cua-san-bong-da-5-nguoi-la-bao-nhieu-5.jpg', true, NOW(), NOW());

-- ===========================================
-- 4. SUBFIELDS TABLE
-- ===========================================

-- ===========================================
-- 4. SUBFIELDS TABLE (Updated UUIDs)
-- ===========================================

INSERT INTO subfields (id, field_id, name, image, field_type) VALUES
-- Green Park subfields
('ae14cbd8-3484-4ae7-9aa7-d5ec235f0a4f', 'b287bb3b-69d6-40c1-9f13-c9ec7b0894cd', 'Sân A', 'https://example.com/subfield1a.jpg', '7vs7'),
('e0d45b16-22f0-4bc0-bc77-9c70533e18d4', 'b287bb3b-69d6-40c1-9f13-c9ec7b0894cd', 'Sân B', 'https://example.com/subfield1b.jpg', '5vs5'),

-- Central subfields
('7acde291-c02e-45aa-8a1b-9fc894c38c6d', '742aa01f-b74d-4048-a1a6-d5e3b9f31fe9', 'Sân A', 'https://example.com/subfield2a.jpg', '7vs7'),
('d1b4598a-7c84-4436-8f79-6b6598ec2fa3', '742aa01f-b74d-4048-a1a6-d5e3b9f31fe9', 'Sân B', 'https://example.com/subfield2b.jpg', '5vs5'),
('3fa2ec3e-658c-4b50-b3b3-f92e85b95aa5', '742aa01f-b74d-4048-a1a6-d5e3b9f31fe9', 'Sân C', 'https://example.com/subfield2c.jpg', '7vs7'),

-- Victory subfields
('1c5a8f99-5294-45d1-81bc-59d9447005fa', '6895530d-90cf-4fc4-88ff-c406eaa03bfc', 'Sân A', 'https://example.com/subfield3a.jpg', '7vs7'),
('e22d46d2-58d8-42c4-a72a-43d3d624af95', '6895530d-90cf-4fc4-88ff-c406eaa03bfc', 'Sân B', 'https://example.com/subfield3b.jpg', '5vs5'),

-- Thủ Đức subfields
('fa12c590-8f15-4703-83e4-2a30899deee4', 'a7eb59a3-77a3-4352-8025-1d1771cb2f26', 'Sân A', 'https://example.com/subfield4a.jpg', '7vs7'),
('e2a0704d-cb6a-455b-8672-4cfe5be67b12', 'a7eb59a3-77a3-4352-8025-1d1771cb2f26', 'Sân B', 'https://example.com/subfield4b.jpg', '5vs5'),

-- Sport Complex subfields
('b5f313b7-4d5d-4e83-a68e-e5025a134f27', 'c0d4b80a-593e-4e92-bd5f-fb3e03a034c3', 'Sân A', 'https://example.com/subfield5a.jpg', '7vs7'),
('3671b281-3ce7-4f62-8910-eed1a4b29eec', 'c0d4b80a-593e-4e92-bd5f-fb3e03a034c3', 'Sân B', 'https://example.com/subfield5b.jpg', '5vs5'),

-- Tân Bình subfields
('cdac140f-1de0-43e3-b024-b8eb13c3b065', '67e6e9e3-8983-43d9-b7cc-d6cc0f1a2d50', 'Sân A', 'https://example.com/subfield6a.jpg', '7vs7'),
('649d2236-e508-4a6a-a4b6-c75ae83a90a6', '67e6e9e3-8983-43d9-b7cc-d6cc0f1a2d50', 'Sân B', 'https://example.com/subfield6b.jpg', '5vs5');

-- ===========================================
-- 5. BOOKINGS TABLE
-- ===========================================

INSERT INTO bookings (id, booking_date, status, total_price, deposit_amount, payment_status, payment_method, user_id, customer_info, created_at, updated_at) VALUES
('f1a2b3c4-d5e6-7890-abcd-ef1234567890', '2024-12-10', 'completed', 600000.00, 300000.00, 'paid', 'vnpay', 'd4c5de0d-af5c-48b7-938b-ba62102506a6', '{"name": "Phạm Văn Đức", "phone": "0901234571", "email": "customer1@gmail.com"}', '2024-12-01 10:00:00', '2024-12-10 18:00:00'),
('a1b2c3d4-e5f6-7890-1234-567890abcdef', '2024-12-12', 'completed', 500000.00, 250000.00, 'paid', 'momo', '1b4a8524-2c79-42a3-bbbb-b1a163960f15', '{"name": "Nguyễn Thị Hương", "phone": "0901234572", "email": "customer2@gmail.com"}', '2024-12-02 14:00:00', '2024-12-12 16:00:00'),
('b2c3d4e5-f6a7-8901-2345-678901bcdefg', '2024-12-15', 'completed', 700000.00, 350000.00, 'paid', 'vnpay', '55c04c03-1ad9-4605-8ee3-8400f158dc09', '{"name": "Hoàng Minh Tuấn", "phone": "0901234573", "email": "customer3@gmail.com"}', '2024-12-05 09:00:00', '2024-12-15 20:00:00'),
('c3d4e5f6-a7b8-9012-3456-789012cdefgh', '2024-12-18', 'completed', 560000.00, 280000.00, 'paid', 'momo', 'ef83becb-dd75-4acf-9c71-888a5cb619a1', '{"name": "Lê Thị Mai", "phone": "0901234574", "email": "customer4@gmail.com"}', '2024-12-08 11:00:00', '2024-12-18 19:00:00'),
('d4e5f6a7-b8c9-0123-4567-890123defghi', '2024-12-20', 'completed', 640000.00, 320000.00, 'paid', 'vnpay', 'c869a2b9-434a-46c8-9662-f3547ff68fbd', '{"name": "Vũ Đình Nam", "phone": "0901234575", "email": "customer5@gmail.com"}', '2024-12-10 15:00:00', '2024-12-20 17:00:00'),
('e5f6a7b8-c9d0-1234-5678-901234efghij', '2024-12-22', 'completed', 540000.00, 270000.00, 'paid', 'momo', 'ad1b7983-c738-4b84-a37d-11dd2137af55', '{"name": "Đỗ Thị Lan", "phone": "0901234576", "email": "customer6@gmail.com"}', '2024-12-12 13:00:00', '2024-12-22 15:00:00'),
('f6a7b8c9-d0e1-2345-6789-012345fghijk', NOW() + INTERVAL '2 days', 'confirmed', 600000.00, 300000.00, 'paid', 'vnpay', 'd4c5de0d-af5c-48b7-938b-ba62102506a6', '{"name": "Phạm Văn Đức", "phone": "0901234571", "email": "customer1@gmail.com"}', NOW(), NOW()),
('a7b8c9d0-e1f2-3456-7890-123456ghijkl', NOW() + INTERVAL '3 days', 'pending', 500000.00, 0.00, 'pending', NULL, '1b4a8524-2c79-42a3-bbbb-b1a163960f15', '{"name": "Nguyễn Thị Hương", "phone": "0901234572", "email": "customer2@gmail.com"}', NOW(), NOW());

-- ===========================================
-- 6. TIMESLOTS TABLE
-- ===========================================

INSERT INTO timeslots (id, start_time, end_time, date, sub_field_id, booking_id, status) VALUES
-- Completed bookings timeslots
('t1a2b3c4-d5e6-7890-abcd-ef1234567890', '16:00:00', '18:00:00', '2024-12-10', 'ae14cbd8-3484-4ae7-9aa7-d5ec235f0a4f', 'f1a2b3c4-d5e6-7890-abcd-ef1234567890', 'booked'),
('t2b3c4d5-e6f7-8901-bcde-f23456789012', '14:00:00', '16:00:00', '2024-12-12', '7acde291-c02e-45aa-8a1b-9fc894c38c6d', 'a1b2c3d4-e5f6-7890-1234-567890abcdef', 'booked'),
('t3c4d5e6-f7a8-9012-cdef-345678901234', '18:00:00', '20:00:00', '2024-12-15', '1c5a8f99-5294-45d1-81bc-59d9447005fa', 'b2c3d4e5-f6a7-8901-2345-678901bcdefg', 'booked'),
('t4d5e6f7-a8b9-0123-def0-456789012345', '17:00:00', '19:00:00', '2024-12-18', 'fa12c590-8f15-4703-83e4-2a30899deee4', 'c3d4e5f6-a7b8-9012-3456-789012cdefgh', 'booked'),
('t5e6f7a8-b9c0-1234-ef01-567890123456', '15:00:00', '17:00:00', '2024-12-20', 'b5f313b7-4d5d-4e83-a68e-e5025a134f27', 'd4e5f6a7-b8c9-0123-4567-890123defghi', 'booked'),
('t6f7a8b9-c0d1-2345-f012-678901234567', '13:00:00', '15:00:00', '2024-12-22', 'cdac140f-1de0-43e3-b024-b8eb13c3b065', 'e5f6a7b8-c9d0-1234-5678-901234efghij', 'booked'),

-- Future bookings timeslots
('t7a8b9c0-d1e2-3456-0123-789012345678', '16:00:00', '18:00:00', CURRENT_DATE + INTERVAL '2 days', 'ae14cbd8-3484-4ae7-9aa7-d5ec235f0a4f', 'f6a7b8c9-d0e1-2345-6789-012345fghijk', 'booked'),
('t8b9c0d1-e2f3-4567-1234-890123456789', '14:00:00', '16:00:00', CURRENT_DATE + INTERVAL '3 days', '7acde291-c02e-45aa-8a1b-9fc894c38c6d', 'a7b8c9d0-e1f2-3456-7890-123456ghijkl', 'booked'),

-- Available timeslots for testing
('ta1b2c3d-e4f5-6789-0123-456789abcdef', '08:00:00', '10:00:00', CURRENT_DATE + INTERVAL '1 day', 'ae14cbd8-3484-4ae7-9aa7-d5ec235f0a4f', NULL, 'available'),
('ta2c3d4e-f5a6-7890-1234-567890bcdef0', '10:00:00', '12:00:00', CURRENT_DATE + INTERVAL '1 day', 'ae14cbd8-3484-4ae7-9aa7-d5ec235f0a4f', NULL, 'available'),
('ta3d4e5f-a6b7-8901-2345-678901cdef01', '12:00:00', '14:00:00', CURRENT_DATE + INTERVAL '1 day', 'ae14cbd8-3484-4ae7-9aa7-d5ec235f0a4f', NULL, 'available'),
('ta4e5f6a-b7c8-9012-3456-789012def012', '14:00:00', '16:00:00', CURRENT_DATE + INTERVAL '1 day', 'ae14cbd8-3484-4ae7-9aa7-d5ec235f0a4f', NULL, 'available'),
('ta5f6a7b-c8d9-0123-4567-890123ef0123', '16:00:00', '18:00:00', CURRENT_DATE + INTERVAL '1 day', 'e0d45b16-22f0-4bc0-bc77-9c70533e18d4', NULL, 'available'),
('ta6a7b8c-d9e0-1234-5678-901234f01234', '18:00:00', '20:00:00', CURRENT_DATE + INTERVAL '1 day', 'e0d45b16-22f0-4bc0-bc77-9c70533e18d4', NULL, 'available'),
('ta7b8c9d-e0f1-2345-6789-012345012345', '20:00:00', '22:00:00', CURRENT_DATE + INTERVAL '1 day', 'e0d45b16-22f0-4bc0-bc77-9c70533e18d4', NULL, 'available');

-- ===========================================
-- 7. REVIEWS TABLE
-- ===========================================

INSERT INTO reviews (id, user_id, field_id, rating, comment, images, created_at) VALUES
('r1a2b3c4-d5e6-7890-abcd-ef1234567890', 'd4c5de0d-af5c-48b7-938b-ba62102506a6', 'b287bb3b-69d6-40c1-9f13-c9ec7b0894cd', 5, 'Sân bóng rất tuyệt vời! Cỏ nhân tạo chất lượng cao, mặt sân phẳng. Đội ngũ nhân viên nhiệt tình, hỗ trợ tốt. Chỗ đậu xe rộng rãi, thuận tiện. Chắc chắn sẽ quay lại!', '["https://example.com/review1-img1.jpg", "https://example.com/review1-img2.jpg"]', '2024-12-10 19:00:00'),

('r2b3c4d5-e6f7-8901-bcde-f23456789012', '1b4a8524-2c79-42a3-bbbb-b1a163960f15', '742aa01f-b74d-4048-a1a6-d5e3b9f31fe9', 4, 'Sân khá ổn, có wifi miễn phí rất tiện. Căn tin bán đồ uống giá hợp lý. Tuy nhiên mình thấy hệ thống âm thanh có hơi yếu một chút. Nhìn chung vẫn recommend!', '["https://example.com/review2-img1.jpg"]', '2024-12-12 17:00:00'),

('r3c4d5e6-f7a8-9012-cdef-345678901234', '55c04c03-1ad9-4605-8ee3-8400f158dc09', '6895530d-90cf-4fc4-88ff-c406eaa03bfc', 5, 'Sân Victory thực sự xứng tên! Hệ thống đèn LED rất sáng, chơi ban đêm không bị lóa mắt. Mặt sân chuẩn, bóng nảy đều. Giá cả hợp lý so với chất lượng. Rất hài lòng!', '["https://example.com/review3-img1.jpg", "https://example.com/review3-img2.jpg", "https://example.com/review3-img3.jpg"]', '2024-12-15 21:00:00'),

('r4d5e6f7-a8b9-0123-def0-456789012345', 'ef83becb-dd75-4acf-9c71-888a5cb619a1', 'a7eb59a3-77a3-4352-8025-1d1771cb2f26', 4, 'Cỏ tự nhiên rất đẹp, mềm mại khi chạy. Không gian thoáng mát, gió mát. Dịch vụ cho thuê giày khá tiện lợi. Chỉ có điều bãi đậu xe hơi nhỏ một chút vào giờ cao điểm.', '[]', '2024-12-18 20:00:00'),

('r5e6f7a8-b9c0-1234-ef01-567890123456', 'c869a2b9-434a-46c8-9662-f3547ff68fbd', 'c0d4b80a-593e-4e92-bd5f-fb3e03a034c3', 5, 'Khu phức hợp thể thao tuyệt vời! Có nhiều sân để lựa chọn, phòng tắm sạch sẽ, khu thay đồ rộng rãi. Nhân viên thân thiện, hỗ trợ nhiệt tình. Giá tuy hơi cao nhưng xứng đáng!', '["https://example.com/review5-img1.jpg"]', '2024-12-20 18:00:00'),

('r6f7a8b9-c0d1-2345-f012-678901234567', 'ad1b7983-c738-4b84-a37d-11dd2137af55', '67e6e9e3-8983-43d9-b7cc-d6cc0f1a2d50', 4, 'Vị trí thuận tiện gần sân bay, dễ dàng di chuyển. Sân bóng mini phù hợp cho nhóm nhỏ. Mặt sân ổn, đường kẻ rõ ràng. Có thể cải thiện thêm về âm thanh và ánh sáng.', '["https://example.com/review6-img1.jpg", "https://example.com/review6-img2.jpg"]', '2024-12-22 16:00:00'),

('r7a8b9c0-d1e2-3456-0123-789012345678', 'd4c5de0d-af5c-48b7-938b-ba62102506a6', '742aa01f-b74d-4048-a1a6-d5e3b9f31fe9', 5, 'Lần thứ hai đến đây và vẫn rất hài lòng! Sân Central luôn duy trì chất lượng tốt. Đặc biệt thích khu vực tập luyện riêng biệt. Wifi mạnh, tiện lợi để livestream.', '[]', NOW() - INTERVAL '1 day'),

('r8b9c0d1-e2f3-4567-1234-890123456789', '1b4a8524-2c79-42a3-bbbb-b1a163960f15', 'b287bb3b-69d6-40c1-9f13-c9ec7b0894cd', 4, 'Green Park là lựa chọn tốt cho các buổi tập đội. Cỏ nhân tạo chất lượng, không gây trượt ngã. Khu vực nghỉ ngơi thoải mái. Hy vọng sẽ có thêm dịch vụ bán đồ ăn nhẹ.', '["https://example.com/review8-img1.jpg"]', NOW() - INTERVAL '2 days'),

('r9c0d1e2-f3a4-5678-2345-901234567890', '55c04c03-1ad9-4605-8ee3-8400f158dc09', 'a7eb59a3-77a3-4352-8025-1d1771cb2f26', 3, 'Sân ổn nhưng cần bảo trì cỏ tự nhiên thêm. Một số chỗ cỏ hơi thưa. Tuy nhiên vẫn chơi được và giá cả hợp lý. Hy vọng chủ sân sẽ chú ý cải thiện.', '[]', NOW() - INTERVAL '3 days');

-- ===========================================
-- 8. FAVORITES TABLE
-- ===========================================

INSERT INTO favorites (id, user_id, field_id, created_at) VALUES
('fav1a2b3-c4d5-e6f7-8901-234567890abc', 'd4c5de0d-af5c-48b7-938b-ba62102506a6', 'b287bb3b-69d6-40c1-9f13-c9ec7b0894cd', NOW() - INTERVAL '5 days'),
('fav2b3c4-d5e6-f7a8-9012-345678901bcd', 'd4c5de0d-af5c-48b7-938b-ba62102506a6', '6895530d-90cf-4fc4-88ff-c406eaa03bfc', NOW() - INTERVAL '3 days'),
('fav3c4d5-e6f7-a8b9-0123-456789012cde', '1b4a8524-2c79-42a3-bbbb-b1a163960f15', '742aa01f-b74d-4048-a1a6-d5e3b9f31fe9', NOW() - INTERVAL '7 days'),
('fav4d5e6-f7a8-b9c0-1234-567890123def', '1b4a8524-2c79-42a3-bbbb-b1a163960f15', 'b287bb3b-69d6-40c1-9f13-c9ec7b0894cd', NOW() - INTERVAL '2 days'),
('fav5e6f7-a8b9-c0d1-2345-678901234ef0', '55c04c03-1ad9-4605-8ee3-8400f158dc09', '6895530d-90cf-4fc4-88ff-c406eaa03bfc', NOW() - INTERVAL '1 day'),
('fav6f7a8-b9c0-d1e2-3456-789012345f01', '55c04c03-1ad9-4605-8ee3-8400f158dc09', 'a7eb59a3-77a3-4352-8025-1d1771cb2f26', NOW() - INTERVAL '4 days'),
('fav7a8b9-c0d1-e2f3-4567-890123456012', 'ef83becb-dd75-4acf-9c71-888a5cb619a1', 'c0d4b80a-593e-4e92-bd5f-fb3e03a034c3', NOW() - INTERVAL '6 days'),
('fav8b9c0-d1e2-f3a4-5678-901234567123', 'c869a2b9-434a-46c8-9662-f3547ff68fbd', 'c0d4b80a-593e-4e92-bd5f-fb3e03a034c3', NOW() - INTERVAL '8 days'),
('fav9c0d1-e2f3-a4b5-6789-012345678234', 'ad1b7983-c738-4b84-a37d-11dd2137af55', '67e6e9e3-8983-43d9-b7cc-d6cc0f1a2d50', NOW() - INTERVAL '9 days');

-- ===========================================
-- 9. ADDITIONAL SAMPLE DATA FOR COMPLETE TESTING
-- ===========================================

-- Additional timeslots for next 7 days (for booking testing)
INSERT INTO timeslots (id, start_time, end_time, date, sub_field_id, booking_id, status) VALUES
-- Day +1 timeslots
('ts1-d1-morning-1', '06:00:00', '08:00:00', CURRENT_DATE + INTERVAL '1 day', '7acde291-c02e-45aa-8a1b-9fc894c38c6d', NULL, 'available'),
('ts1-d1-morning-2', '08:00:00', '10:00:00', CURRENT_DATE + INTERVAL '1 day', '7acde291-c02e-45aa-8a1b-9fc894c38c6d', NULL, 'available'),
('ts1-d1-morning-3', '10:00:00', '12:00:00', CURRENT_DATE + INTERVAL '1 day', '7acde291-c02e-45aa-8a1b-9fc894c38c6d', NULL, 'available'),
('ts1-d1-afternoon-1', '14:00:00', '16:00:00', CURRENT_DATE + INTERVAL '1 day', '7acde291-c02e-45aa-8a1b-9fc894c38c6d', NULL, 'available'),
('ts1-d1-afternoon-2', '16:00:00', '18:00:00', CURRENT_DATE + INTERVAL '1 day', '7acde291-c02e-45aa-8a1b-9fc894c38c6d', NULL, 'available'),
('ts1-d1-evening-1', '18:00:00', '20:00:00', CURRENT_DATE + INTERVAL '1 day', '7acde291-c02e-45aa-8a1b-9fc894c38c6d', NULL, 'available'),
('ts1-d1-evening-2', '20:00:00', '22:00:00', CURRENT_DATE + INTERVAL '1 day', '7acde291-c02e-45aa-8a1b-9fc894c38c6d', NULL, 'available'),

-- Day +2 timeslots
('ts2-d2-morning-1', '06:00:00', '08:00:00', CURRENT_DATE + INTERVAL '2 days', 'd1b4598a-7c84-4436-8f79-6b6598ec2fa3', NULL, 'available'),
('ts2-d2-morning-2', '08:00:00', '10:00:00', CURRENT_DATE + INTERVAL '2 days', 'd1b4598a-7c84-4436-8f79-6b6598ec2fa3', NULL, 'available'),
('ts2-d2-morning-3', '10:00:00', '12:00:00', CURRENT_DATE + INTERVAL '2 days', 'd1b4598a-7c84-4436-8f79-6b6598ec2fa3', NULL, 'available'),
('ts2-d2-afternoon-1', '14:00:00', '16:00:00', CURRENT_DATE + INTERVAL '2 days', 'd1b4598a-7c84-4436-8f79-6b6598ec2fa3', NULL, 'available'),
('ts2-d2-afternoon-2', '16:00:00', '18:00:00', CURRENT_DATE + INTERVAL '2 days', 'd1b4598a-7c84-4436-8f79-6b6598ec2fa3', NULL, 'available'),
('ts2-d2-evening-1', '18:00:00', '20:00:00', CURRENT_DATE + INTERVAL '2 days', 'd1b4598a-7c84-4436-8f79-6b6598ec2fa3', NULL, 'available'),
('ts2-d2-evening-2', '20:00:00', '22:00:00', CURRENT_DATE + INTERVAL '2 days', 'd1b4598a-7c84-4436-8f79-6b6598ec2fa3', NULL, 'available'),

-- Day +3 timeslots
('ts3-d3-morning-1', '06:00:00', '08:00:00', CURRENT_DATE + INTERVAL '3 days', '1c5a8f99-5294-45d1-81bc-59d9447005fa', NULL, 'available'),
('ts3-d3-morning-2', '08:00:00', '10:00:00', CURRENT_DATE + INTERVAL '3 days', '1c5a8f99-5294-45d1-81bc-59d9447005fa', NULL, 'available'),
('ts3-d3-morning-3', '10:00:00', '12:00:00', CURRENT_DATE + INTERVAL '3 days', '1c5a8f99-5294-45d1-81bc-59d9447005fa', NULL, 'available'),
('ts3-d3-afternoon-1', '14:00:00', '16:00:00', CURRENT_DATE + INTERVAL '3 days', '1c5a8f99-5294-45d1-81bc-59d9447005fa', NULL, 'available'),
('ts3-d3-afternoon-2', '16:00:00', '18:00:00', CURRENT_DATE + INTERVAL '3 days', '1c5a8f99-5294-45d1-81bc-59d9447005fa', NULL, 'available'),
('ts3-d3-evening-1', '18:00:00', '20:00:00', CURRENT_DATE + INTERVAL '3 days', '1c5a8f99-5294-45d1-81bc-59d9447005fa', NULL, 'available'),
('ts3-d3-evening-2', '20:00:00', '22:00:00', CURRENT_DATE + INTERVAL '3 days', '1c5a8f99-5294-45d1-81bc-59d9447005fa', NULL, 'available');

-- ===========================================
-- COMPLETION MESSAGE
-- ===========================================
-- Sample data insertion completed!
-- This file includes:
-- ✅ Users (3 owners + 6 customers)
-- ✅ Locations (6 locations in Da Nang)
-- ✅ Fields (6 football fields)
-- ✅ Subfields (12 sub-fields)
-- ✅ Bookings (8 bookings - 6 completed + 2 future)
-- ✅ Timeslots (booked + available slots for testing)
-- ✅ Reviews (9 detailed reviews)
-- ✅ Favorites (9 favorite relationships)
-- ✅ Additional timeslots for next 3 days
-- 
-- Ready for testing: booking system, reviews, search, favorites, etc.

