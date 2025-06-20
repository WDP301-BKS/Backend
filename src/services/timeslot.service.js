const { TimeSlot, SubField, Field, FieldPricingRule } = require("../models");
const { Op } = require("sequelize");

const generateTimeSlots = async (params) => {
  const {
    subFieldId,
    startDate,
    endDate,
    weekDays,
    timeRanges,
    autoGenerate,
    peakHourStart,
    peakHourEnd,
    peakHourMultiplier,
  } = params;

  // Kiểm tra SubField có tồn tại không và lấy thông tin Field
  const subField = await SubField.findByPk(subFieldId, {
    include: [{
      model: Field,
      as: 'field',
      attributes: ['price_per_hour']
    }]
  });

  if (!subField) {
    throw new Error("SubField không tồn tại");
  } // Lấy giá mặc định từ Field
  const defaultPrice = subField.field?.price_per_hour || 0;

  // Xác định timeRanges sẽ sử dụng
  let finalTimeRanges;
  if (timeRanges && timeRanges.length > 0) {
    // Sử dụng timeRanges thủ công
    finalTimeRanges = timeRanges;
  } else if (autoGenerate) {
    // Tự động sinh timeRanges
    finalTimeRanges = generateTimeRanges(autoGenerate);
  } else {
    throw new Error("Phải cung cấp timeRanges hoặc autoGenerate");
  }

  const slots = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Lặp qua từng ngày trong khoảng thời gian
  for (
    let currentDate = new Date(start);
    currentDate <= end;
    currentDate.setDate(currentDate.getDate() + 1)
  ) {
    const dayOfWeek = currentDate.getDay(); // 0=CN, 1=T2, ...

    // Kiểm tra ngày hiện tại có trong danh sách weekDays không
    if (!weekDays.includes(dayOfWeek)) {
      continue;
    }

    const dateString = currentDate.toISOString().split("T")[0];

    // Tạo slots cho từng khung giờ trong ngày
    for (const timeRange of finalTimeRanges) {
      const startTime = timeRange.start;
      const endTime = timeRange.end;
      let multiplier = 1.0;
      if (isInPeakHour(startTime, peakHourStart, peakHourEnd)) {
        multiplier = peakHourMultiplier;
      }

      slots.push({
        start_time: startTime,
        end_time: endTime,
        date: dateString,
        sub_field_id: subFieldId,
        peak_hour_multiplier: multiplier,
        is_available: true,
      });
    }
  }

  // Xóa các slots cũ trong khoảng thời gian này (nếu có)
  await TimeSlot.destroy({
    where: {
      sub_field_id: subFieldId,
      date: {
        [Op.between]: [startDate, endDate],
      },
    },
  });

  // Bulk insert các slots mới
  const createdSlots = await TimeSlot.bulkCreate(slots);

  return {
    totalSlots: createdSlots.length,
    dateRange: { startDate, endDate },
    weekDays,
    defaultPrice,
    generatedTimeRanges: finalTimeRanges,
    slots: createdSlots,
  };
};

/**
 * Tự động sinh các khung giờ từ giờ bắt đầu đến giờ kết thúc
 * @param {Object} autoGenerate - Thông tin để tự động sinh
 * @param {string} autoGenerate.startTime - Giờ bắt đầu (HH:mm)
 * @param {string} autoGenerate.endTime - Giờ kết thúc (HH:mm)
 * @param {number} autoGenerate.intervalHours - Khoảng cách giữa các khung giờ (giờ)
 * @param {Array} autoGenerate.breakTimes - Các khoảng thời gian nghỉ [{start, end}]
 */
