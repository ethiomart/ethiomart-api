const nodemailer = require('nodemailer');

/**
 * Email Service
 * Handles sending emails for various platform events
 */

// Create reusable transporter
const createTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  // Check for placeholder credentials
  if (!user || user === 'your-email@gmail.com' || !pass || pass === 'your-app-password') {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: user,
      pass: pass,
    },
    // Add timeout to prevent hanging
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
};

/**
 * Send email with graceful degradation
 * Wraps email sending with error handling that doesn't throw
 * @param {Function} emailFunction - The email function to execute
 * @param {string} emailType - Type of email for logging (e.g., 'payment confirmation')
 * @returns {Promise<Object>} Result object with success status
 */
const sendEmailWithGracefulDegradation = async (emailFunction, emailType) => {
  try {
    const result = await emailFunction();
    return { success: true, ...result };
  } catch (error) {
    console.error(`Failed to send ${emailType} email:`, error.message);
    
    // Log detailed error for debugging
    console.error(`Email error details:`, {
      type: emailType,
      error: error.message,
      code: error.code,
      command: error.command,
      timestamp: new Date().toISOString()
    });
    
    // Return failure but don't throw - graceful degradation
    return {
      success: false,
      error: error.message,
      message: `Email sending failed but operation continued`
    };
  }
};

/**
 * Send a generic email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {array} attachments - Optional attachments
 * @returns {Promise<Object>} Email send result
 */
const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.warn('📧 Email Service: Skipping email send - placeholders detected in credentials.');
      return { success: false, message: 'Skipped due to missing credentials' };
    }
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
      to,
      subject,
      html,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    if (error.code === 'EAUTH') {
      console.error('📧 Email Service: Authentication failed. Please check EMAIL_USER and EMAIL_PASS in .env.');
    } else {
      console.error('Error sending email:', error.message);
    }
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email to newly registered user
 * @param {Object} user - User object with email, firstName, lastName
 * @returns {Promise<Object>} Email send result
 */
const sendWelcomeEmail = async (user) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
      to: user.email,
      subject: 'Welcome to Our E-Commerce Platform!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome ${user.firstName}!</h2>
          <p>Thank you for registering with our multi-vendor e-commerce platform.</p>
          <p>You can now:</p>
          <ul>
            <li>Browse thousands of products from multiple sellers</li>
            <li>Add items to your cart and wishlist</li>
            <li>Complete secure purchases with Chapa payment</li>
            <li>Track your orders in real-time</li>
          </ul>
          ${user.role === 'seller' ? `
            <p><strong>As a seller, you can also:</strong></p>
            <ul>
              <li>List and manage your products</li>
              <li>Track your sales and orders</li>
              <li>Manage your seller profile</li>
            </ul>
          ` : ''}
          <p>Happy shopping!</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            If you didn't create this account, please ignore this email.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

/**
 * Send order confirmation email to customer
 * @param {Object} order - Order object with id, totalAmount, OrderItems, User, shippingAddress
 * @returns {Promise<Object>} Email send result
 */
