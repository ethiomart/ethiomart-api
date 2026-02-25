const { sequelize, User, Seller, Product, Cart, CartItem, Order, OrderItem } = require('../models');
const { Op } = require('sequelize');
const orderController = require('../controllers/orderController');

async function testOrderController() {
  try {
    console.log('Testing Order Controller...\n');

    // Sync database
    await sequelize.sync({ force: false });

    // Test 1: Create Order from Cart
    console.log('Test 1: Create Order from Cart');
    
    // Find a customer with cart items
    const customer = await User.findOne({ where: { role: 'customer' } });
    if (!customer) {
      console.log('❌ No customer found. Please run seed data first.');
      return;
    }

    const cart = await Cart.findOne({
      where: { userId: customer.id },
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product'
            }
          ]
        }
      ]
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      console.log('❌ Customer has no cart items. Adding items to cart...');
      
      // Find a product
      const product = await Product.findOne({ where: { isActive: true, stock: { [Op.gt]: 0 } } });
      if (!product) {
        console.log('❌ No products available');
        return;
      }

      // Create cart if doesn't exist
      let newCart = await Cart.findOne({ where: { userId: customer.id } });
      if (!newCart) {
        newCart = await Cart.create({ userId: customer.id });
      }

      // Add item to cart
      await CartItem.create({
        cartId: newCart.id,
        productId: product.id,
        quantity: 1
      });

      console.log('✓ Added item to cart');
    }

    // Mock request and response for createOrder
    const mockReq = {
      user: { id: customer.id, role: 'customer' },
      body: {
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          country: 'Test Country'
        }
      }
    };

    const mockRes = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.data = data;
        return this;
      }
    };

    const mockNext = (error) => {
      if (error) {
        console.log('❌ Error:', error.message);
      }
    };

    await orderController.createOrder(mockReq, mockRes, mockNext);

    if (mockRes.statusCode === 201 && mockRes.data.success) {
      console.log('✓ Order created successfully');
      console.log('  Order ID:', mockRes.data.data.order.id);
      console.log('  Total Amount:', mockRes.data.data.order.totalAmount);
      console.log('  Status:', mockRes.data.data.order.status);
      console.log('  Items:', mockRes.data.data.order.items.length);
    } else {
      console.log('❌ Failed to create order:', mockRes.data.message);
    }

    // Test 2: Get Orders (Customer)
    console.log('\nTest 2: Get Orders (Customer)');
    
    const mockReq2 = {
      user: { id: customer.id, role: 'customer' }
    };

    const mockRes2 = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.data = data;
        return this;
      }
    };

    await orderController.getOrders(mockReq2, mockRes2, mockNext);

    if (mockRes2.statusCode === 200 && mockRes2.data.success) {
      console.log('✓ Orders retrieved successfully');
      console.log('  Total Orders:', mockRes2.data.data.count);
    } else {
      console.log('❌ Failed to retrieve orders');
    }

    // Test 3: Get Order by ID
    if (mockRes.data.data && mockRes.data.data.order) {
      console.log('\nTest 3: Get Order by ID');
      
      const orderId = mockRes.data.data.order.id;
      const mockReq3 = {
        user: { id: customer.id, role: 'customer' },
        params: { id: orderId }
      };

      const mockRes3 = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          this.data = data;
          return this;
        }
      };

      await orderController.getOrderById(mockReq3, mockRes3, mockNext);

      if (mockRes3.statusCode === 200 && mockRes3.data.success) {
        console.log('✓ Order details retrieved successfully');
        console.log('  Order ID:', mockRes3.data.data.order.id);
        console.log('  Status:', mockRes3.data.data.order.status);
      } else {
        console.log('❌ Failed to retrieve order details');
      }

      // Test 4: Cancel Order
      console.log('\nTest 4: Cancel Order');
      
      const mockReq4 = {
        user: { id: customer.id, role: 'customer' },
        params: { id: orderId }
      };

      const mockRes4 = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          this.data = data;
          return this;
        }
      };

      await orderController.cancelOrder(mockReq4, mockRes4, mockNext);

      if (mockRes4.statusCode === 200 && mockRes4.data.success) {
        console.log('✓ Order cancelled successfully');
        console.log('  Order Status:', mockRes4.data.data.order.status);
      } else {
        console.log('❌ Failed to cancel order:', mockRes4.data.message);
      }
    }

    // Test 5: Get Orders for Seller
    console.log('\nTest 5: Get Orders (Seller)');
    
    const seller = await Seller.findOne({
      include: [
        {
          model: User,
          as: 'user'
        }
      ]
    });

    if (seller && seller.user) {
      const mockReq5 = {
        user: { id: seller.user.id, role: 'seller' }
      };

      const mockRes5 = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          this.data = data;
          return this;
        }
      };

      await orderController.getOrders(mockReq5, mockRes5, mockNext);

      if (mockRes5.statusCode === 200 && mockRes5.data.success) {
        console.log('✓ Seller orders retrieved successfully');
        console.log('  Total Orders:', mockRes5.data.data.count);
      } else {
        console.log('❌ Failed to retrieve seller orders');
      }
    }

    console.log('\n✅ All Order Controller tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

// Run tests
testOrderController();
