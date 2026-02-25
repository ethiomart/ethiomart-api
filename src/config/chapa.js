require('dotenv').config();

// src/config/chapa.js
module.exports = {
  // API Keys
  secretKey: process.env.CHAPA_SECRET_KEY || 'CHASECK_TEST-iWOLGti88iaY6ooTKzk9LeXt7c8uOuOD',
  publicKey: process.env.CHAPA_PUBLIC_KEY || 'CHAPUBK_TEST-sTK9QNa1MBvsBipUXiTFg6rb1c7wRIJd',
  encryptionKey: process.env.CHAPA_ENCRYPTION_KEY || 'rpCSDdRO9FzSDHiVhYKrXKSg',
  apiUrl: process.env.CHAPA_API_URL || 'https://api.chapa.co/v1',
  webhookSecret: process.env.CHAPA_WEBHOOK_SECRET,
  isTestMode: process.env.CHAPA_TEST_MODE !== 'false',
  
  // Account Settings
  currency: 'ETB',
  callbackUrl: process.env.CHAPA_CALLBACK_URL || 'https://yourdomain.com/callback',
  returnUrl: process.env.CHAPA_RETURN_URL || 'https://yourdomain.com/success',
  internationalPayments: false,
  
  // Payment Methods Enabled
  paymentMethods: [
    { id: 'telebirr', name: 'Telebirr', type: 'mobile_money', icon: 'telebirr', popular: true },
    { id: 'cbebirr', name: 'CBEBirr', type: 'mobile_money', icon: 'cbebirr', popular: true },
    { id: 'awashbirr', name: 'AwashBirr', type: 'mobile_money', icon: 'awashbirr', popular: true },
    { id: 'mpesa', name: 'M-Pesa', type: 'mobile_money', icon: 'mpesa', popular: false },
    { id: 'ebirr', name: 'eBirr', type: 'wallet', icon: 'ebirr', popular: false },
    { id: 'kacha', name: 'Kacha Wallet', type: 'wallet', icon: 'kacha', popular: false },
    { id: 'card', name: 'Credit/Debit Card', type: 'card', icon: 'card', popular: true },
    { id: 'boa_card', name: 'BOA Card', type: 'card', icon: 'boa', popular: false },
    { id: 'pss_card', name: 'PSS Cards', type: 'card', icon: 'pss', popular: false },
    { id: 'bank_transfer', name: 'Bank Transfer', type: 'bank', icon: 'bank', popular: false },
    { id: 'cbe', name: 'Commercial Bank', type: 'bank', icon: 'cbe', popular: true },
    { id: 'zamzam', name: 'Zamzam Bank', type: 'bank', icon: 'zamzam', popular: false }
  ],
  
  // Fee Configuration
  merchantPaysFees: true,
  
  // Retry Settings
  retryEnabled: true,
  retryInterval: 60, // minutes
  timeoutBeforeRedirect: 0,
  
  // Customer Settings
  createCustomerProfile: true,
  enableApiTransfers: true,
  transferApproval: 'email_otp',
  
  // Notification Settings
  financeEmail: process.env.FINANCE_EMAIL || 'adaneyohannes11@gmail.com',
  exportEmail: process.env.EXPORT_EMAIL || 'adaneyohannes11@gmail.com',
  sendReceiptsToCustomers: true,
  sendTransactionReceipts: true,
  
  // Test Card Details
  testCard: {
    number: '4185250000000004',
    expiry: '12/25',
    cvv: '123',
    pin: '0000',
    otp: '123456'
  },
  
  // Bank codes for Ethiopia
  bankCodes: {
    CBE: 'CB10001', // Commercial Bank of Ethiopia
    DASHEN: 'DB10002', // Dashen Bank
    AWASH: 'AB10003', // Awash Bank
    BOA: 'BO10004', // Bank of Abyssinia
    ZAMZAM: 'ZZ10005', // Zamzam Bank
  }
};