const sendOrderConfirmation = async (order) => {
  try {
    const transporter = createTransporter();
    
    // Build order items HTML
    const orderItemsHtml = order.OrderItems.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.Product?.name || 'Product'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">ETB ${item.priceAtPurchase.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">ETB ${(item.quantity * item.priceAtPurchase).toFixed(2)}</td>
      </tr>
    `).join('');

    const shippingAddress = typeof order.shippingAddress === 'string' 
      ? JSON.parse(order.shippingAddress) 
      : order.shippingAddress;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
      to: order.User.email,
      subject: `Order Confirmation - Order #${order.id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Order Confirmation</h2>
          <p>Hi ${order.User.firstName},</p>
          <p>Thank you for your order! We've received your order and it's being processed.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0;">Order Details</h3>
            <p><strong>Order Number:</strong> #${order.id}</p>
            <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${order.status}</p>
          </div>

          <h3>Order Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Quantity</th>
                <th style="padding: 10px; text-align: right;">Price</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 15px; text-align: right; font-weight: bold;">Total:</td>
                <td style="padding: 15px; text-align: right; font-weight: bold; font-size: 18px;">ETB ${order.totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0;">Shipping Address</h3>
            <p>
              ${shippingAddress.fullName || order.User.firstName + ' ' + order.User.lastName}<br>
              ${shippingAddress.addressLine1}<br>
              ${shippingAddress.addressLine2 ? shippingAddress.addressLine2 + '<br>' : ''}
              ${shippingAddress.city}, ${shippingAddress.state || ''} ${shippingAddress.postalCode || ''}<br>
              ${shippingAddress.country || 'Ethiopia'}<br>
              Phone: ${shippingAddress.phone}
            </p>
          </div>

          <p>We'll send you another email when your order ships.</p>
          <p>Thank you for shopping with us!</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Order confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    throw error;
  }
};

/**
 * Send payment receipt email to customer
 * @param {Object} payment - Payment object with amount, chapaReference, Order, Order.User
 * @returns {Promise<Object>} Email send result
 */
const sendPaymentReceipt = async (payment) => {
  try {
    const transporter = createTransporter();
    
    const order = payment.Order;
    const user = order.User;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
      to: user.email,
      subject: `Payment Receipt - Order #${order.id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Payment Successful!</h2>
          <p>Hi ${user.firstName},</p>
          <p>Your payment has been successfully processed.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0;">Payment Details</h3>
            <p><strong>Order Number:</strong> #${order.id}</p>
            <p><strong>Payment Date:</strong> ${new Date(payment.createdAt).toLocaleDateString()}</p>
            <p><strong>Payment Method:</strong> ${payment.paymentMethod || 'Chapa'}</p>
            <p><strong>Transaction Reference:</strong> ${payment.chapaReference}</p>
            <p><strong>Amount Paid:</strong> <span style="font-size: 20px; color: #28a745;">ETB ${payment.amount.toFixed(2)}</span></p>
            <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">${payment.status}</span></p>
          </div>

          <div style="background-color: #e7f3ff; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #007bff;">
            <p style="margin: 0;"><strong>What's Next?</strong></p>
            <p style="margin: 10px 0 0 0;">Your order is now being prepared for shipment. You'll receive a shipping confirmation email once your items are on their way.</p>
          </div>

          <p>Thank you for your purchase!</p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated receipt. Please keep it for your records.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Payment receipt email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending payment receipt email:', error);
    throw error;
  }
};

/**
 * Send payment confirmation email to customer
 * @param {Object} paymentData - Payment data object
 * @param {string} paymentData.email - Customer email
 * @param {string} paymentData.firstName - Customer first name
 * @param {string} paymentData.lastName - Customer last name
 * @param {number} paymentData.orderId - Order ID
 * @param {string} paymentData.orderNumber - Order number
 * @param {number} paymentData.amount - Payment amount
 * @param {string} paymentData.currency - Payment currency (ETB or USD)
 * @param {string} paymentData.paymentMethod - Payment method used
 * @param {string} paymentData.reference - Chapa transaction reference
 * @returns {Promise<Object>} Email send result
 */
const sendPaymentConfirmation = async (paymentData) => {
  try {
    const transporter = createTransporter();
    
    const {
      email,
      firstName,
      lastName,
      orderId,
      orderNumber,
      amount,
      currency = 'ETB',
      paymentMethod,
      reference
    } = paymentData;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
      to: email,
      subject: `Payment Confirmed - Order #${orderNumber || orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✓ Payment Successful!</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi ${firstName || 'Customer'},</p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Great news! Your payment has been successfully processed and confirmed. Your order is now being prepared for shipment.
            </p>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #28a745;">
              <h2 style="color: #333; margin-top: 0; font-size: 20px;">Payment Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Order Number:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right; font-size: 14px;">#${orderNumber || orderId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Payment Date:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right; font-size: 14px;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Payment Method:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right; font-size: 14px;">${paymentMethod || 'Chapa'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Transaction Reference:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right; font-size: 14px; word-break: break-all;">${reference}</td>
                </tr>
                <tr style="border-top: 2px solid #dee2e6;">
                  <td style="padding: 15px 0 8px 0; color: #333; font-size: 16px; font-weight: bold;">Amount Paid:</td>
                  <td style="padding: 15px 0 8px 0; color: #28a745; font-weight: bold; text-align: right; font-size: 20px;">${currency} ${parseFloat(amount).toFixed(2)}</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #e7f3ff; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #007bff;">
              <h3 style="color: #333; margin-top: 0; font-size: 18px;">📦 What's Next?</h3>
              <ul style="color: #555; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
                <li>Your order is now confirmed and being prepared</li>
                <li>You'll receive a shipping confirmation email once your items are dispatched</li>
                <li>Track your order status anytime in your account</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://app.example.com'}/orders/${orderId}" 
                 style="display: inline-block; background-color: #667eea; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                View Order Details
              </a>
            </div>
            
            <p style="font-size: 16px; color: #333; margin-top: 30px;">
              Thank you for shopping with us!
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              If you have any questions about your order, please don't hesitate to contact our support team.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p style="margin: 5px 0;">This is an automated email. Please keep it for your records.</p>
            <p style="margin: 5px 0;">© ${new Date().getFullYear()} Multi-Vendor E-Commerce Platform. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Payment confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    throw error;
  }
};

/**
 * Send payment failure email to customer
 * @param {Object} paymentData - Payment data object
 * @param {string} paymentData.email - Customer email
 * @param {string} paymentData.firstName - Customer first name
 * @param {string} paymentData.lastName - Customer last name
 * @param {number} paymentData.orderId - Order ID
 * @param {string} paymentData.orderNumber - Order number
 * @param {number} paymentData.amount - Payment amount
 * @param {string} paymentData.currency - Payment currency (ETB or USD)
 * @param {string} paymentData.reference - Chapa transaction reference
 * @param {string} paymentData.failureReason - Reason for payment failure
 * @returns {Promise<Object>} Email send result
 */
const sendPaymentFailure = async (paymentData) => {
  try {
    const transporter = createTransporter();
    
    const {
      email,
      firstName,
      lastName,
      orderId,
      orderNumber,
      amount,
      currency = 'ETB',
      reference,
      failureReason = 'Payment could not be processed'
    } = paymentData;
    
    // Convert technical error messages to user-friendly messages
    const getUserFriendlyReason = (reason) => {
      const lowerReason = reason.toLowerCase();
      if (lowerReason.includes('insufficient') || lowerReason.includes('balance')) {
        return 'Insufficient funds in your account';
      }
      if (lowerReason.includes('declined') || lowerReason.includes('rejected')) {
        return 'Payment was declined by your bank or payment provider';
      }
      if (lowerReason.includes('expired') || lowerReason.includes('timeout')) {
        return 'Payment session expired. Please try again';
      }
      if (lowerReason.includes('invalid') || lowerReason.includes('incorrect')) {
        return 'Invalid payment details provided';
      }
      if (lowerReason.includes('cancelled') || lowerReason.includes('canceled')) {
        return 'Payment was cancelled';
      }
      return reason;
    };
    
    const friendlyReason = getUserFriendlyReason(failureReason);
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
      to: email,
      subject: `Payment Failed - Order #${orderNumber || orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">⚠ Payment Failed</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi ${firstName || 'Customer'},</p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              We're sorry, but your payment could not be processed. Your order has not been confirmed.
            </p>
            
            <div style="background-color: #fff3cd; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #ffc107;">
              <h2 style="color: #856404; margin-top: 0; font-size: 20px;">Payment Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Order Number:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right; font-size: 14px;">#${orderNumber || orderId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Attempted Date:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right; font-size: 14px;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Transaction Reference:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right; font-size: 14px; word-break: break-all;">${reference}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-size: 14px;">Amount:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right; font-size: 16px;">${currency} ${parseFloat(amount).toFixed(2)}</td>
                </tr>
                <tr style="border-top: 2px solid #dee2e6;">
                  <td colspan="2" style="padding: 15px 0 8px 0;">
                    <p style="margin: 0; color: #856404; font-weight: bold; font-size: 14px;">Reason:</p>
                    <p style="margin: 5px 0 0 0; color: #333; font-size: 14px;">${friendlyReason}</p>
                  </td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #f8d7da; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #dc3545;">
              <h3 style="color: #721c24; margin-top: 0; font-size: 18px;">🔍 Common Solutions</h3>
              <ul style="color: #721c24; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
                <li>Verify your payment details are correct</li>
                <li>Ensure you have sufficient funds in your account</li>
                <li>Check with your bank if the transaction was blocked</li>
                <li>Try using a different payment method</li>
                <li>Contact your bank or payment provider for assistance</li>
              </ul>
            </div>
            
            <div style="background-color: #e7f3ff; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #007bff;">
              <h3 style="color: #333; margin-top: 0; font-size: 18px;">💡 What's Next?</h3>
              <p style="color: #555; line-height: 1.8; margin: 10px 0;">
                Don't worry! Your order is still saved in your account. You can retry the payment anytime by visiting your order page.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://app.example.com'}/orders/${orderId}" 
                 style="display: inline-block; background-color: #dc3545; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin-right: 10px;">
                Retry Payment
              </a>
              <a href="${process.env.FRONTEND_URL || 'https://app.example.com'}/support" 
                 style="display: inline-block; background-color: #6c757d; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Contact Support
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
              If you continue to experience issues, please contact our support team for assistance.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p style="margin: 5px 0;">This is an automated notification email.</p>
            <p style="margin: 5px 0;">© ${new Date().getFullYear()} Multi-Vendor E-Commerce Platform. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Payment failure email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending payment failure email:', error);
    throw error;
  }
};

/**
 * Send order status update email to customer
 */
const sendStatusUpdate = async ({ to, orderId, status, message, trackingNumber, carrier, estimatedDelivery, trackingUrl }) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
      to: to,
      subject: `Order Update - Order #${orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Order Update</h2>
          <p>${message}</p>
          <p><strong>Order ID:</strong> #${orderId}</p>
          <p><strong>Status:</strong> ${status}</p>
          ${trackingNumber ? `<p><strong>Tracking Number:</strong> ${trackingNumber}</p>` : ''}
          ${carrier ? `<p><strong>Carrier:</strong> ${carrier}</p>` : ''}
          ${estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${new Date(estimatedDelivery).toLocaleDateString()}</p>` : ''}
          ${trackingUrl ? `<p><a href="${trackingUrl}">Track your order here</a></p>` : ''}
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Status update email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending status update email:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendOrderConfirmation,
  sendPaymentReceipt,
  sendPaymentConfirmation,
  sendPaymentFailure,
  sendStatusUpdate,
  sendEmailWithGracefulDegradation,
};