const generateTimeRanges = (autoGenerate) => {
  const {
    startTime,
    endTime,
    intervalHours = 2,
    breakTimes = [],
  } = autoGenerate;

  // Convert time string to minutes
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Convert minutes to time string
  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  };

  // Check if a time range overlaps with break times
  const isInBreakTime = (rangeStart, rangeEnd) => {
    return breakTimes.some((breakTime) => {
      const breakStart = timeToMinutes(breakTime.start);
      const breakEnd = timeToMinutes(breakTime.end);

      // Check if there's any overlap
      return rangeStart < breakEnd && rangeEnd > breakStart;
    });
  };

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const intervalMinutes = intervalHours * 60;

  const timeRanges = [];
  let currentStart = startMinutes;

  while (currentStart < endMinutes) {
    const currentEnd = Math.min(currentStart + intervalMinutes, endMinutes);

    // Kiểm tra xem khung giờ này có trùng với thời gian nghỉ không
    if (!isInBreakTime(currentStart, currentEnd)) {
      timeRanges.push({
        start: minutesToTime(currentStart),
        end: minutesToTime(currentEnd),
      });
    }

    currentStart = currentEnd;
  }

  return timeRanges;
};

/**
 * Kiểm tra thời gian có phải giờ cao điểm không
 * @param {string} currentTime - Thời gian hiện tại (HH:mm)
 * @param {string} peakHourStart - Giờ bắt đầu cao điểm (HH:mm)
 * @param {string} peakHourEnd - Giờ kết thúc cao điểm (HH:mm) - optional
 */
const isInPeakHour = (currentTime, peakHourStart, peakHourEnd = null) => {
  const [currentHour, currentMinute] = currentTime.split(":").map(Number);
  const [peakStartHour, peakStartMinute] = peakHourStart.split(":").map(Number);

  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const peakStartTimeInMinutes = peakStartHour * 60 + peakStartMinute;

  // Nếu không có peakHourEnd, áp dụng từ peakHourStart đến cuối ngày
  if (!peakHourEnd) {
    return currentTimeInMinutes >= peakStartTimeInMinutes;
  }

  // Nếu có peakHourEnd, kiểm tra trong khoảng thời gian
  const [peakEndHour, peakEndMinute] = peakHourEnd.split(":").map(Number);
  const peakEndTimeInMinutes = peakEndHour * 60 + peakEndMinute;
  return (
    currentTimeInMinutes >= peakStartTimeInMinutes &&
    currentTimeInMinutes <= peakEndTimeInMinutes
  );
};

/**
 * Lấy danh sách time slots theo sub field và ngày (có kèm giá)
 * @param {string} subFieldId - ID của sub field
 * @param {string} date - Ngày cần lấy slots (YYYY-MM-DD)
 */
const getTimeSlotsByDate = async (subFieldId, date) => {  const slots = await TimeSlot.findAll({
    where: {
      sub_field_id: subFieldId,
      date: date,
    },
    include: [{
      model: SubField,
      as: 'subfield',
      include: [{
        model: Field,
        as: 'field',
        attributes: ['price_per_hour']
      }]
    }],
    order: [['start_time', 'ASC']]
  });

  // Tính giá cho từng slot
  return slots.map((slot) => {
    const basePrice = slot.subfield?.field?.price_per_hour || 0;
    const finalPrice = basePrice * slot.peak_hour_multiplier;

    return {
      ...slot.toJSON(),
      base_price: basePrice,
      final_price: finalPrice,
    };
  });
};

/**
 * Lấy danh sách time slots theo khoảng thời gian (có kèm giá)
 * @param {string} subFieldId - ID của sub field
 * @param {string} startDate - Ngày bắt đầu
 * @param {string} endDate - Ngày kết thúc
 */
const getTimeSlotsInRange = async (subFieldId, startDate, endDate) => {  const slots = await TimeSlot.findAll({
    where: {
      sub_field_id: subFieldId,
      date: {
        [Op.between]: [startDate, endDate],
      },
    },
    include: [{
      model: SubField,
      as: 'subfield',
      include: [{
        model: Field,
        as: 'field',
        attributes: ['price_per_hour']
      }]
    }],
    order: [['date', 'ASC'], ['start_time', 'ASC']]
  });

  // Tính giá cho từng slot
  return slots.map((slot) => {
    const basePrice = slot.subfield?.field?.price_per_hour || 0;
    const finalPrice = basePrice * slot.peak_hour_multiplier;

    return {
      ...slot.toJSON(),
      base_price: basePrice,
      final_price: finalPrice,
    };
  });
};

/**
 * Xóa time slots theo khoảng thời gian
 * @param {string} subFieldId - ID của sub field
 * @param {string} startDate - Ngày bắt đầu
 * @param {string} endDate - Ngày kết thúc
 */
