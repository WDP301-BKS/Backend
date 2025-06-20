const timeSlotService = require('../services/timeslot.service');
const responseFormatter = require('../utils/responseFormatter');

/**
 * API sinh tự động time slots
 * POST /api/slots/generate
 */
const generateTimeSlots = async (req, res) => {
  try {    const {
      subFieldId,
      startDate,
      endDate,
      weekDays,
      timeRanges,
      autoGenerate,
      peakHourStart,
      peakHourMultiplier
    } = req.body;

    const result = await timeSlotService.generateTimeSlots({
      subFieldId,
      startDate,
      endDate,
      weekDays,
      timeRanges,
      autoGenerate,
      peakHourStart,
      peakHourMultiplier
    });

    return res.status(201).json(responseFormatter.success(result, 'Sinh time slots thành công', 201));
  } catch (error) {
    console.error('Error generating time slots:', error);
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi sinh time slots', 500));
  }
};

/**
 * API lấy time slots theo ngày
 * GET /api/slots/:subFieldId/date/:date
 */
const getTimeSlotsByDate = async (req, res) => {
  try {
    const { subFieldId, date } = req.params;

    const slots = await timeSlotService.getTimeSlotsByDate(subFieldId, date);

    return res.json(responseFormatter.success(slots, 'Lấy time slots thành công'));
  } catch (error) {
    console.error('Error getting time slots by date:', error);
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi lấy time slots', 500));
  }
};

/**
 * API lấy time slots theo khoảng thời gian
 * GET /api/slots/:subFieldId/range?startDate=...&endDate=...
 */
const getTimeSlotsInRange = async (req, res) => {
  try {
    const { subFieldId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json(responseFormatter.error('startDate và endDate là bắt buộc', 400));
    }

    const slots = await timeSlotService.getTimeSlotsInRange(subFieldId, startDate, endDate);

    return res.json(responseFormatter.success(slots, 'Lấy time slots thành công'));
  } catch (error) {
    console.error('Error getting time slots in range:', error);
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi lấy time slots', 500));
  }
};

/**
 * API xóa time slots theo khoảng thời gian
 * DELETE /api/slots/:subFieldId/range?startDate=...&endDate=...
 */
const deleteTimeSlotsInRange = async (req, res) => {
  try {
    const { subFieldId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json(responseFormatter.error('startDate và endDate là bắt buộc', 400));
    }

    const deletedCount = await timeSlotService.deleteTimeSlotsInRange(subFieldId, startDate, endDate);

    return res.json(responseFormatter.success(
      { deletedCount }, 
      `Đã xóa ${deletedCount} time slots`
    ));
  } catch (error) {
    console.error('Error deleting time slots:', error);
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi xóa time slots', 500));
  }
};

/**
 * API lấy thông tin giá của một time slot
 * GET /api/slots/:slotId/price
 */
const getSlotPriceInfo = async (req, res) => {
  try {
    const { slotId } = req.params;

    const priceInfo = await timeSlotService.getSlotPriceInfo(slotId);

    return res.json(responseFormatter.success(priceInfo, 'Lấy thông tin giá thành công'));
  } catch (error) {
    console.error('Error getting slot price info:', error);
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi lấy thông tin giá', 500));
  }
};

/**
 * API tạo time slot mới (manual)
 * POST /api/slots/create
 */
const createTimeSlot = async (req, res) => {
  try {
    const { subFieldId, startTime, endTime, date, peakHourMultiplier } = req.body;

    const newSlot = await timeSlotService.createTimeSlot({
      subFieldId,
      startTime,
      endTime,
      date,
      peakHourMultiplier
    });

    return res.status(201).json(responseFormatter.success(newSlot, 'Tạo time slot thành công', 201));
  } catch (error) {
    console.error('Error creating time slot:', error);
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi tạo time slot', 500));
  }
};

/**
 * API cập nhật time slot
 * PUT /api/slots/:slotId
 */
const updateTimeSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    const updateData = req.body;

    const updatedSlot = await timeSlotService.updateTimeSlot(slotId, updateData);

    return res.json(responseFormatter.success(updatedSlot, 'Cập nhật time slot thành công'));
  } catch (error) {
    console.error('Error updating time slot:', error);
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi cập nhật time slot', 500));
  }
};

