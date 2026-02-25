const { Order, User, OrderItem, Product, Address, Payment } = require('../../models');
const { Op } = require('sequelize');
const orderStatusService = require('../../services/orderStatusService');

/**
 * Get all orders (Admin)
 */
exports.getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search, dateFrom, dateTo } = req.query;
    const where = {};

    if (status) where.order_status = status;
    if (dateFrom && dateTo) {
      where.created_at = { [Op.between]: [new Date(dateFrom), new Date(dateTo)] };
    }

    const userInclude = { model: User, as: 'user', attributes: ['first_name', 'last_name', 'email'] };
    if (search) {
      where[Op.or] = [
        { order_number: { [Op.like]: `%${search}%` } },
        { '$user.first_name$': { [Op.like]: `%${search}%` } },
        { '$user.last_name$': { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        userInclude,
        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['name', 'price'] }] }
      ],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get order by ID
 */
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['first_name', 'last_name', 'email', 'phone'] },
        { model: Address, as: 'address' },
        { 
          model: OrderItem, as: 'items', 
          include: [{ model: Product, as: 'product' }] 
        },
        { model: Payment, as: 'payment' }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status (admin)
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    const { status, trackingNumber, carrier, estimatedDelivery, notes } = req.body;

    const updatedOrder = await orderStatusService.updateOrderStatus(
      orderId,
      status,
      { id: userId, role: 'admin' },
      { trackingNumber, carrier, estimatedDelivery, notes }
    );

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order: updatedOrder
      }
    });
  } catch (error) {
    if (error.message.includes('Invalid status transition') || error.message.includes('cannot set status')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};