const deleteTimeSlotsInRange = async (subFieldId, startDate, endDate) => {
  const deletedCount = await TimeSlot.destroy({
    where: {
      sub_field_id: subFieldId,
      date: {
        [Op.between]: [startDate, endDate],
      },
      booking_id: null, // Chỉ xóa slots chưa được đặt
    },
  });

  return deletedCount;
};

/**
 * Tính giá cho một time slot cụ thể
 * @param {string} subFieldId - ID của sub field
 * @param {string} startTime - Thời gian bắt đầu (HH:mm)
 * @param {number} peakHourMultiplier - Hệ số cao điểm
 */
const calculateSlotPrice = async (
  subFieldId,
  startTime,
  peakHourMultiplier = 1.0
) => {
  const subField = await SubField.findByPk(subFieldId, {
    include: [{
      model: Field,
      as: 'field',
      attributes: ['price_per_hour']
    }]
  });

  if (!subField) {
    throw new Error("SubField không tồn tại");
  }

  const basePrice = subField.field?.price_per_hour || 0;
  const finalPrice = basePrice * peakHourMultiplier;

  return {
    base_price: basePrice,
    peak_hour_multiplier: peakHourMultiplier,
    final_price: finalPrice,
  };
};

/**
 * Lấy thông tin giá của một time slot
 * @param {string} slotId - ID của time slot
 */
const getSlotPriceInfo = async (slotId) => {
  const slot = await TimeSlot.findByPk(slotId, {
    include: [{
      model: SubField,
      as: 'subfield',
      include: [{
        model: Field,
        as: 'field',
        attributes: ['id', 'price_per_hour']
      }]
    }]
  });

  if (!slot) {
    throw new Error("Time slot không tồn tại");
  }

  const fieldId = slot.subfield.field.id;
  const startTime = slot.start_time;
  
  // Tính giá dựa trên FieldPricingRule
  const priceInfo = await calculatePriceWithPricingRule(fieldId, startTime);

  return {
    slot_id: slot.id,
    start_time: slot.start_time,
    end_time: slot.end_time,
    date: slot.date,
    base_price: priceInfo.basePrice,
    multiplier: priceInfo.multiplier,
    final_price: priceInfo.finalPrice,
    is_available: slot.is_available,
    pricing_rule: priceInfo.pricingRule
  };
};

/**
 * Tạo một time slot mới (manual)
 * @param {Object} slotData - Thông tin slot
 * @param {string} slotData.subFieldId - ID của sub field
 * @param {string} slotData.startTime - Thời gian bắt đầu (HH:mm:ss)
 * @param {string} slotData.endTime - Thời gian kết thúc (HH:mm:ss)
 * @param {string} slotData.date - Ngày (YYYY-MM-DD)
 * @param {number} slotData.peakHourMultiplier - Hệ số cao điểm
 */
const createTimeSlot = async (slotData) => {
  const {
    subFieldId,
    startTime,
    endTime,
    date,
    peakHourMultiplier = 1.0,
  } = slotData;

  // Kiểm tra SubField có tồn tại không
  const subField = await SubField.findByPk(subFieldId);
  if (!subField) {
    throw new Error("SubField không tồn tại");
  }

  // Kiểm tra trùng lặp time slot
  const existingSlot = await TimeSlot.findOne({
    where: {
      sub_field_id: subFieldId,
      date: date,
      start_time: startTime,
      end_time: endTime,
    },
  });

  if (existingSlot) {
    throw new Error("Time slot đã tồn tại trong khung giờ này");
  }

  // Tạo time slot mới
  const newSlot = await TimeSlot.create({
    start_time: startTime,
    end_time: endTime,
    date: date,
    sub_field_id: subFieldId,
    peak_hour_multiplier: peakHourMultiplier,
    is_available: true,
  });

  return newSlot;
};

/**
 * Cập nhật thông tin time slot
 * @param {string} slotId - ID của time slot
 * @param {Object} updateData - Dữ liệu cập nhật
 */
