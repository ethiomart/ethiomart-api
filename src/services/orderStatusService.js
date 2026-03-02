const { Order, User, OrderStatusHistory } = require('../models');
const notificationService = require('./notificationService');
const emailService = require('./emailService');

class OrderStatusService {
  // Valid status transitions
  VALID_TRANSITIONS = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['processing', 'cancelled'],
    'processing': ['packed', 'cancelled'],
    'packed': ['shipped', 'cancelled'],
    'shipped': ['in_transit', 'delivered', 'cancelled'],
    'in_transit': ['delivered', 'cancelled'],
    'delivered': [],
    'cancelled': []
  };

  // Who can update status
  PERMISSIONS = {
    'seller': ['processing', 'packed', 'shipped', 'in_transit'],
    'fulfillment': ['packed', 'shipped', 'in_transit', 'delivered'],
    'admin': ['confirmed', 'processing', 'packed', 'shipped', 'in_transit', 'delivered', 'cancelled'],
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

    // Validate transition
    if (!this.VALID_TRANSITIONS[order.order_status]) {
      // If current status is not in VALID_TRANSITIONS, allow transition to 'confirmed' or 'cancelled' as recovery
      if (newStatus !== 'confirmed' && newStatus !== 'cancelled') {
         throw new Error(`Invalid current status: ${order.order_status}. No transitions allowed except to confirmed or cancelled.`);
      }
    } else if (!this.VALID_TRANSITIONS[order.order_status].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${order.order_status} to ${newStatus}`);
    }

    // Validate permissions
    if (!this.PERMISSIONS[updatedBy.role].includes(newStatus)) {
      throw new Error(`${updatedBy.role} cannot set status to ${newStatus}`);
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
      'packed': 'Your order has been packed',
      'shipped': 'Your order has been shipped',
      'in_transit': 'Your order is on the way',
      'delivered': 'Your order has been delivered'
    };

    const message = statusMessages[status];
    const appUrl = process.env.CUSTOMER_APP_URL || 'http://localhost:3000';
    const trackingUrl = trackingInfo.trackingNumber 
      ? `${appUrl}/track/${order.id}`
      : null;

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
      console.error('Failed to send status update email', err);
    }

    // SMS notification (if phone provided)
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

    // Push notification (via existing notificationService mechanisms)
    try {
      // The old notification system internally checks for FCM token and sends push notification
      await notificationService.notifyOrderStatus(customer.id, order.id, status);
    } catch (err) {
      console.error('Failed to send status push notification', err);
    }
  }
}

module.exports = new OrderStatusService();
