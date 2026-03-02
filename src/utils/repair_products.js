
const { Product, Seller } = require('../models');

async function repairProducts() {
  try {
    console.log('Starting product repair script...');

    // 1. Find the first valid seller to use as a fallback
    const fallbackSeller = await Seller.findOne();
    if (!fallbackSeller) {
      console.error('Error: No sellers found in the database. Cannot repair products.');
      return;
    }
    console.log(`Using fallback seller: ${fallbackSeller.store_name} (ID: ${fallbackSeller.id})`);

    // 2. Find all products with null seller_id
    const productsToRepair = await Product.findAll({
      where: { seller_id: null }
    });

    if (productsToRepair.length === 0) {
      console.log('No products found with missing seller_id.');
      return;
    }

    console.log(`Found ${productsToRepair.length} products to repair.`);

    // 3. Update each product
    for (const product of productsToRepair) {
      console.log(`Repairing Product ${product.id}: "${product.name}"...`);
      await product.update({ seller_id: fallbackSeller.id });
      console.log(`✓ Product ${product.id} updated with seller_id ${fallbackSeller.id}`);
    }

    console.log('\nProduct repair completed successfully.');
  } catch (error) {
    console.error('Error during product repair:', error);
  } finally {
    process.exit();
  }
}

repairProducts();