const updateTimeSlot = async (slotId, updateData) => {
  const slot = await TimeSlot.findByPk(slotId);

  if (!slot) {
    throw new Error("Time slot không tồn tại");
  }

  // Không cho phép cập nhật slot đã được đặt
  if (slot.booking_id && updateData.hasOwnProperty("start_time")) {
    throw new Error("Không thể thay đổi thời gian của slot đã được đặt");
  }

  await slot.update(updateData);
  return slot;
};

/**
 * Xóa một time slot
 * @param {string} slotId - ID của time slot
 */
const deleteTimeSlot = async (slotId) => {
  const slot = await TimeSlot.findByPk(slotId);

  if (!slot) {
    throw new Error("Time slot không tồn tại");
  }

  // Không cho phép xóa slot đã được đặt
  if (slot.booking_id) {
    throw new Error("Không thể xóa slot đã được đặt");
  }

  await slot.destroy();
  return { message: "Xóa time slot thành công" };
};

/**
 * Cập nhật trạng thái time slot (available/maintenance)
 * @param {string} slotId - ID của time slot
 * @param {string} status - Trạng thái mới ('available' hoặc 'maintenance')
 * @param {Object} metadata - Thông tin bổ sung (lý do bảo trì, etc.)
 */
const updateTimeSlotStatus = async (slotId, status, metadata = {}) => {
  const slot = await TimeSlot.findByPk(slotId);

  if (!slot) {
    throw new Error("Time slot không tồn tại");
  }

  if (status === "maintenance") {
    await slot.update({
      is_available: false,
      maintenance_reason: metadata.maintenanceReason || "Bảo trì",
      maintenance_staff: metadata.maintenanceStaff || null,
      estimated_completion: metadata.estimatedCompletion || null,
    });
  } else if (status === "available") {
    await slot.update({
      is_available: true,
      maintenance_reason: null,
      maintenance_staff: null,
      estimated_completion: null,
    });
  }

  return slot;
};

/**
 * Bulk update peak hour multiplier for multiple subfields, dates, and time ranges
 * @param {Object} params - Update parameters
 * @param {string[]} params.subFieldIds - Array of subfield IDs
 * @param {string} params.startDate - Start date (optional if applyToAllDates is true)
 * @param {string} params.endDate - End date (optional if applyToAllDates is true)
 * @param {string} params.startTime - Start time for peak hour
 * @param {string} params.endTime - End time for peak hour
 * @param {number} params.peakHourMultiplier - Peak hour multiplier
 * @param {boolean} params.applyToAllDates - Apply to all dates
 */
const bulkUpdatePeakHour = async (params) => {
  const {
    subFieldIds,
    startDate,
    endDate,
    startTime,
    endTime,
    peakHourMultiplier,
    applyToAllDates = false,
  } = params;

  let whereCondition = {
    sub_field_id: {
      [Op.in]: subFieldIds,
    },
  };

  // Add date filter if not applying to all dates
  if (!applyToAllDates && startDate && endDate) {
    whereCondition.date = {
      [Op.between]: [startDate, endDate],
    };
  }

  if (startTime && endTime) {
    whereCondition.start_time = {
      [Op.gte]: startTime, // >= startTime
      [Op.lt]: endTime, // < endTime (không bao gồm endTime)
    };
  } else if (startTime) {
    // Nếu chỉ có startTime, áp dụng từ startTime đến cuối ngày
    whereCondition.start_time = {
      [Op.gte]: startTime,
    };
  }

  const [updatedCount] = await TimeSlot.update(
    { peak_hour_multiplier: peakHourMultiplier },
    { where: whereCondition }
  );
  const updatedSlots = await TimeSlot.findAll({
    where: whereCondition,
    include: [
      {
        model: SubField,
        as: 'subfield',
        required: true, // INNER JOIN để đảm bảo có SubField
        include: [
          {
            model: Field,
            as: 'field',
            required: true, // INNER JOIN để đảm bảo có Field
            attributes: ["price_per_hour"],
          },
        ],
      },
    ],
  });

  for (const slot of updatedSlots) {
    let basePrice = 300000; // Default price    // Safe access to nested properties
    if (
      slot.subfield &&
      slot.subfield.field &&
      slot.subfield.field.price_per_hour
    ) {
      basePrice = slot.subfield.field.price_per_hour;
    } else if (slot.base_price) {
      basePrice = slot.base_price;
    } else {
      // Fallback: Query SubField price separately
      console.warn(`⚠️ Using fallback price query for slot ${slot.id}`);
      basePrice = await getSubFieldPrice(slot.sub_field_id);
    }

    const finalPrice = Math.round(basePrice * slot.peak_hour_multiplier);

    await slot.update({
      base_price: basePrice,
      final_price: finalPrice,
    });
  }

  return {
    updatedCount,
    peakHourMultiplier,
    subFieldsCount: subFieldIds.length,
    appliedTo: applyToAllDates ? "all dates" : `${startDate} to ${endDate}`,
    timeRange: startTime && endTime ? `${startTime} - ${endTime}` : "all times",
    slotsUpdated: updatedSlots.map((s) => ({
      id: s.id,
      start_time: s.start_time,
      old_price: s.base_price,
      new_price: s.final_price,
      multiplier: s.peak_hour_multiplier,
    })),
  };
};

