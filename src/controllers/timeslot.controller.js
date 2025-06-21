const timeSlotService = require('../services/timeslot.service');
const responseFormatter = require('../utils/responseFormatter');


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
  updatePeakHourMultiplier,
  bulkUpdatePeakHour,
  getSubFieldsByFieldId
};
