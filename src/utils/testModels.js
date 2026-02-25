const { sequelize } = require('../models');
require('dotenv').config();

async function testModelSync() {
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✓ Database connection successful');

    console.log('\nSynchronizing models...');
    await sequelize.sync({ alter: true });
    console.log('✓ All models synchronized successfully');

    console.log('\nModel associations verified:');
    const models = sequelize.models;
    Object.keys(models).forEach(modelName => {
      const model = models[modelName];
      const associations = Object.keys(model.associations);
      console.log(`  ${modelName}: ${associations.length} associations`);
      associations.forEach(assoc => {
        console.log(`    - ${assoc} (${model.associations[assoc].associationType})`);
      });
    });

    console.log('\n✓ Model synchronization test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Model synchronization test failed:', error);
    process.exit(1);
  }
}

testModelSync();