/**
 * Lấy danh sách SubFields của một Field
 * @param {string} fieldId - ID của Field
 */
const getSubFieldsByFieldId = async (fieldId) => {
  const subFields = await SubField.findAll({
    where: { field_id: fieldId },
    include: [{
      model: Field,
      as: 'field',
      attributes: ['price_per_hour']
    }],
    order: [['name', 'ASC']]
  });

  return subFields.map((subField) => ({
    id: subField.id,
    name: subField.name,
    fieldId: subField.field_id,
    fieldType: subField.field_type,
    image: subField.image,
    pricePerHour: subField.field?.price_per_hour || 0,
  }));
};

// Alternative approach - Query SubField price separately if needed
const getSubFieldPrice = async (subFieldId) => {
  try {
    const subField = await SubField.findByPk(subFieldId, {
      include: [
        {
          model: Field,
          as: 'field',
          attributes: ["price_per_hour"],
        },
      ],
    });

    return subField?.field?.price_per_hour || 300000;
  } catch (error) {
    console.error(`Error getting price for subField ${subFieldId}:`, error);
    return 300000; // Default fallback
  }
};

/**
 * Tính giá cho một time slot dựa trên FieldPricingRule
 * @param {string} fieldId - ID của field
 * @param {string} startTime - Thời gian bắt đầu (HH:mm)
 * @returns {Object} - Thông tin giá và hệ số
 */
const calculatePriceWithPricingRule = async (fieldId, startTime) => {
  try {
    // Lấy thông tin field và giá cơ bản
    const field = await Field.findByPk(fieldId);
    if (!field) {
      throw new Error('Field not found');
    }

    const basePrice = parseFloat(field.price_per_hour) || 0;
    const startHour = parseInt(startTime.split(':')[0]);

    // Tìm quy tắc giá phù hợp
    const pricingRule = await FieldPricingRule.findOne({
      where: {
        field_id: fieldId,
        from_hour: { [Op.lte]: startHour },
        to_hour: { [Op.gt]: startHour }
      }
    });

    const multiplier = pricingRule ? parseFloat(pricingRule.multiplier) : 1.0;
    const finalPrice = basePrice * multiplier;

    return {
      basePrice,
      multiplier,
      finalPrice,
      pricingRule: pricingRule ? {
        id: pricingRule.id,
        from_hour: pricingRule.from_hour,
        to_hour: pricingRule.to_hour,
        multiplier: pricingRule.multiplier
      } : null
    };
  } catch (error) {
    console.error('Error calculating price with pricing rule:', error);
    throw error;
  }
};

module.exports = {
  generateTimeSlots,
  getTimeSlotsByDate,
  getTimeSlotsInRange,
  deleteTimeSlotsInRange,
  calculateSlotPrice,
  getSlotPriceInfo,
  generateTimeRanges,
  isInPeakHour,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  updateTimeSlotStatus,
  bulkUpdatePeakHour,
  getSubFieldsByFieldId,
  getSubFieldPrice,
  calculatePriceWithPricingRule,
};