/**
 * API xóa time slot
 * DELETE /api/slots/:slotId
 */
const deleteTimeSlot = async (req, res) => {
  try {
    const { slotId } = req.params;

    const result = await timeSlotService.deleteTimeSlot(slotId);

    return res.json(responseFormatter.success(result, 'Xóa time slot thành công'));
  } catch (error) {
    console.error('Error deleting time slot:', error);
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi xóa time slot', 500));
  }
};

/**
 * API cập nhật trạng thái time slot
 * PATCH /api/slots/:slotId/status
 */
const updateTimeSlotStatus = async (req, res) => {
  try {
    const { slotId } = req.params;
    const { status, metadata } = req.body;

    const updatedSlot = await timeSlotService.updateTimeSlotStatus(slotId, status, metadata);

    return res.json(responseFormatter.success(updatedSlot, 'Cập nhật trạng thái thành công'));
  } catch (error) {
    console.error('Error updating time slot status:', error);
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi cập nhật trạng thái', 500));
  }
};

/**
 * API lấy danh sách sub fields của một field
 * GET /api/slots/field/:fieldId/subfields
 */
const getSubFieldsByFieldId = async (req, res) => {
  try {
    const { fieldId } = req.params;

    const subFields = await timeSlotService.getSubFieldsByFieldId(fieldId);

    return res.json(responseFormatter.success(subFields, 'Lấy danh sách sub fields thành công'));
  } catch (error) {
    console.error('Error getting sub fields:', error);
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi lấy danh sách sub fields', 500));
  }
};

/**
 * API cập nhật hệ số peak hour cho time slot
 * PATCH /api/slots/:slotId/peak-hour
 */
const updatePeakHourMultiplier = async (req, res) => {
  try {
    const { slotId } = req.params;
    const { peakHourMultiplier, peakHourStart } = req.body;

    // Validate peak hour multiplier
    if (peakHourMultiplier < 1 || peakHourMultiplier > 5) {
      return res.status(400).json(responseFormatter.error('Hệ số peak hour phải từ 1.0 đến 5.0', 400));
    }

    // Update the time slot with new peak hour multiplier
    const updatedSlot = await timeSlotService.updateTimeSlot(slotId, {
      peak_hour_multiplier: peakHourMultiplier
    });

    return res.json(responseFormatter.success(updatedSlot, 'Cập nhật hệ số peak hour thành công'));
  } catch (error) {
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi cập nhật hệ số peak hour', 500));
  }
};

/**
 * API cập nhật hệ số peak hour cho nhiều time slots theo điều kiện
 * PATCH /api/slots/bulk-update-peak-hour
 */
const bulkUpdatePeakHour = async (req, res) => {
  try {
    const { 
      subFieldIds,  // Changed to array
      startDate,
      endDate,
      startTime, 
      endTime, 
      peakHourMultiplier,
      applyToAllDates = false 
    } = req.body;

    // Validate input
    if (!subFieldIds || !Array.isArray(subFieldIds) || subFieldIds.length === 0) {
      return res.status(400).json(responseFormatter.error('Vui lòng chọn ít nhất một sân', 400));
    }

    // Validate peak hour multiplier
    if (peakHourMultiplier < 1 || peakHourMultiplier > 5) {
      return res.status(400).json(responseFormatter.error('Hệ số peak hour phải từ 1.0 đến 5.0', 400));
    }

    const result = await timeSlotService.bulkUpdatePeakHour({
      subFieldIds,
      startDate,
      endDate,
      startTime,
      endTime,
      peakHourMultiplier,
      applyToAllDates
    });

    return res.json(responseFormatter.success(result, 'Cập nhật hệ số peak hour thành công'));
  } catch (error) {
    return res.status(500).json(responseFormatter.error(error.message || 'Lỗi cập nhật hệ số peak hour', 500));
  }
};

module.exports = {
  generateTimeSlots,
  getTimeSlotsByDate,
  getTimeSlotsInRange,
  deleteTimeSlotsInRange,
  getSlotPriceInfo,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  updateTimeSlotStatus,
  updatePeakHourMultiplier,
  bulkUpdatePeakHour,
  getSubFieldsByFieldId
};
