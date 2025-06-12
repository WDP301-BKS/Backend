const { body, validationResult } = require('express-validator');

/**
 * Validation rules cho generate time slots
 */
const validateGenerateTimeSlots = [
  body('subFieldId')
    .isUUID()
    .withMessage('subFieldId phải là UUID hợp lệ'),
    
  body('startDate')
    .isISO8601()
    .withMessage('startDate phải là ngày hợp lệ (YYYY-MM-DD)'),
    
  body('endDate')
    .isISO8601()
    .withMessage('endDate phải là ngày hợp lệ (YYYY-MM-DD)')
    .custom((endDate, { req }) => {
      if (new Date(endDate) < new Date(req.body.startDate)) {
        throw new Error('endDate phải sau hoặc bằng startDate');
      }
      return true;
    }),
    
  body('weekDays')
    .isArray({ min: 1 })
    .withMessage('weekDays phải là mảng có ít nhất 1 phần tử')
    .custom((weekDays) => {
      const validDays = [0, 1, 2, 3, 4, 5, 6];
      const invalidDays = weekDays.filter(day => !validDays.includes(day));
      if (invalidDays.length > 0) {
        throw new Error('weekDays chứa ngày không hợp lệ. Chỉ chấp nhận 0-6');
      }
      return true;
    }),
    
  // Hỗ trợ cả 2 cách: timeRanges thủ công hoặc autoGenerate
  body()
    .custom((body) => {
      const hasTimeRanges = body.timeRanges && Array.isArray(body.timeRanges);
      const hasAutoGenerate = body.autoGenerate && body.autoGenerate.startTime && body.autoGenerate.endTime;
      
      if (!hasTimeRanges && !hasAutoGenerate) {
        throw new Error('Phải cung cấp timeRanges hoặc autoGenerate');
      }
      
      if (hasTimeRanges && hasAutoGenerate) {
        throw new Error('Chỉ được sử dụng timeRanges hoặc autoGenerate, không được cả hai');
      }
      
      return true;
    }),
    
  // Validation cho timeRanges (cách thủ công)
  body('timeRanges')
    .if(body('autoGenerate').not().exists())
    .isArray({ min: 1 })
    .withMessage('timeRanges phải là mảng có ít nhất 1 phần tử khi không sử dụng autoGenerate'),
    
  body('timeRanges.*.start')
    .if(body('timeRanges').exists())
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('start time phải có format HH:mm'),
      
  body('timeRanges.*.end')
    .if(body('timeRanges').exists())
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('end time phải có format HH:mm'),

  // Validation cho autoGenerate (cách tự động)
  body('autoGenerate.startTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('autoGenerate.startTime phải có format HH:mm'),
    
  body('autoGenerate.endTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('autoGenerate.endTime phải có format HH:mm'),
    
  body('autoGenerate.intervalHours')
    .optional()
    .isFloat({ min: 0.5, max: 12 })
    .withMessage('autoGenerate.intervalHours phải từ 0.5 đến 12 giờ'),
    
  body('autoGenerate.breakTimes')
    .optional()
    .isArray()
    .withMessage('autoGenerate.breakTimes phải là mảng'),
    
  body('autoGenerate.breakTimes.*.start')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('break time start phải có format HH:mm'),
    
  body('autoGenerate.breakTimes.*.end')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('break time end phải có format HH:mm'),
    
  body('peakHourStart')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('peakHourStart phải có format HH:mm'),
    
  body('peakHourMultiplier')
    .isFloat({ min: 1, max: 5 })
    .withMessage('peakHourMultiplier phải từ 1.0 đến 5.0')
];

/**
 * Middleware để xử lý validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu đầu vào không hợp lệ',
      statusCode: 400,
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  validateGenerateTimeSlots,
  handleValidationErrors
};
