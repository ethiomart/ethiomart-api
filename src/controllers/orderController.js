const { Order, OrderItem, Cart, CartItem, Product, Seller, User, Payment, VariantCombination, sequelize } = require('../models');
const chapaService = require('../services/chapaService');

/**
 * Create order from cart with stock validation
 * @route POST /api/orders
 * @access Private
 */
const createOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    let { shippingAddress, shippingCost, paymentMethod, notes } = req.body;

    // ============================================
    // VALIDATION: All NOT NULL fields before insertion
    // ============================================
    
    // 1. Validate user_id (required for foreign key constraint)
    if (!userId || typeof userId !== 'number' || userId <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID. User must be authenticated.'
      });
    }

    // 2. Validate shipping address
    if (!shippingAddress) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required'
      });
    }

    // 3. Validate shipping address structure (if it's a JSON object)
    if (typeof shippingAddress === 'object') {
      const requiredAddressFields = ['full_name', 'phone', 'street_address', 'city', 'country'];
      const missingAddressFields = requiredAddressFields.filter(field => !shippingAddress[field]);
      
      if (missingAddressFields.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Shipping address is missing required fields: ${missingAddressFields.join(', ')}`
        });
      }

      // Ensure shipping_address has the correct structure for database storage
      // Trim whitespace from string fields to prevent validation issues
      const trimmedAddress = {
        full_name: String(shippingAddress.full_name || '').trim(),
        phone: String(shippingAddress.phone || '').trim(),
        street_address: String(shippingAddress.street_address || '').trim(),
        city: String(shippingAddress.city || '').trim(),
        country: String(shippingAddress.country || '').trim()
      };

      // Include optional fields if provided
      if (shippingAddress.state) {
        trimmedAddress.state = String(shippingAddress.state).trim();
      }
      if (shippingAddress.postal_code) {
        trimmedAddress.postal_code = String(shippingAddress.postal_code).trim();
      }
      if (shippingAddress.is_default !== undefined) {
        trimmedAddress.is_default = Boolean(shippingAddress.is_default);
      }

      // Validate that required fields are not empty after trimming
      const emptyFields = requiredAddressFields.filter(field => !trimmedAddress[field]);
      if (emptyFields.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Shipping address has empty required fields: ${emptyFields.join(', ')}`
        });
      }

      // Replace shippingAddress with the sanitized version
      shippingAddress = trimmedAddress;
    }

    // 4. Validate shipping cost (must be a valid decimal >= 0)
    const validatedShippingCost = parseFloat(shippingCost) || 0;
    if (isNaN(validatedShippingCost) || validatedShippingCost < 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Shipping cost must be a valid non-negative number'
      });
    }

    // Map 'chapa' to a valid enum value if necessary
    const mappedPaymentMethod = paymentMethod === 'chapa' ? 'mobile_money' : (paymentMethod || 'cod');

    // 5. Validate payment method (must be one of the allowed enum values)
    const validPaymentMethods = ['card', 'mobile_money', 'bank_transfer', 'cod'];
    if (mappedPaymentMethod && !validPaymentMethods.includes(mappedPaymentMethod)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}`
      });
    }

    // Find user's cart with items
    const cart = await Cart.findOne({
      where: { user_id: userId },
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              include: [
                {
                  model: Seller,
                  as: 'seller',
                  attributes: ['id']
                },
                {
                  model: require('../models/VariantCombination'),
                  as: 'variantCombinations'
                }
              ]
            }
          ]
        }
      ],
      transaction
    });

    // Check if cart exists and has items
    console.log(`🔍 [DEBUG] Checking cart for user ${userId}:`, {
      cartId: cart?.id,
      itemCount: cart?.items?.length || 0,
      hasCart: !!cart
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Validate stock for all items
    const stockErrors = [];
    const orphanedCartItemIds = [];

    for (const item of cart.items) {
      if (!item.product) {
        console.warn(`[CHECKOUT] Orphaned cart item found: ${item.id}. Product is missing.`);
        orphanedCartItemIds.push(item.id);
        continue;
      }

      if (!item.product.is_published) {
        stockErrors.push(`Product "${item.product.name}" is no longer available`);
        continue;
      }

      if (item.quantity > item.product.quantity) {
        stockErrors.push(
          `Insufficient stock for "${item.product.name}". Only ${item.product.quantity} items available`
        );
      }

      // Validate variant stock if variant is selected
      if (item.variant_combination_id) {
        const variant = await VariantCombination.findByPk(item.variant_combination_id, { transaction });
        if (!variant) {
          stockErrors.push(`Selected variation for "${item.product.name}" no longer exists`);
        } else if (item.quantity > variant.stock_quantity) {
          stockErrors.push(`Insufficient stock for selected variation of "${item.product.name}". Only ${variant.stock_quantity} items available`);
        }
      }
    }

    // Clean up orphans if found
    if (orphanedCartItemIds.length > 0) {
      console.log(`[CHECKOUT] Cleaning up ${orphanedCartItemIds.length} orphaned items for user ${userId}`);
      await CartItem.destroy({
        where: { id: orphanedCartItemIds },
        transaction
      });
      
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Your cart contained invalid items that have been removed. Please review your cart and try again.',
        errors: [`Removed ${orphanedCartItemIds.length} invalid items`]
      });
    }

    if (stockErrors.length > 0) {
      console.error('Stock validation failed for user:', userId, 'Errors:', stockErrors);
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Stock validation failed',
        errors: stockErrors
      });
    }

    // Calculate total amount
    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of cart.items) {
      if (!item.product) continue; // Safety check (should have failed stock validation anyway)

      // Use variant price if available, otherwise use product price
      let itemPrice = parseFloat(item.product.price);
      if (item.variant_combination_id) {
        const variant = await VariantCombination.findByPk(item.variant_combination_id, { transaction });
        if (variant && variant.price) {
          itemPrice = parseFloat(variant.price);
        }
      }

      const itemTotal = item.quantity * itemPrice;
      totalAmount += itemTotal;

      orderItemsData.push({
        productId: item.product_id,
        sellerId: item.product.seller_id,
        variantCombinationId: item.variant_combination_id,
        quantity: item.quantity,
        priceAtPurchase: itemPrice
      });
    }

    // ============================================
    // VALIDATION: Calculated amounts before insertion
    // ============================================
    
    // 6. Validate total_amount (required NOT NULL field with no default)
    const calculatedTotalAmount = parseFloat((totalAmount + validatedShippingCost).toFixed(2));
    
    if (isNaN(calculatedTotalAmount) || calculatedTotalAmount < 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid total amount calculated. Please check cart items and shipping cost.'
      });
    }

    // 7. Validate subtotal (required NOT NULL field)
    const calculatedSubtotal = parseFloat(totalAmount.toFixed(2));
    
    if (isNaN(calculatedSubtotal) || calculatedSubtotal < 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid subtotal calculated. Please check cart items.'
      });
    }

    // 8. Validate order has at least one item
    if (orderItemsData.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    // 9. Generate and validate order_number (required NOT NULL unique field)
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    if (!orderNumber || orderNumber.length > 50) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Failed to generate valid order number'
      });
    }

    // ============================================
    // Create order with validated data
    // ============================================
    const order = await Order.create(
      {
        userId,
        order_number: orderNumber,
        subtotal: calculatedSubtotal,
        shipping_cost: validatedShippingCost,
        tax_amount: 0, // Explicitly set NOT NULL field with default
        discount_amount: 0, // Explicitly set NOT NULL field with default
        total_amount: calculatedTotalAmount, // Required NOT NULL field (no default)
        payment_method: mappedPaymentMethod,
        payment_status: 'pending', // Explicitly set NOT NULL field with default
        order_status: 'pending', // Explicitly set NOT NULL field with default
        shipping_address: shippingAddress,
        notes: notes || ''
      },
      { transaction }
    );

    // Create order items and update product stock
    for (const itemData of orderItemsData) {
      // 10. Validate seller_id for each order item (required for foreign key constraint)
      if (!itemData.sellerId || typeof itemData.sellerId !== 'number' || itemData.sellerId <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid seller ID for product ${itemData.productId}. Each product must have a valid seller.`
        });
      }

      // 11. Validate product_id for each order item (required for foreign key constraint)
      if (!itemData.productId || typeof itemData.productId !== 'number' || itemData.productId <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Invalid product ID in order item'
        });
      }

      // 12. Validate quantity for each order item (must be positive integer)
      if (!itemData.quantity || typeof itemData.quantity !== 'number' || itemData.quantity <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for product ${itemData.productId}. Quantity must be a positive number.`
        });
      }

      // 13. Validate price_at_purchase for each order item (must be valid decimal)
      const validatedPrice = parseFloat(itemData.priceAtPurchase);
      if (isNaN(validatedPrice) || validatedPrice < 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid price for product ${itemData.productId}. Price must be a valid non-negative number.`
        });
      }

      await OrderItem.create(
        {
          order_id: order.id,
          product_id: itemData.productId,
          seller_id: itemData.sellerId,
          variant_combination_id: itemData.variantCombinationId,
          quantity: itemData.quantity,
          price_at_purchase: validatedPrice
        },
        { transaction }
      );

      // Decrement product stock
      await Product.decrement(
        'quantity',
        {
          by: itemData.quantity,
          where: { id: itemData.productId },
          transaction
        }
      );

      // Decrement variant stock if applicable
      if (itemData.variantCombinationId) {
        await VariantCombination.decrement(
          'stock_quantity',
          {
            by: itemData.quantity,
            where: { id: itemData.variantCombinationId },
            transaction
          }
        );
      }
    }

    // Clear cart items
    await CartItem.destroy({
      where: { cart_id: cart.id },
      transaction
    });

    // ============================================
    // PAYMENT INITIALIZATION (within transaction)
    // ============================================
    
    // Initialize payment with Chapa if payment method requires it
    let paymentInitResult = null;
    let txRef = null;
    
    if (mappedPaymentMethod !== 'cod') {
      try {
        // Get user details for payment initialization
        const user = await User.findByPk(userId, { transaction });
        
        if (!user) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'User not found'
          });
        }

        // Initialize payment with Chapa
        paymentInitResult = await chapaService.initializePayment(
          order.id,
          calculatedTotalAmount,
          user.email,
          user.first_name,
          user.last_name,
          shippingAddress.phone || user.phone || null,
          mappedPaymentMethod
        );

        txRef = paymentInitResult.reference;

        // Generate unique transaction ID for internal tracking
        const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        // Create payment record with "pending" status within transaction
        await Payment.create(
          {
            order_id: order.id,
            transaction_id: transactionId,
            payment_method: mappedPaymentMethod,
            amount: calculatedTotalAmount,
            currency: paymentInitResult.currency || 'ETB',
            status: 'pending',
            chapa_tx_ref: txRef,
            payment_data: {
              payment_url: paymentInitResult.paymentUrl,
              payment_methods: paymentInitResult.paymentMethods,
              initialized_at: new Date().toISOString()
            }
          },
          { transaction }
        );

        console.log('Payment initialized successfully:', {
          orderId: order.id,
          transactionId,
          txRef,
          amount: calculatedTotalAmount,
          currency: paymentInitResult.currency || 'ETB',
          timestamp: new Date().toISOString()
        });
      } catch (paymentError) {
        // Rollback transaction if payment initialization fails
        await transaction.rollback();
        
        console.error('!!!ANTIGRAVITY_ORDER_DEBUG!!! Payment initialization failed details:', paymentError);

        return res.status(400).json({
          success: false,
          message: 'Payment initialization failed. Please try again.',
          error: paymentError.message,
          details: paymentError.toString()
        });
      }
    } else {
      // For COD orders, create payment record with pending status
      const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      await Payment.create(
        {
          order_id: order.id,
          transaction_id: transactionId,
          payment_method: 'cod',
          amount: calculatedTotalAmount,
          currency: 'ETB',
          status: 'pending',
          payment_data: {
            payment_type: 'cash_on_delivery',
            initialized_at: new Date().toISOString()
          }
        },
        { transaction }
      );
    }

    // Commit transaction only if all steps succeeded
    await transaction.commit();

    // Fetch created order with details
    let createdOrder = null;
    try {
      createdOrder = await Order.findByPk(order.id, {
        include: [
          {
            model: OrderItem,
            as: 'items',
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'price', 'images']
              },
              {
                model: Seller,
                as: 'seller',
                attributes: ['id', 'store_name']
              }
            ]
          },
          {
            model: Payment,
            as: 'payment',
            attributes: ['id', 'payment_method', 'amount', 'currency', 'status', 'chapa_tx_ref']
          }
        ]
      });
    } catch (fetchError) {
      console.error('!!!ANTIGRAVITY_ORDER_DEBUG!!! Error fetching created order:', fetchError);
      // Continue with the 'order' object we already have if re-fetch fails
    }

    // Prepare response based on payment method
    const responseData = {
      order: createdOrder || order.get({ plain: true })
    };

    // Ensure status fields are present if missing (mapping order_status to status if needed by some clients)
    if (responseData.order && !responseData.order.status && responseData.order.order_status) {
      responseData.order.status = responseData.order.order_status;
    }

    // Include payment URL for non-COD orders
    if (paymentInitResult && paymentInitResult.paymentUrl) {
      responseData.paymentUrl = paymentInitResult.paymentUrl;
      responseData.txRef = txRef;
    }

    console.log('Order created successfully and returning response:', {
      orderId: order.id,
      hasCreatedOrder: !!createdOrder,
      paymentMethod: mappedPaymentMethod
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: responseData
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    
    // ============================================
    // DETAILED DATABASE VALIDATION ERROR LOGGING
    // ============================================
    
    // Log comprehensive error context
    console.error('=== ORDER CREATION ERROR ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error Type:', error.name);
    console.error('Error Message:', error.message);
    console.error('User ID:', req.user?.id);
    console.error('Request Body:', JSON.stringify(req.body, null, 2));
    
    // Log stack trace for debugging
    if (error.stack) {
      console.error('Stack Trace:', error.stack);
    }

    // Provide user-friendly error messages for common database validation errors
    if (error.name === 'SequelizeValidationError') {
      // Extract detailed validation error information
      const validationErrors = error.errors.map(err => ({
        field: err.path,
        message: err.message,
        value: err.value,
        type: err.type,
        validatorKey: err.validatorKey,
        validatorName: err.validatorName
      }));
      
      // Log detailed validation errors with field names and values
      console.error('=== DATABASE VALIDATION ERRORS ===');
      console.error('Timestamp:', new Date().toISOString());
      console.error('Total Validation Errors:', validationErrors.length);
      console.error('User ID:', req.user?.id);
      
      validationErrors.forEach((err, index) => {
        console.error(`\nValidation Error #${index + 1}:`);
        console.error('  Field Name:', err.field);
        console.error('  Error Message:', err.message);
        console.error('  Field Value:', typeof err.value === 'object' ? JSON.stringify(err.value) : err.value);
        console.error('  Value Type:', typeof err.value);
        console.error('  Validation Type:', err.type);
        console.error('  Validator Key:', err.validatorKey);
        console.error('  Validator Name:', err.validatorName);
        
        // Log additional context for specific field types
        if (err.field === 'shipping_address' && typeof err.value === 'object') {
          console.error('  Shipping Address Details:');
          console.error('    - full_name:', err.value?.full_name);
          console.error('    - phone:', err.value?.phone);
          console.error('    - street_address:', err.value?.street_address);
          console.error('    - city:', err.value?.city);
          console.error('    - country:', err.value?.country);
          console.error('    - state:', err.value?.state);
          console.error('    - postal_code:', err.value?.postal_code);
        }
        
        if (err.field === 'total_amount' || err.field === 'subtotal' || err.field === 'shipping_cost') {
          console.error('  Amount Details:');
          console.error('    - Raw Value:', err.value);
          console.error('    - Parsed Value:', parseFloat(err.value));
          console.error('    - Is NaN:', isNaN(parseFloat(err.value)));
          console.error('    - Is Negative:', parseFloat(err.value) < 0);
        }
      });
      
      console.error('\n=== REQUEST DATA SNAPSHOT ===');
      console.error('Shipping Address:', JSON.stringify(req.body.shippingAddress, null, 2));
      console.error('Shipping Cost:', req.body.shippingCost);
      console.error('Payment Method:', req.body.paymentMethod);
      console.error('Notes:', req.body.notes);
      console.error('================================\n');
      
      return res.status(400).json({
        success: false,
        message: 'Order validation failed. Please check your order details.',
        errors: validationErrors.map(e => `${e.field}: ${e.message}`)
      });
    }

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      // Log detailed foreign key constraint error
      console.error('=== FOREIGN KEY CONSTRAINT ERROR ===');
      console.error('Table:', error.table);
      console.error('Fields:', error.fields);
      console.error('Value:', error.value);
      console.error('Index:', error.index);
      console.error('Parent Table:', error.parent?.table);
      console.error('Parent Fields:', error.parent?.fields);
      console.error('SQL:', error.sql);
      console.error('====================================\n');
      
      return res.status(400).json({
        success: false,
        message: 'Invalid reference in order data. Please ensure all products and addresses are valid.'
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      // Log detailed unique constraint error
      console.error('=== UNIQUE CONSTRAINT ERROR ===');
      console.error('Fields:', error.fields);
      console.error('Value:', error.value);
      console.error('Parent:', error.parent);
      console.error('SQL:', error.sql);
      console.error('===============================\n');
      
      return res.status(400).json({
        success: false,
        message: 'Duplicate order detected. Please try again.'
      });
    }

    if (error.name === 'SequelizeDatabaseError') {
      // Log detailed database error
      console.error('=== DATABASE ERROR ===');
      console.error('SQL:', error.sql);
      console.error('Parameters:', error.parameters);
      console.error('Parent Error:', error.parent);
      console.error('Original Error:', error.original);
      console.error('======================\n');
      
      return res.status(500).json({
        success: false,
        message: 'Database error occurred. Please try again or contact support.'
      });
    }

    // Log any other unexpected errors with full details
    console.error('=== UNEXPECTED ERROR ===');
    console.error('Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('========================\n');

    next(error);
  }
};

/**
 * Get customer's orders
 * @route GET /api/orders/customer/orders
 * @access Private (Customer)
 */
/**
 * Get customer's orders with payment details
 * @route GET /api/orders/customer/orders
 * @access Private (Customer)
 */
const getCustomerOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const orders = await Order.findAll({
      where: { user_id: userId },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'price', 'images', 'description']
            }
          ]
        },
        {
          model: Payment,
          as: 'payment',
          attributes: ['id', 'payment_method', 'amount', 'currency', 'status', 'chapa_tx_ref', 'paid_at', 'created_at']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      message: 'Customer orders retrieved successfully',
      data: { orders }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's orders (filtered by role)
 * @route GET /api/orders
 * @access Private
 */
const getOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause = {};
    let includeClause = [
      {
        model: OrderItem,
        as: 'items',
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'price', 'images']
          },
          {
            model: Seller,
            as: 'seller',
            attributes: ['id', 'store_name']
          }
        ]
      },
      {
        model: Payment,
        as: 'payment',
        attributes: ['id', 'payment_method', 'amount', 'currency', 'status', 'chapa_tx_ref', 'paid_at', 'created_at']
      }
    ];

    if (userRole === 'customer') {
      // Customers see only their own orders
      whereClause.user_id = userId;
    } else if (userRole === 'seller') {
      // Sellers see orders containing their products
      // Find seller profile
      const seller = await Seller.findOne({ where: { user_id: userId } });
      
      if (!seller) {
        return res.status(404).json({
          success: false,
          message: 'Seller profile not found'
        });
      }

      // Get orders with items from this seller
      const orders = await Order.findAll({
        include: [
          {
            model: OrderItem,
            as: 'items',
            where: { seller_id: seller.id },
            required: true,
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'price', 'images']
              },
              {
                model: Seller,
                as: 'seller',
                attributes: ['id', 'store_name']
              }
            ]
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'email']
          },
          {
            model: Payment,
            as: 'payment',
            attributes: ['id', 'payment_method', 'amount', 'currency', 'status', 'chapa_tx_ref', 'paid_at', 'created_at']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return res.status(200).json({
        success: true,
        message: 'Orders retrieved successfully',
        data: {
          orders,
          count: orders.length
        }
      });
    } else if (userRole === 'admin') {
      // Admins see all orders
      includeClause.push({
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email']
      });
    }

    // Fetch orders for customer or admin
    const orders = await Order.findAll({
      where: whereClause,
      include: includeClause,
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data: {
        orders,
        count: orders.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get order details by ID
 * @route GET /api/orders/:id
 * @access Private
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch order with details
    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'description', 'price', 'images']
            },
            {
              model: Seller,
              as: 'seller',
              attributes: ['id', 'store_name']
            }
          ]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Payment,
          as: 'payment',
          attributes: ['id', 'payment_method', 'amount', 'currency', 'status', 'chapa_tx_ref', 'paid_at', 'created_at']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Authorization check
    if (userRole === 'customer') {
      // Customers can only view their own orders
      if (order.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    } else if (userRole === 'seller') {
      // Sellers can only view orders containing their products
      const seller = await Seller.findOne({ where: { userId } });
      
      if (!seller) {
        return res.status(404).json({
          success: false,
          message: 'Seller profile not found'
        });
      }

      const hasSellerItems = order.items.some(item => item.sellerId === seller.id);
      
      if (!hasSellerItems) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }
    // Admins can view all orders (no additional check needed)

    res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data: {
        order
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order or order item status
 * @route PUT /api/orders/:id/status
 * @access Private (Seller/Admin)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, orderItemId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate status
    const validOrderStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'payment_failed'];
    const validOrderItemStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    if (orderItemId) {
      // Update order item status
      if (!validOrderItemStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid order item status. Must be one of: ${validOrderItemStatuses.join(', ')}`
        });
      }

      const orderItem = await OrderItem.findOne({
        where: { id: orderItemId, orderId: id },
        include: [
          {
            model: Order,
            as: 'order'
          }
        ]
      });

      if (!orderItem) {
        return res.status(404).json({
          success: false,
          message: 'Order item not found'
        });
      }

      // Authorization check for sellers
      if (userRole === 'seller') {
        const seller = await Seller.findOne({ where: { userId } });
        
        if (!seller || orderItem.sellerId !== seller.id) {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      }

      await orderItem.update({ status });

      res.status(200).json({
        success: true,
        message: 'Order item status updated successfully',
        data: {
          orderItem
        }
      });
    } else {
      // Update order status (admin only)
      if (userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only admins can update order status'
        });
      }

      if (!validOrderStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid order status. Must be one of: ${validOrderStatuses.join(', ')}`
        });
      }

      const order = await Order.findByPk(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      await order.update({ status });

      res.status(200).json({
        success: true,
        message: 'Order status updated successfully',
        data: {
          order
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel order if not yet shipped
 * @route POST /api/orders/:id/cancel
 * @access Private
 */
const cancelOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch order with items
    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: 'items'
        }
      ],
      transaction
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Authorization check - only order owner or admin can cancel
    if (userRole !== 'admin' && order.userId !== userId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if order can be cancelled
    const nonCancellableStatuses = ['shipped', 'delivered', 'cancelled'];
    if (nonCancellableStatuses.includes(order.status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}`
      });
    }

    // Update order status to cancelled
    await order.update({ status: 'cancelled' }, { transaction });

    // Update all order items to cancelled
    await OrderItem.update(
      { status: 'cancelled' },
      {
        where: { orderId: id },
        transaction
      }
    );

    // Restore product stock
    for (const item of order.items) {
      await Product.increment(
        'quantity',
        {
          by: item.quantity,
          where: { id: item.productId },
          transaction
        }
      );
    }

    await transaction.commit();

    // Fetch updated order
    const updatedOrder = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'price', 'images']
            }
          ]
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        order: updatedOrder
      }
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

module.exports = {
  createOrder,
  getOrders,
  getCustomerOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder
};

