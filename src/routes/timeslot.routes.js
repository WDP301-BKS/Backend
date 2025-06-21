const express = require("express");
const timeSlotController = require("../controllers/timeslot.controller");

const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

// API lấy sub fields của một field
router.get(
  "/field/:fieldId/subfields",
  authMiddleware,
  timeSlotController.getSubFieldsByFieldId
);

module.exports = router;
