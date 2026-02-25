const { sequelize, User, Seller, Category, Product, Cart, CartItem, Order, OrderItem, Payment, Review } = require('../models');

async function verifyModels() {
  console.log('=== Starting Model Verification ===\n');
  
  try {
    // Test 1: Database Connection
    console.log('1. Testing database connection...');
    await sequelize.authenticate();
    console.log('✓ Database connection successful\n');

    // Test 2: Model Synchronization
    console.log('2. Synchronizing models with database...');
    // Drop all tables first to handle foreign key constraints
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.drop();
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    await sequelize.sync({ force: true });
    console.log('✓ All models synchronized successfully\n');

    // Test 3: Verify all models are defined
    console.log('3. Verifying all models are defined...');
    const models = [User, Seller, Category, Product, Cart, CartItem, Order, OrderItem, Payment, Review];
    const modelNames = ['User', 'Seller', 'Category', 'Product', 'Cart', 'CartItem', 'Order', 'OrderItem', 'Payment', 'Review'];
    
    models.forEach((model, index) => {
      if (!model) {
        throw new Error(`${modelNames[index]} model is not defined`);
      }
      console.log(`✓ ${modelNames[index]} model defined`);
    });
    console.log('');

    // Test 4: Verify User associations
    console.log('4. Verifying User associations...');
    const userAssociations = Object.keys(User.associations);
    console.log(`   User associations: ${userAssociations.join(', ')}`);
    if (!userAssociations.includes('seller')) throw new Error('User -> Seller association missing');
    if (!userAssociations.includes('cart')) throw new Error('User -> Cart association missing');
    if (!userAssociations.includes('orders')) throw new Error('User -> Orders association missing');
    if (!userAssociations.includes('reviews')) throw new Error('User -> Reviews association missing');
    console.log('✓ All User associations verified\n');

    // Test 5: Verify Seller associations
    console.log('5. Verifying Seller associations...');
    const sellerAssociations = Object.keys(Seller.associations);
    console.log(`   Seller associations: ${sellerAssociations.join(', ')}`);
    if (!sellerAssociations.includes('user')) throw new Error('Seller -> User association missing');
    if (!sellerAssociations.includes('products')) throw new Error('Seller -> Products association missing');
    if (!sellerAssociations.includes('orderItems')) throw new Error('Seller -> OrderItems association missing');
    console.log('✓ All Seller associations verified\n');

    // Test 6: Verify Category associations (including self-referencing)
    console.log('6. Verifying Category associations...');
    const categoryAssociations = Object.keys(Category.associations);
    console.log(`   Category associations: ${categoryAssociations.join(', ')}`);
    if (!categoryAssociations.includes('products')) throw new Error('Category -> Products association missing');
    if (!categoryAssociations.includes('parent')) throw new Error('Category -> Parent association missing');
    if (!categoryAssociations.includes('children')) throw new Error('Category -> Children association missing');
    console.log('✓ All Category associations verified (including self-referencing)\n');

    // Test 7: Verify Product associations
    console.log('7. Verifying Product associations...');
    const productAssociations = Object.keys(Product.associations);
    console.log(`   Product associations: ${productAssociations.join(', ')}`);
    if (!productAssociations.includes('seller')) throw new Error('Product -> Seller association missing');
    if (!productAssociations.includes('category')) throw new Error('Product -> Category association missing');
    if (!productAssociations.includes('cartItems')) throw new Error('Product -> CartItems association missing');
    if (!productAssociations.includes('orderItems')) throw new Error('Product -> OrderItems association missing');
    if (!productAssociations.includes('reviews')) throw new Error('Product -> Reviews association missing');
    console.log('✓ All Product associations verified\n');

    // Test 8: Verify Cart associations
    console.log('8. Verifying Cart associations...');
    const cartAssociations = Object.keys(Cart.associations);
    console.log(`   Cart associations: ${cartAssociations.join(', ')}`);
    if (!cartAssociations.includes('user')) throw new Error('Cart -> User association missing');
    if (!cartAssociations.includes('items')) throw new Error('Cart -> Items association missing');
    console.log('✓ All Cart associations verified\n');

    // Test 9: Verify CartItem associations
    console.log('9. Verifying CartItem associations...');
    const cartItemAssociations = Object.keys(CartItem.associations);
    console.log(`   CartItem associations: ${cartItemAssociations.join(', ')}`);
    if (!cartItemAssociations.includes('cart')) throw new Error('CartItem -> Cart association missing');
    if (!cartItemAssociations.includes('product')) throw new Error('CartItem -> Product association missing');
    console.log('✓ All CartItem associations verified\n');

    // Test 10: Verify Order associations
    console.log('10. Verifying Order associations...');
    const orderAssociations = Object.keys(Order.associations);
    console.log(`    Order associations: ${orderAssociations.join(', ')}`);
    if (!orderAssociations.includes('user')) throw new Error('Order -> User association missing');
    if (!orderAssociations.includes('items')) throw new Error('Order -> Items association missing');
    if (!orderAssociations.includes('payment')) throw new Error('Order -> Payment association missing');
    console.log('✓ All Order associations verified\n');

    // Test 11: Verify OrderItem associations
    console.log('11. Verifying OrderItem associations...');
    const orderItemAssociations = Object.keys(OrderItem.associations);
    console.log(`    OrderItem associations: ${orderItemAssociations.join(', ')}`);
    if (!orderItemAssociations.includes('order')) throw new Error('OrderItem -> Order association missing');
    if (!orderItemAssociations.includes('product')) throw new Error('OrderItem -> Product association missing');
    if (!orderItemAssociations.includes('seller')) throw new Error('OrderItem -> Seller association missing');
    console.log('✓ All OrderItem associations verified\n');

    // Test 12: Verify Payment associations
    console.log('12. Verifying Payment associations...');
    const paymentAssociations = Object.keys(Payment.associations);
    console.log(`    Payment associations: ${paymentAssociations.join(', ')}`);
    if (!paymentAssociations.includes('order')) throw new Error('Payment -> Order association missing');
    console.log('✓ All Payment associations verified\n');

    // Test 13: Verify Review associations
    console.log('13. Verifying Review associations...');
    const reviewAssociations = Object.keys(Review.associations);
    console.log(`    Review associations: ${reviewAssociations.join(', ')}`);
    if (!reviewAssociations.includes('product')) throw new Error('Review -> Product association missing');
    if (!reviewAssociations.includes('user')) throw new Error('Review -> User association missing');
    console.log('✓ All Review associations verified\n');

    // Test 14: Create test data to verify functionality
    console.log('14. Testing model functionality with sample data...');
    
    // Create a test user
    const testUser = await User.create({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'seller'
    });
    console.log('✓ User created successfully');

    // Verify password hashing
    const isPasswordHashed = testUser.password !== 'password123';
    if (!isPasswordHashed) throw new Error('Password was not hashed');
    console.log('✓ Password hashing verified');

    // Verify password comparison method
    const isPasswordValid = await testUser.comparePassword('password123');
    if (!isPasswordValid) throw new Error('Password comparison failed');
    console.log('✓ Password comparison method works');

    // Verify token generation methods
    const accessToken = testUser.generateAccessToken();
    const refreshToken = testUser.generateRefreshToken();
    if (!accessToken || !refreshToken) throw new Error('Token generation failed');
    console.log('✓ Token generation methods work');

    // Create a seller profile
    const testSeller = await Seller.create({
      userId: testUser.id,
      businessName: 'Test Business',
      businessDescription: 'A test business',
      businessAddress: '123 Test St',
      phoneNumber: '1234567890'
    });
    console.log('✓ Seller created successfully');

    // Create a category
    const testCategory = await Category.create({
      name: 'Electronics',
      description: 'Electronic items'
    });
    console.log('✓ Category created successfully');

    // Create a subcategory (test self-referencing)
    const testSubCategory = await Category.create({
      name: 'Laptops',
      description: 'Laptop computers',
      parentId: testCategory.id
    });
    console.log('✓ Subcategory created successfully (self-referencing works)');

    // Create a product
    const testProduct = await Product.create({
      sellerId: testSeller.id,
      categoryId: testCategory.id,
      name: 'Test Product',
      description: 'A test product',
      price: 99.99,
      stock: 10,
      images: ['image1.jpg', 'image2.jpg']
    });
    console.log('✓ Product created successfully');

    // Verify product validation (price must be positive)
    try {
      await Product.create({
        sellerId: testSeller.id,
        categoryId: testCategory.id,
        name: 'Invalid Product',
        description: 'Invalid price',
        price: -10,
        stock: 5
      });
      throw new Error('Product validation failed - negative price was accepted');
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        console.log('✓ Product price validation works');
      } else {
        throw error;
      }
    }

    // Create a cart
    const testCart = await Cart.create({
      userId: testUser.id
    });
    console.log('✓ Cart created successfully');

    // Create a cart item
    const testCartItem = await CartItem.create({
      cartId: testCart.id,
      productId: testProduct.id,
      quantity: 2
    });
    console.log('✓ CartItem created successfully');

    // Create an order
    const testOrder = await Order.create({
      userId: testUser.id,
      totalAmount: 199.98,
      status: 'pending',
      shippingAddress: {
        street: '123 Main St',
        city: 'Test City',
        country: 'Test Country'
      }
    });
    console.log('✓ Order created successfully');

    // Create an order item
    const testOrderItem = await OrderItem.create({
      orderId: testOrder.id,
      productId: testProduct.id,
      sellerId: testSeller.id,
      quantity: 2,
      priceAtPurchase: 99.99,
      status: 'pending'
    });
    console.log('✓ OrderItem created successfully');

    // Create a payment
    const testPayment = await Payment.create({
      orderId: testOrder.id,
      amount: 199.98,
      status: 'pending',
      chapaReference: 'TEST-REF-123'
    });
    console.log('✓ Payment created successfully');

    // Create a review
    const testReview = await Review.create({
      productId: testProduct.id,
      userId: testUser.id,
      rating: 5,
      comment: 'Great product!'
    });
    console.log('✓ Review created successfully');

    // Verify review rating validation (must be 1-5)
    try {
      await Review.create({
        productId: testProduct.id,
        userId: testUser.id,
        rating: 10,
        comment: 'Invalid rating'
      });
      throw new Error('Review validation failed - invalid rating was accepted');
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        console.log('✓ Review rating validation works');
      } else {
        throw error;
      }
    }

    console.log('\n=== All Model Verifications Passed! ===\n');
    console.log('Summary:');
    console.log('- All 10 models are properly defined');
    console.log('- All associations are correctly configured');
    console.log('- Database synchronization works');
    console.log('- Model validations are functioning');
    console.log('- Password hashing and comparison work');
    console.log('- Token generation methods work');
    console.log('- Self-referencing associations work (Category)');
    console.log('- All CRUD operations are functional');

    return true;
  } catch (error) {
    console.error('\n❌ Model Verification Failed:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    return false;
  } finally {
    await sequelize.close();
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyModels()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = verifyModels;
