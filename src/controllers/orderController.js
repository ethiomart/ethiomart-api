const { Order, OrderItem, Cart, CartItem, Product, Seller, User, sequelize } = require('../models');

/**
 * Create order from cart with stock validation
 * @route POST /api/orders
 * @access Private
 */
const createOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { shippingAddress, shippingCost, paymentMethod, notes } = req.body;

    // Map 'chapa' to a valid enum value if necessary
    const mappedPaymentMethod = paymentMethod === 'chapa' ? 'mobile_money' : (paymentMethod || 'cod');

    // Validate shipping address
    if (!shippingAddress) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required'
      });
    }

    // Find user's cart with items
    const cart = await Cart.findOne({
      where: { userId },
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
                }
              ]
            }
          ]
        }
      ],
      transaction
    });

    // Check if cart exists and has items
    if (!cart || !cart.items || cart.items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Validate stock for all items
    const stockErrors = [];
    for (const item of cart.items) {
      if (!item.product) {
        stockErrors.push(`Product not found for cart item ${item.id}`);
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
    }

    if (stockErrors.length > 0) {
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
      const itemTotal = item.quantity * parseFloat(item.product.price);
      totalAmount += itemTotal;

      orderItemsData.push({
        productId: item.productId,
        sellerId: item.product.sellerId,
        quantity: item.quantity,
        priceAtPurchase: item.product.price
      });
    }

    // Create order
    const order = await Order.create(
      {
        userId,
        order_number: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        subtotal: parseFloat((totalAmount - (shippingCost || 0)).toFixed(2)),
        shipping_cost: shippingCost || 0,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        payment_method: mappedPaymentMethod,
        status: 'pending',
        shippingAddress,
        notes: notes || ''
      },
      { transaction }
    );

    // Create order items and update product stock
    for (const itemData of orderItemsData) {
      await OrderItem.create(
        {
          orderId: order.id,
          ...itemData
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
    }

    // Clear cart items
    await CartItem.destroy({
      where: { cartId: cart.id },
      transaction
    });

    await transaction.commit();

    // Fetch created order with details
    const createdOrder = await Order.findByPk(order.id, {
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
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: createdOrder
      }
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

/**
 * Get customer's orders
 * @route GET /api/orders/customer/orders
 * @access Private (Customer)
 */
const getCustomerOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const orders = await Order.findAll({
      where: { userId },
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
};

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
      }
    ];

    if (userRole === 'customer') {
      // Customers see only their own orders
      whereClause.userId = userId;
    } else if (userRole === 'seller') {
      // Sellers see orders containing their products
      // Find seller profile
      const seller = await Seller.findOne({ where: { userId } });
      
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
            where: { sellerId: seller.id },
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
          }
        ],
        order: [['createdAt', 'DESC']]
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
        attributes: ['id', 'firstName', 'lastName', 'email']
      });
    }

    // Fetch orders for customer or admin
    const orders = await Order.findAll({
      where: whereClause,
      include: includeClause,
      order: [['createdAt', 'DESC']]
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

