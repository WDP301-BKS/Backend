const { User, Booking, Field } = require('../models');
const { sequelize } = require('../config/db.config');
const { Op } = require('sequelize');
const constants = require('../common/constants');
const { USER_ROLES } = constants;
const moment = require('moment');

// Log DB connection details
console.log('Database connection details:');
console.log('- USE_POSTGRES:', process.env.USE_POSTGRES);
console.log('- DB_HOST:', process.env.DB_HOST);
console.log('- DB_NAME:', process.env.DB_NAME);
console.log('- DB_USER:', process.env.DB_USER);

/**
 * Get dashboard statistics for admin
 * This includes:
 * - Total customer count
 * - Total owner count
 * - Total revenue from bookings
 */
const getDashboardStatistics = async (req, res) => {
    try {
        console.log('Getting dashboard statistics...');
        
        // Get count of customers (role = customer)
        const customerCount = await User.count({
            where: {
                role: USER_ROLES.CUSTOMER
            }
        });
        console.log('Customer count:', customerCount);

        // Get count of field owners (role = owner)
        const ownerCount = await User.count({
            where: {
                role: USER_ROLES.OWNER
            }
        });
        console.log('Owner count:', ownerCount);

        // Calculate total revenue from all paid bookings (confirmed/completed with paid/completed payment)
        const totalRevenue = await Booking.sum('total_price', {
            where: {
                status: {
                    [Op.or]: ['confirmed', 'completed']
                },
                payment_status: {
                    [Op.or]: ['paid', 'completed']
                }
            }
        }) || 0;
        console.log('Total revenue:', totalRevenue);
        
        // Calculate revenue from regular bookings (isPackage = false or null)
        const regularBookingsRevenue = await Booking.sum('total_price', {
            where: {
                status: {
                    [Op.or]: ['confirmed', 'completed']
                },
                payment_status: {
                    [Op.or]: ['paid', 'completed']
                },
                isPackage: {
                    [Op.or]: [false, null]
                }
            }
        }) || 0;
        console.log('Regular bookings revenue:', regularBookingsRevenue);
        
        // Calculate revenue from package bookings (isPackage = true)
        const packageBookingsRevenue = await Booking.sum('total_price', {
            where: {
                status: {
                    [Op.or]: ['confirmed', 'completed']
                },
                payment_status: {
                    [Op.or]: ['paid', 'completed']
                },
                isPackage: true
            }
        }) || 0;
        console.log('Package bookings revenue:', packageBookingsRevenue);
        
        // Calculate booking cancellation rate
        const totalBookings = await Booking.count();
        const cancelledBookings = await Booking.count({
            where: {
                status: 'cancelled'
            }
        });
        const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
        console.log('Total bookings:', totalBookings);
        console.log('Cancelled bookings:', cancelledBookings);
        console.log('Cancellation rate:', cancellationRate.toFixed(2) + '%');

        // Get total fields count (active and inactive)
        const totalFields = await Field.count();
        // Count verified fields (active)
        const activeFields = await Field.count({
            where: {
                is_verified: true
            }
        });
        const inactiveFields = totalFields - activeFields;
        console.log('Total fields:', totalFields);
        console.log('Verified fields:', activeFields);
        console.log('Unverified fields:', inactiveFields);

        const totalUsers = customerCount + ownerCount;

        // Return the simplified statistics
        return res.json({
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    customers: customerCount,
                    owners: ownerCount
                },
                revenue: {
                    total: totalRevenue,
                    regular: regularBookingsRevenue,
                    package: packageBookingsRevenue
                },
                bookings: {
                    total: totalBookings,
                    cancelled: cancelledBookings,
                    cancellationRate: parseFloat(cancellationRate.toFixed(2))
                },
                fields: {
                    total: totalFields,
                    active: activeFields,
                    inactive: inactiveFields
                }
            }
        });
    } catch (error) {
        console.error('Error in getDashboardStatistics:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Đã có lỗi xảy ra khi lấy thống kê dashboard',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
};

/**
 * Get monthly revenue data for the revenue bar chart
 */
const getMonthlyRevenueData = async (req, res) => {
    try {
        // Get year from query params or use current year as default
        const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
        console.log(`Getting monthly revenue data for year: ${year}`);
        
        // Get additional filter params if provided
        const quarter = req.query.quarter;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        
        let whereClause = `WHERE EXTRACT(YEAR FROM booking_date) = ${year}`;
        
        // Add quarter filter if provided
        if (quarter) {
            const quarterStart = (parseInt(quarter) - 1) * 3 + 1;
            const quarterEnd = quarterStart + 2;
            whereClause += ` AND EXTRACT(MONTH FROM booking_date) BETWEEN ${quarterStart} AND ${quarterEnd}`;
        }
        
        // Add custom date range filter if provided
        if (startDate && endDate) {
            whereClause = `WHERE booking_date BETWEEN '${startDate}' AND '${endDate}'`;
        }
        
        // Using Sequelize to get monthly revenue data
        const result = await sequelize.query(`
            SELECT 
                EXTRACT(MONTH FROM booking_date) as month,
                SUM(total_price) as revenue
            FROM bookings
            ${whereClause}
            AND status IN ('confirmed', 'completed')
            AND payment_status IN ('paid', 'completed')
            GROUP BY EXTRACT(MONTH FROM booking_date)
            ORDER BY EXTRACT(MONTH FROM booking_date)
        `, { type: sequelize.QueryTypes.SELECT });

        // Fill in missing months with zero values
        const monthlyData = Array(12).fill(null).map((_, index) => {
            const month = index + 1;
            const monthName = moment().month(index).format('MMMM');
            const existingData = result.find(item => Number(item.month) === month);
            
            return {
                month,
                month_name: monthName,
                revenue: existingData ? parseFloat(existingData.revenue) : 0
            };
        });

        return res.json({
            success: true,
            data: monthlyData
        });
    } catch (error) {
        console.error('Error in getMonthlyRevenueData:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Đã có lỗi xảy ra khi lấy dữ liệu doanh thu theo tháng',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
};

/**
 * Get top 5 field owners with the most bookings
 */
const getTopFieldOwners = async (req, res) => {
    try {
        // Find top 5 field owners with the most bookings
        const result = await sequelize.query(`
            SELECT 
                u.id,
                u.name,
                u.email,
                u."profileImage" as avatar_url,
                COUNT(DISTINCT b.id) as booking_count,
                COUNT(DISTINCT f.id) as fields_count,
                SUM(b.total_price) as total_revenue
            FROM users u
            JOIN fields f ON u.id = f.owner_id
            JOIN subfields sf ON f.id = sf.field_id
            JOIN timeslots ts ON sf.id = ts.sub_field_id
            JOIN bookings b ON ts.booking_id = b.id
            WHERE u.role = '${USER_ROLES.OWNER}'
            AND b.status IN ('confirmed', 'completed')
            AND b.payment_status IN ('paid', 'completed')
            GROUP BY u.id, u.name, u.email, u."profileImage"
            ORDER BY booking_count DESC
            LIMIT 5
        `, { type: sequelize.QueryTypes.SELECT });

        // Format the results
        const topOwners = result.map(owner => ({
            id: owner.id,
            full_name: owner.name, // Map name to full_name for frontend compatibility
            email: owner.email,
            avatar_url: owner.avatar_url || '',
            booking_count: parseInt(owner.booking_count),
            fields_count: parseInt(owner.fields_count),
            total_revenue: parseFloat(owner.total_revenue) || 0
        }));

        return res.json({
            success: true,
            data: topOwners
        });
    } catch (error) {
        console.error('Error in getTopFieldOwners:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Đã có lỗi xảy ra khi lấy danh sách chủ sân hàng đầu',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
};

module.exports = {
    getDashboardStatistics,
    getMonthlyRevenueData,
    getTopFieldOwners
};
