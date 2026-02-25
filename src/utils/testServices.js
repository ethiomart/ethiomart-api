/**
 * Test script for email and notification services
 * This is a simple verification script to ensure services are properly configured
 */

const { User, Order, OrderItem, Product, Payment, Seller } = require('../models');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

async function testServices() {
  try {
    console.log('Testing Email and Notification Services...\n');

    // Test 1: Email Service Configuration
    console.log('1. Testing Email Service Configuration...');
    console.log('   Email Host:', process.env.EMAIL_HOST || 'Not configured');
    console.log('   Email User:', process.env.EMAIL_USER || 'Not configured');
    console.log('   Email From:', process.env.EMAIL_FROM || 'Not configured');
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('   ⚠️  Email credentials not configured in .env file');
      console.log('   Email service will not send actual emails until configured.\n');
    } else {
      console.log('   ✓ Email service is configured\n');
    }

    // Test 2: Notification Service - Create a test notification
    console.log('2. Testing Notification Service...');
    
    // Find a test user
    const testUser = await User.findOne({ where: { role: 'customer' } });
    
    if (testUser) {
      console.log(`   Found test user: ${testUser.email}`);
      
      // Create a test notification
      const notification = await notificationService.createNotification(
        testUser.id,
        'system',
        'Test Notification',
        'This is a test notification to verify the notification service is working.',
        null,
        null
      );
      
      console.log(`   ✓ Created notification ID: ${notification.id}`);
      
      // Get user notifications
      const notifications = await notificationService.getUserNotifications(testUser.id, false, 5);
      console.log(`   ✓ Retrieved ${notifications.length} notification(s) for user`);
      
      // Get unread count
      const unreadCount = await notificationService.getUnreadCount(testUser.id);
      console.log(`   ✓ User has ${unreadCount} unread notification(s)`);
      
      // Mark as read
      await notificationService.markAsRead(notification.id, testUser.id);
      console.log(`   ✓ Marked notification as read`);
      
      // Delete test notification
      await notificationService.deleteNotification(notification.id, testUser.id);
      console.log(`   ✓ Deleted test notification\n`);
    } else {
      console.log('   ⚠️  No test user found. Run seed script first.\n');
    }

    // Test 3: Test notification functions
    console.log('3. Testing Notification Functions...');
    
    if (testUser) {
      // Test order status notification
      const orderNotif = await notificationService.notifyOrderStatus(testUser.id, 12345, 'shipped');
      console.log(`   ✓ Created order status notification: "${orderNotif.title}"`);
      await notificationService.deleteNotification(orderNotif.id, testUser.id);
      
      // Test payment notification
      const paymentNotif = await notificationService.notifyPaymentStatus(testUser.id, 12345, 'success', 1500.00);
      console.log(`   ✓ Created payment notification: "${paymentNotif.title}"`);
      await notificationService.deleteNotification(paymentNotif.id, testUser.id);
    }

    // Test seller notification
    const testSeller = await Seller.findOne();
    if (testSeller) {
      const sellerNotif = await notificationService.notifySeller(
        testSeller.id,
        'This is a test message for the seller.',
        'Test Seller Notification'
      );
      console.log(`   ✓ Created seller notification: "${sellerNotif.title}"`);
      await notificationService.deleteNotification(sellerNotif.id, testSeller.userId);
    }

    console.log('\n✅ All service tests completed successfully!');
    console.log('\nNote: To test actual email sending, configure EMAIL_USER and EMAIL_PASS in .env');
    console.log('      and call the email service functions with real data.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error testing services:', error);
    process.exit(1);
  }
}

// Run tests
testServices();
