#!/usr/bin/env node

/**
 * Script để chạy kiểm tra gói dịch vụ ngay lập tức
 * Sử dụng: node scripts/validate-packages.js
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models và utils
const { sequelize, testDbConnection } = require('../src/models');
const { runPackageValidationNow } = require('../src/utils/cronJobs');
const logger = require('../src/utils/logger');

async function main() {
    try {
        console.log('🚀 Bắt đầu kiểm tra gói dịch vụ...');
        
        // Kiểm tra kết nối database
        await testDbConnection();
        console.log('✅ Kết nối database thành công');
        
        // Chạy validation
        await runPackageValidationNow();
        console.log('✅ Hoàn thành kiểm tra gói dịch vụ');
        
    } catch (error) {
        console.error('❌ Lỗi khi chạy kiểm tra gói dịch vụ:', error);
        process.exit(1);
    } finally {
        // Đóng kết nối database
        await sequelize.close();
        console.log('🔚 Đã đóng kết nối database');
        process.exit(0);
    }
}

// Xử lý tín hiệu để thoát an toàn
process.on('SIGINT', () => {
    console.log('\n⚠️  Nhận tín hiệu SIGINT, đang thoát...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n⚠️  Nhận tín hiệu SIGTERM, đang thoát...');
    process.exit(0);
});

// Chạy script
main();
