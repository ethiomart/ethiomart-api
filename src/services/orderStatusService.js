const { Order, User, OrderStatusHistory } = require('../models');
const notificationService = require('./notificationService');
const emailService = require('./emailService');

class OrderStatusService {
  // Valid status transitions
  VALID_TRANSITIONS = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['processing', 'cancelled'],
    'processing': ['shipped', 'cancelled'],
    'shipped': ['out_for_delivery', 'delivered', 'cancelled'],
    'out_for_delivery': ['delivered', 'returned', 'cancelled'],
    'delivered': ['returned'],
    'cancelled': [],
    'returned': []
  };

  // Who can update status
  PERMISSIONS = {
    'seller': ['confirmed', 'processing', 'shipped', 'out_for_delivery'],
    'fulfillment': ['shipped', 'out_for_delivery', 'delivered'],
    'admin': ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
    'system': ['confirmed', 'cancelled']
  };

  /**
   * Update the status of an order
   * @param {number} orderId 
   * @param {string} newStatus 
   * @param {object} updatedBy user object containing id and role
   * @param {object} trackingInfo optional tracking data
   */
  async updateOrderStatus(orderId, newStatus, updatedBy, trackingInfo = {}) {
    const order = await Order.findByPk(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Validate permissions first
    if (!this.PERMISSIONS[updatedBy.role].includes(newStatus)) {
      throw new Error(`${updatedBy.role} cannot set status to ${newStatus}`);
    }

    // Validate transition
    // Admin can bypass sequential checks if the Target Status is in their PERMISSIONS
    if (updatedBy.role !== 'admin') {
      if (!this.VALID_TRANSITIONS[order.order_status]) {
        // If current status is not in VALID_TRANSITIONS, allow transition to 'confirmed' or 'cancelled' as recovery
        if (newStatus !== 'confirmed' && newStatus !== 'cancelled') {
           throw new Error(`Invalid current status: ${order.order_status}. No transitions allowed except to confirmed or cancelled.`);
        }
      } else if (!this.VALID_TRANSITIONS[order.order_status].includes(newStatus)) {
        throw new Error(`Invalid status transition from ${order.order_status} to ${newStatus}`);
      }
    }

    const oldStatus = order.order_status;
    
    // Update order
    await order.update({
      order_status: newStatus,
      tracking_number: trackingInfo.trackingNumber || order.tracking_number,
      carrier: trackingInfo.carrier || order.carrier,
      estimated_delivery_date: trackingInfo.estimatedDelivery || order.estimated_delivery_date,
      updated_by: updatedBy.id
    });

    // Log status change
    await OrderStatusHistory.create({
      order_id: orderId,
      old_status: oldStatus,
      new_status: newStatus,
      updated_by: updatedBy.id,
      notes: trackingInfo.notes
    });

    // Send notifications
    await this.sendStatusNotification(order, newStatus, trackingInfo);

    return order;
  }

  async sendStatusNotification(order, status, trackingInfo) {
    const customer = await User.findByPk(order.user_id);

    if (!customer) return;

    const statusMessages = {
      'confirmed': 'Your order has been confirmed',
      'processing': 'Your order is being processed',
      'shipped': 'Your order has been shipped',
      'out_for_delivery': 'Your order is out for delivery',
      'delivered': 'Your order has been delivered',
      'cancelled': 'Your order has been cancelled',
      'returned': 'Your order has been returned'
    };

    const message = statusMessages[status] || `Your order status has been updated to ${status}`;
    const appUrl = process.env.CUSTOMER_APP_URL || 'http://localhost:3000';
    const trackingUrl = trackingInfo.trackingNumber 
      ? `${appUrl}/track/${order.id}`
      : null;

    // 1. Notify Customer
    // Email notification
    try {
      await emailService.sendStatusUpdate({
        to: customer.email,
        orderId: order.id,
        status: status,
        message: message,
        trackingNumber: trackingInfo.trackingNumber,
        carrier: trackingInfo.carrier,
        estimatedDelivery: trackingInfo.estimatedDelivery,
        trackingUrl: trackingUrl
      });
    } catch (err) {
      console.error('Failed to send status update email to customer', err);
    }

    // SMS notification
    if (customer.phone) {
      try {
        await notificationService.sendSMS({
          to: customer.phone,
          orderId: order.id,
          message: message,
          trackingUrl: trackingUrl
        });
      } catch (err) {
         console.error('Failed to send status SMS', err);
      }
    }

    // Push notification
    try {
      await notificationService.notifyOrderStatus(customer.id, order.id, status);
    } catch (err) {
      console.error('Failed to send status push notification', err);
    }

    // 2. Notify Sellers
    try {
      const { OrderItem, Seller, User: UserAlias } = require('../models');
      const orderItems = await OrderItem.findAll({
        where: { order_id: order.id },
        include: [{ 
          model: Seller, 
          as: 'seller',
          include: [{ model: UserAlias, as: 'user', attributes: ['id', 'email'] }]
        }]
      });

      const uniqueSellers = new Set();
      const sellerList = [];

      for (const item of orderItems) {
        if (item.seller && !uniqueSellers.has(item.seller_id)) {
          uniqueSellers.add(item.seller_id);
          sellerList.push(item.seller);
        }
      }

      for (const seller of sellerList) {
        const sellerTitle = `Order #${order.id} Update`;
        const sellerMessage = `Order #${order.id} containing your products has been updated to: ${status}`;
        
        // In-app / Push
        await notificationService.notifySeller(seller.id, sellerMessage, sellerTitle, order.id, 'order');

        // Email to seller
        if (seller.user && seller.user.email) {
          await emailService.sendEmail(
            seller.user.email,
            `Order Update - #${order.id}`,
            `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Order Update Notification</h2>
                <p>Hello ${seller.store_name},</p>
                <p>Order <strong>#${order.id}</strong> (containing items from your store) has changed status to: <strong>${status}</strong>.</p>
                <p>Please log in to your dashboard for more details.</p>
              </div>
            `
          );
        }
      }
    } catch (err) {
      console.error('Failed to notify sellers about order status update', err);
    }
  }
}

module.exports = new OrderStatusService();
