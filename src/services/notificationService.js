const { sendPushNotification } = require('./pushNotificationService');
const emailService = require('./emailService');

/**
 * Notification Service
 * Handles creating and managing in-app notifications
 */

/**
 * Create a notification for a user
 * @param {number} userId - User ID to notify
 * @param {string} type - Notification type (order_status, payment, product, system)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {number} relatedId - Optional related entity ID
 * @param {string} relatedType - Optional related entity type
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async (userId, type, title, message, relatedId = null, relatedType = null) => {
  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      relatedId,
      relatedType,
      isRead: false,
    });

    console.log(`Notification created for user ${userId}: ${title}`);

    // Try sending push notification if FCM token exists
    try {
      const user = await User.findByPk(userId, { attributes: ['fcm_token'] });
      if (user && user.fcm_token) {
        await sendPushNotification(user.fcm_token, title, message, {
          type,
          relatedId: relatedId ? relatedId.toString() : '',
          relatedType: relatedType || ''
        });
      }
    } catch (pushError) {
      console.error('Failed to trigger push notification:', pushError);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Notify user about order status change
 * @param {number} userId - User ID to notify
 * @param {number} orderId - Order ID
 * @param {string} status - New order status
 * @returns {Promise<Object>} Created notification
 */
const notifyOrderStatus = async (userId, orderId, status) => {
  try {
    const statusMessages = {
      pending: 'Your order has been placed and is awaiting payment.',
      paid: 'Your payment has been confirmed! Your order is being processed.',
      processing: 'Your order is being prepared for shipment.',
      shipped: 'Great news! Your order has been shipped and is on its way.',
      delivered: 'Your order has been delivered. Thank you for shopping with us!',
      cancelled: 'Your order has been cancelled.',
      payment_failed: 'Payment for your order failed. Please try again.',
    };

    const message = statusMessages[status] || `Your order status has been updated to: ${status}`;
    const title = `Order #${orderId} - ${status.charAt(0).toUpperCase() + status.slice(1)}`;

    return await createNotification(
      userId,
      'order_status',
      title,
      message,
      orderId,
      'order'
    );
  } catch (error) {
    console.error('Error notifying order status:', error);
    throw error;
  }
};

/**
 * Notify seller with a custom message
 * @param {number} sellerId - Seller ID to notify
 * @param {string} message - Notification message
 * @param {string} title - Optional notification title
 * @param {number} relatedId - Optional related entity ID
 * @param {string} relatedType - Optional related entity type
 * @returns {Promise<Object>} Created notification
 */
const notifySeller = async (sellerId, message, title = 'Seller Notification', relatedId = null, relatedType = null) => {
  try {
    // Get the seller's user ID
    const seller = await Seller.findByPk(sellerId, {
      attributes: ['userId'],
    });

    if (!seller) {
      throw new Error(`Seller with ID ${sellerId} not found`);
    }

    return await createNotification(
      seller.userId,
      'system',
      title,
      message,
      relatedId,
      relatedType
    );
  } catch (error) {
    console.error('Error notifying seller:', error);
    throw error;
  }
};

/**
 * Notify seller about new order containing their products
 * @param {number} sellerId - Seller ID to notify
 * @param {number} orderId - Order ID
 * @param {number} itemCount - Number of items from this seller in the order
 * @returns {Promise<Object>} Created notification
 */
const notifySellerNewOrder = async (sellerId, orderId, itemCount) => {
  try {
    const title = 'New Order Received!';
    const message = `You have received a new order (#${orderId}) with ${itemCount} item${itemCount > 1 ? 's' : ''}. Please prepare it for shipment.`;
    
    return await notifySeller(sellerId, message, title, orderId, 'order');
  } catch (error) {
    console.error('Error notifying seller about new order:', error);
    throw error;
  }
};

/**
 * Notify user about payment status
 * @param {number} userId - User ID to notify
 * @param {number} orderId - Order ID
 * @param {string} status - Payment status (success, failed)
 * @param {number} amount - Payment amount
 * @returns {Promise<Object>} Created notification
 */
const notifyPaymentStatus = async (userId, orderId, status, amount) => {
  try {
    let title, message;

    if (status === 'success') {
      title = 'Payment Successful';
      message = `Your payment of ETB ${amount.toFixed(2)} for order #${orderId} has been processed successfully.`;
    } else {
      title = 'Payment Failed';
      message = `Your payment for order #${orderId} could not be processed. Please try again.`;
    }

    return await createNotification(
      userId,
      'payment',
      title,
      message,
      orderId,
      'payment'
    );
  } catch (error) {
    console.error('Error notifying payment status:', error);
    throw error;
  }
};

/**
 * Get all notifications for a user
 * @param {number} userId - User ID
 * @param {boolean} unreadOnly - If true, return only unread notifications
 * @param {number} limit - Maximum number of notifications to return
 * @returns {Promise<Array>} Array of notifications
 */
const getUserNotifications = async (userId, unreadOnly = false, limit = 50) => {
  try {
    const where = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
    });

    return notifications;
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {number} notificationId - Notification ID
 * @param {number} userId - User ID (for authorization)
 * @returns {Promise<Object>} Updated notification
 */
const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Notification not found or unauthorized');
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>} Number of notifications updated
 */
const markAllAsRead = async (userId) => {
  try {
    const [updatedCount] = await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId, isRead: false } }
    );

    console.log(`Marked ${updatedCount} notifications as read for user ${userId}`);
    return updatedCount;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Delete a notification
 * @param {number} notificationId - Notification ID
 * @param {number} userId - User ID (for authorization)
 * @returns {Promise<boolean>} True if deleted
 */
const deleteNotification = async (notificationId, userId) => {
  try {
    const deleted = await Notification.destroy({
      where: { id: notificationId, userId },
    });

    return deleted > 0;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

/**
 * Get unread notification count for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>} Count of unread notifications
 */
const getUnreadCount = async (userId) => {
  try {
    const count = await Notification.count({
      where: { userId, isRead: false },
    });

    return count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
};

/**
 * Send SMS Notification (mock)
 * @param {object} options Options to send SMS
 * @param {string} options.to Phone number
 * @param {string} options.message Text message content
 * @param {string} options.trackingUrl Optional tracking URL
 */
const sendSMS = async (options) => {
  // Use Twilio, Africa's Talking, or local SMS gateway
  // Implementation depends on SMS provider
  console.log('Mock SMS sent:', options);
  return { success: true, mock: true };
}

module.exports = {
  createNotification,
  notifyOrderStatus,
  notifySeller,
  notifySellerNewOrder,
  notifyPaymentStatus,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  sendSMS
};
