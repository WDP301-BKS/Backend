const { TimeSlot, SubField, Field, FieldPricingRule } = require("../models");
const { Op, Sequelize } = require("sequelize");

const { formatDateForDB } = require("../utils/dateUtils"); // Giả sử bạn có một tiện ích để định dạng ngày

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

/**
 * Set maintenance status for time slots with realtime updates
 * @param {Object} params - Maintenance parameters
 * @param {Array} params.subFieldIds - Array of sub field IDs
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD, optional)
 * @param {string} params.startTime - Start time (HH:mm)
 * @param {string} params.endTime - End time (HH:mm)
 * @param {string} params.reason - Maintenance reason
 * @param {string} params.estimatedCompletion - Estimated completion time (optional)
 * @param {Object} io - Socket.IO instance for realtime updates
 */
const setMaintenanceStatus = async (params, io = null) => {
  const { 
    subFieldIds, 
    startDate, 
    endDate, 
    startTime, 
    endTime,
    reason,
    estimatedCompletion 
  } = params;
  try {
    // Format the date range for the query
    const formattedStartDate = formatDateForDB(startDate);
    const formattedEndDate = endDate ? formatDateForDB(endDate) : formattedStartDate;
    
    // Parse time values
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    
    let affectedSlots = [];
    let createdCount = 0;
    let updatedCount = 0;
    
    // Process each subfield and time slot
    for (const subFieldId of subFieldIds) {
      // Generate time slots for the specified time range
      for (let hour = startHour; hour < endHour; hour++) {
        const startTime = `${hour.toString().padStart(2, '0')}:00:00`;
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00:00`;
        
        // Check if slot already exists
        let slot = await TimeSlot.findOne({
          where: {
            sub_field_id: subFieldId,
            date: formattedStartDate,
            start_time: startTime,
            end_time: endTime
          },
          include: [{
            model: SubField,
            as: 'subfield',
            attributes: ['field_id', 'name'],
            required: true
          }]
        });
        
        if (slot) {
          // Update existing slot to maintenance
          if (slot.status !== 'booked') { // Don't override booked slots
            await slot.update({
              status: 'maintenance',
              maintenance_reason: reason,
              maintenance_until: estimatedCompletion,
              updated_at: new Date()
            });
            affectedSlots.push(slot);
            updatedCount++;
          } else {
            affectedSlots.push(slot);
            updatedCount++;
          }
        } else {
          // Create new slot for maintenance
          slot = await TimeSlot.create({
            sub_field_id: subFieldId,
            date: formattedStartDate,
            start_time: startTime,
            end_time: endTime,
            status: 'maintenance',
            maintenance_reason: reason,
            maintenance_until: estimatedCompletion,
            booking_id: null,
            created_at: new Date(),
            updated_at: new Date()
          });
          
          // Load the subfield relationship for socket emission
          await slot.reload({
            include: [{
              model: SubField,
              as: 'subfield',
              attributes: ['field_id', 'name'],
              required: true
            }]
          });
          
          affectedSlots.push(slot);
          createdCount++;
        }
      }
    }
    
    if (affectedSlots.length === 0) {
      return {
        affected: 0,
        slots: 0,
        message: 'Không có khung giờ nào phù hợp để đặt bảo trì'
      };
    }    // Group affected slots by field_id for emitting realtime events
    if (io) {
      const fieldSlots = {};
      affectedSlots.forEach(slot => {
        const fieldId = slot.subfield.field_id;
        if (!fieldSlots[fieldId]) {
          fieldSlots[fieldId] = [];
        }
        fieldSlots[fieldId].push({
          id: slot.id,
          subFieldId: slot.sub_field_id,
          subFieldName: slot.subfield.name,
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time,
          status: 'maintenance',
          maintenanceReason: reason,
          maintenanceUntil: estimatedCompletion
        });
      });      // Emit realtime updates to all clients viewing affected fields
      Object.keys(fieldSlots).forEach(fieldId => {
        const formattedSlots = fieldSlots[fieldId].map(slot => ({
          id: slot.id,
          subFieldId: slot.sub_field_id,
          subFieldName: slot.subFieldName || 'Unknown',
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time,
          status: 'maintenance',
          maintenanceReason: reason,
          maintenanceUntil: estimatedCompletion
        }));
        
        io.to(`field-${fieldId}`).emit('timeslot-maintenance-update', {
          type: 'maintenance-added',
          fieldId,
          affectedSlots: formattedSlots,
          timestamp: new Date().toISOString()
        });
      });
    }
      return {
      affected: createdCount + updatedCount,
      slots: affectedSlots.length,
      created: createdCount,
      updated: updatedCount,
      affectedSlots: affectedSlots.map(slot => ({
        id: slot.id,
        subFieldId: slot.sub_field_id,
        date: slot.date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        status: slot.status
      }))
    };
  } catch (error) {
    console.error('Error setting maintenance status:', error);
    throw error;
  }
};

/**
 * Revert maintenance status back to available with realtime updates
 * @param {Array} slotIds - Array of time slot IDs to revert
 * @param {Object} io - Socket.IO instance for realtime updates
 */
const revertMaintenanceStatus = async (slotIds, io = null) => {
  try {
    // First get the slots to know which field they belong to
    const slotsToUpdate = await TimeSlot.findAll({
      where: {
        id: { [Op.in]: slotIds },
        status: 'maintenance'
      },
      include: [{
        model: SubField,
        as: 'subfield',
        attributes: ['field_id', 'name'],
        required: true
      }]
    });
    
    if (slotsToUpdate.length === 0) {
      return {
        affected: 0,
        message: 'Không có khung giờ bảo trì nào để hủy'
      };
    }
    
    // Update slots
    const [updatedCount] = await TimeSlot.update({
      status: 'available',
      maintenance_reason: null,
      maintenance_until: null,
      updated_at: new Date()
    }, {
      where: {
        id: { [Op.in]: slotIds },
        status: 'maintenance'
      }
    });
    
    // Group by field for realtime updates
    if (io) {
      const fieldSlots = {};
      slotsToUpdate.forEach(slot => {
        const fieldId = slot.subfield.field_id;
        if (!fieldSlots[fieldId]) {
          fieldSlots[fieldId] = [];
        }
        fieldSlots[fieldId].push({
          id: slot.id,
          subFieldId: slot.sub_field_id,
          subFieldName: slot.subfield.name,
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time,
          status: 'available'
        });
      });
      
      // Emit realtime updates
      Object.keys(fieldSlots).forEach(fieldId => {
        io.to(`field-${fieldId}`).emit('timeslot-maintenance-update', {
          type: 'maintenance-removed',
          fieldId,
          affectedSlots: fieldSlots[fieldId],
          timestamp: new Date().toISOString()
        });
      });
    }
    
    return {
      affected: updatedCount,
      revertedSlots: slotsToUpdate.map(slot => ({
        id: slot.id,
        subFieldId: slot.sub_field_id,
        date: slot.date,
        startTime: slot.start_time,
        endTime: slot.end_time
      }))
    };
  } catch (error) {
    console.error('Error reverting maintenance status:', error);
    throw error;
  }
};

/**
 * Toggle maintenance status for a single time slot
 * @param {string} slotId - Time slot ID
 * @param {string} reason - Maintenance reason (required if setting to maintenance)
 * @param {string} estimatedCompletion - Estimated completion time (optional)
 * @param {Object} io - Socket.IO instance for realtime updates
 */
const toggleMaintenanceStatus = async (slotId, reason = null, estimatedCompletion = null, io = null) => {
  try {
    // Get the current slot
    const slot = await TimeSlot.findByPk(slotId, {
      include: [{
        model: SubField,
        as: 'subfield',
        attributes: ['field_id', 'name'],
        required: true
      }]
    });
    
    if (!slot) {
      throw new Error('Time slot not found');
    }
    
    // Don't allow changing booked slots
    if (slot.status === 'booked') {
      throw new Error('Cannot change maintenance status of booked time slots');
    }
    
    const newStatus = slot.status === 'maintenance' ? 'available' : 'maintenance';
    const updateData = {
      status: newStatus,
      updated_at: new Date()
    };
    
    if (newStatus === 'maintenance') {
      if (!reason) {
        throw new Error('Maintenance reason is required');
      }
      updateData.maintenance_reason = reason;
      updateData.maintenance_until = estimatedCompletion;
    } else {
      updateData.maintenance_reason = null;
      updateData.maintenance_until = null;
    }
    
    // Update the slot
    await TimeSlot.update(updateData, {
      where: { id: slotId }
    });
    
    // Emit realtime update
    if (io) {
      const fieldId = slot.subfield.field_id;
      io.to(`field-${fieldId}`).emit('timeslot-maintenance-update', {
        type: newStatus === 'maintenance' ? 'maintenance-added' : 'maintenance-removed',
        fieldId,
        affectedSlots: [{
          id: slot.id,
          subFieldId: slot.sub_field_id,
          subFieldName: slot.subfield.name,
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time,
          status: newStatus,
          maintenanceReason: newStatus === 'maintenance' ? reason : null,
          maintenanceUntil: newStatus === 'maintenance' ? estimatedCompletion : null
        }],
        timestamp: new Date().toISOString()
      });
    }
    
    return {
      success: true,
      slot: {
        id: slot.id,
        status: newStatus,
        maintenanceReason: newStatus === 'maintenance' ? reason : null,
        maintenanceUntil: newStatus === 'maintenance' ? estimatedCompletion : null
      }
    };
  } catch (error) {
    console.error('Error toggling maintenance status:', error);
    throw error;
  }
};

/**
 * Get a time slot by ID
 * @param {string} slotId - ID of the time slot
 */
const getTimeSlotById = async (slotId) => {
  try {
    const slot = await TimeSlot.findByPk(slotId, {
      include: [{
        model: SubField,
        as: 'subfield',
        attributes: ['id', 'name', 'field_id'],
        include: [{
          model: Field,
          as: 'field',
          attributes: ['id', 'name', 'price_per_hour']
        }]
      }]
    });

    if (!slot) {
      return null;
    }

    return {
      id: slot.id,
      date: slot.date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      status: slot.status,
      isAvailable: slot.status === 'available',
      maintenanceReason: slot.maintenance_reason,
      maintenanceUntil: slot.maintenance_until,
      subField: slot.subfield ? {
        id: slot.subfield.id,
        name: slot.subfield.name,
        fieldId: slot.subfield.field_id,
        field: slot.subfield.field
      } : null,
      createdAt: slot.created_at,
      updatedAt: slot.updated_at
    };
  } catch (error) {
    console.error('Error getting time slot by ID:', error);
    throw error;
  }
};

/**
 * Update a time slot
 * @param {string} slotId - ID of the time slot
 * @param {object} updateData - Data to update
 */
const updateTimeSlot = async (slotId, updateData) => {
  try {
    const slot = await TimeSlot.findByPk(slotId);
    
    if (!slot) {
      throw new Error('Time slot not found');
    }

    // Update the slot
    await TimeSlot.update({
      ...updateData,
      updated_at: new Date()
    }, {
      where: { id: slotId }
    });

    // Return updated slot
    return await getTimeSlotById(slotId);
  } catch (error) {
    console.error('Error updating time slot:', error);
    throw error;
  }
};

module.exports = {
  getSubFieldsByFieldId,
  getSubFieldPrice,
  calculatePriceWithPricingRule,
  setMaintenanceStatus,
  revertMaintenanceStatus,
  toggleMaintenanceStatus,
  getTimeSlotById,
  updateTimeSlot,
};
