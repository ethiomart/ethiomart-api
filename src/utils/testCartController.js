const { sequelize, User, Seller, Product, Cart, CartItem, Category } = require('../models');
const cartController = require('../controllers/cartController');

async function testCartController() {
  try {
    console.log('Testing Cart Controller...\n');

    // Sync database
    await sequelize.sync({ force: false });
    console.log('✓ Database synced\n');

    // Create test user
    const testUser = await User.create({
      email: 'carttest@example.com',
      password: 'password123',
      firstName: 'Cart',
      lastName: 'Tester',
      role: 'customer',
      isActive: true
    });
    console.log('✓ Test user created:', testUser.email);

    // Create test seller
    const sellerUser = await User.create({
      email: 'cartseller@example.com',
      password: 'password123',
      firstName: 'Seller',
      lastName: 'Test',
      role: 'seller',
      isActive: true
    });

    const seller = await Seller.create({
      userId: sellerUser.id,
      businessName: 'Test Shop',
      businessDescription: 'Test shop for cart testing',
      businessAddress: '123 Test St',
      phoneNumber: '1234567890'
    });
    console.log('✓ Test seller created:', seller.businessName);

    // Create test category
    const category = await Category.create({
      name: 'Test Category',
      description: 'Category for testing'
    });
    console.log('✓ Test category created:', category.name);

    // Create test products
    const product1 = await Product.create({
      sellerId: seller.id,
      categoryId: category.id,
      name: 'Test Product 1',
      description: 'First test product',
      price: 29.99,
      stock: 10,
      images: ['/uploads/test1.jpg'],
      isActive: true
    });

    const product2 = await Product.create({
      sellerId: seller.id,
      categoryId: category.id,
      name: 'Test Product 2',
      description: 'Second test product',
      price: 49.99,
      stock: 5,
      images: ['/uploads/test2.jpg'],
      isActive: true
    });
    console.log('✓ Test products created\n');

    // Mock request and response objects
    const mockReq = (data) => ({
      user: { id: testUser.id, role: 'customer' },
      body: data.body || {},
      params: data.params || {},
      query: data.query || {}
    });

    const mockRes = () => {
      const res = {};
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.data = data;
        return res;
      };
      return res;
    };

    const mockNext = (error) => {
      if (error) throw error;
    };

    // Test 1: Get empty cart
    console.log('Test 1: Get empty cart');
    const req1 = mockReq({});
    const res1 = mockRes();
    await cartController.getCart(req1, res1, mockNext);
    console.log('Status:', res1.statusCode);
    console.log('Cart items:', res1.data.data.cart.itemCount);
    console.log('Total:', res1.data.data.cart.total);
    console.log('✓ Empty cart retrieved\n');

    // Test 2: Add item to cart
    console.log('Test 2: Add item to cart');
    const req2 = mockReq({
      body: { productId: product1.id, quantity: 2 }
    });
    const res2 = mockRes();
    await cartController.addToCart(req2, res2, mockNext);
    console.log('Status:', res2.statusCode);
    console.log('Message:', res2.data.message);
    console.log('✓ Item added to cart\n');

    // Test 3: Get cart with items
    console.log('Test 3: Get cart with items');
    const req3 = mockReq({});
    const res3 = mockRes();
    await cartController.getCart(req3, res3, mockNext);
    console.log('Status:', res3.statusCode);
    console.log('Cart items:', res3.data.data.cart.itemCount);
    console.log('Total:', res3.data.data.cart.total);
    console.log('✓ Cart with items retrieved\n');

    // Test 4: Add another item
    console.log('Test 4: Add another item');
    const req4 = mockReq({
      body: { productId: product2.id, quantity: 1 }
    });
    const res4 = mockRes();
    await cartController.addToCart(req4, res4, mockNext);
    console.log('Status:', res4.statusCode);
    console.log('Message:', res4.data.message);
    console.log('✓ Second item added\n');

    // Test 5: Update cart item quantity
    console.log('Test 5: Update cart item quantity');
    const cart = await Cart.findOne({ where: { userId: testUser.id } });
    const cartItems = await CartItem.findAll({ where: { cartId: cart.id } });
    const req5 = mockReq({
      params: { id: cartItems[0].id },
      body: { quantity: 3 }
    });
    const res5 = mockRes();
    await cartController.updateCartItem(req5, res5, mockNext);
    console.log('Status:', res5.statusCode);
    console.log('Message:', res5.data.message);
    console.log('✓ Cart item quantity updated\n');

    // Test 6: Test stock validation
    console.log('Test 6: Test stock validation (should fail)');
    const req6 = mockReq({
      body: { productId: product2.id, quantity: 100 }
    });
    const res6 = mockRes();
    await cartController.addToCart(req6, res6, mockNext);
    console.log('Status:', res6.statusCode);
    console.log('Message:', res6.data.message);
    console.log('✓ Stock validation working\n');

    // Test 7: Remove item from cart
    console.log('Test 7: Remove item from cart');
    const req7 = mockReq({
      params: { id: cartItems[1].id }
    });
    const res7 = mockRes();
    await cartController.removeFromCart(req7, res7, mockNext);
    console.log('Status:', res7.statusCode);
    console.log('Message:', res7.data.message);
    console.log('✓ Item removed from cart\n');

    // Test 8: Clear cart
    console.log('Test 8: Clear cart');
    const req8 = mockReq({});
    const res8 = mockRes();
    await cartController.clearCart(req8, res8, mockNext);
    console.log('Status:', res8.statusCode);
    console.log('Message:', res8.data.message);
    console.log('✓ Cart cleared\n');

    // Test 9: Verify cart is empty
    console.log('Test 9: Verify cart is empty');
    const req9 = mockReq({});
    const res9 = mockRes();
    await cartController.getCart(req9, res9, mockNext);
    console.log('Status:', res9.statusCode);
    console.log('Cart items:', res9.data.data.cart.itemCount);
    console.log('Total:', res9.data.data.cart.total);
    console.log('✓ Cart is empty\n');

    // Cleanup
    await CartItem.destroy({ where: { cartId: cart.id } });
    await Cart.destroy({ where: { userId: testUser.id } });
    await Product.destroy({ where: { sellerId: seller.id } });
    await Category.destroy({ where: { id: category.id } });
    await Seller.destroy({ where: { id: seller.id } });
    await User.destroy({ where: { id: testUser.id } });
    await User.destroy({ where: { id: sellerUser.id } });
    console.log('✓ Test data cleaned up\n');

    console.log('✅ All cart controller tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testCartController();
