const express = require("express");
const timeSlotController = require("../controllers/timeslot.controller");
const {
  validateGenerateTimeSlots,
  handleValidationErrors,
} = require("../middlewares/timeslot.validation");
const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

// API sinh tự động time slots
router.post(
  "/generate",
  authMiddleware,
  validateGenerateTimeSlots,
  handleValidationErrors,
  timeSlotController.generateTimeSlots
);

// API tạo time slot mới (manual)
router.post(
  "/create",
  authMiddleware,
  timeSlotController.createTimeSlot
);

// API lấy time slots theo ngày
router.get(
  "/:subFieldId/date/:date",
  authMiddleware,
  timeSlotController.getTimeSlotsByDate
);

// API lấy time slots theo khoảng thời gian
router.get(
  "/:subFieldId/range",
  authMiddleware,
  timeSlotController.getTimeSlotsInRange
);

// API lấy thông tin giá của một slot
router.get(
  "/:slotId/price",
  authMiddleware,
  timeSlotController.getSlotPriceInfo
);

// API cập nhật time slot
router.put(
  "/:slotId",
  authMiddleware,
  timeSlotController.updateTimeSlot
);

// API cập nhật trạng thái time slot
router.patch(
  "/:slotId/status",
  authMiddleware,
  timeSlotController.updateTimeSlotStatus
);

// API cập nhật hệ số peak hour cho time slot
router.patch(
  "/:slotId/peak-hour",
  authMiddleware,
  timeSlotController.updatePeakHourMultiplier
);

// API cập nhật hệ số peak hour theo bulk
router.patch(
  "/bulk-update-peak-hour",
  authMiddleware,
  timeSlotController.bulkUpdatePeakHour
);

// API xóa time slot riêng lẻ
router.delete(
  "/:slotId",
  authMiddleware,
  timeSlotController.deleteTimeSlot
);

// API xóa time slots theo khoảng thời gian (yêu cầu authentication)
router.delete(
  "/:subFieldId/range",
  authMiddleware,
  timeSlotController.deleteTimeSlotsInRange
);

// API lấy sub fields của một field
router.get(
  "/field/:fieldId/subfields",
  authMiddleware,
  timeSlotController.getSubFieldsByFieldId
);

module.exports = router;
