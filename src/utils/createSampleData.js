const { sequelize, SubField, TimeSlot } = require('../models');

async function createSampleTimeSlots() {
  try {
    await sequelize.authenticate();
    
    // Get subfields for field ID 123e4567-e89b-12d3-a456-426614174000
    const subfields = await SubField.findAll({
      where: { field_id: '123e4567-e89b-12d3-a456-426614174000' }
    });
    
    if (subfields.length === 0) {
      console.log('No subfields found for this field');
      return;
    }
    
    console.log('Found subfields:', subfields.map(s => ({ id: s.id, name: s.name })));
    
    // Create some sample time slots for today
    const today = new Date().toISOString().split('T')[0];
    
    // Delete existing slots for today
    await TimeSlot.destroy({
      where: { date: today }
    });
    
    // Create booked slots for testing
    const slotsToCreate = [
      {
        start_time: '09:00:00',
        end_time: '10:00:00', 
        date: today,
        sub_field_id: subfields[0].id, // Sân A
        is_available: false
      },
      {
        start_time: '14:00:00',
        end_time: '15:00:00',
        date: today,
        sub_field_id: subfields[1].id, // Sân B
        is_available: false
      },
      {
        start_time: '18:00:00',
        end_time: '19:00:00',
        date: today,
        sub_field_id: subfields[2].id, // Sân C
        is_available: false
      }
    ];
    
    const createdSlots = await TimeSlot.bulkCreate(slotsToCreate);
    
    console.log('Sample time slots created successfully:', createdSlots.length);
    
    // Verify created slots
    const verifySlots = await TimeSlot.findAll({
      where: { date: today },
      include: [{ model: SubField, attributes: ['name', 'field_id'] }]
    });
    
    console.log('Verification - Created slots:', verifySlots.map(slot => ({
      id: slot.id,
      startTime: slot.start_time,
      subField: slot.subfield?.name,
      subFieldId: slot.sub_field_id
    })));
    
    return verifySlots;
    
  } catch (error) {
    console.error('Error creating sample time slots:', error.message);
    throw error;
  }
}

module.exports = { createSampleTimeSlots };
