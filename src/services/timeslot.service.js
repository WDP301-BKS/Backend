const { TimeSlot, SubField, Field, FieldPricingRule } = require("../models");
const { Op } = require("sequelize");

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
  getSubFieldsByFieldId,
  getSubFieldPrice,
  calculatePriceWithPricingRule,
};
