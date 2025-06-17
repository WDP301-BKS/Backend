const { sequelize } = require('./src/config/db.config');

async function checkDatabase() {
  try {
    // Use PostgreSQL syntax
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    console.log('✅ Columns in users table:');
    results.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    // Specifically check for our new column
    const identityCardBackCol = results.find(col => col.column_name === 'identity_card_back_image');
    if (identityCardBackCol) {
      console.log('\n✅ SUCCESS: identity_card_back_image column has been added successfully!');
      console.log(`   Type: ${identityCardBackCol.data_type}`);
      console.log(`   Nullable: ${identityCardBackCol.is_nullable}`);
    } else {
      console.log('\n❌ ERROR: identity_card_back_image column not found!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
