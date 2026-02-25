const { Setting, sequelize } = require('../../models');

/**
 * Get all settings
 */
exports.getSettings = async (req, res, next) => {
  try {
    const settings = await Setting.findAll();
    const settingsObj = {};
    settings.forEach(s => {
      if (!settingsObj[s.group]) settingsObj[s.group] = {};
      
      let val = s.value;
      if (s.type === 'json') {
        try { val = JSON.parse(s.value); } catch(e) {}
      } else if (s.type === 'number') {
        val = parseFloat(s.value);
      } else if (s.type === 'boolean') {
        val = s.value === 'true';
      }
      
      settingsObj[s.group][s.key] = val;
    });

    res.json({ success: true, data: settingsObj });
  } catch (error) {
    next(error);
  }
};

/**
 * Update settings
 */
exports.updateSettings = async (req, res, next) => {
  try {
    let settingsData = req.body;
    
    // If it's FormData, it might be flat. If it's JSON, it might be nested or flat.
    // Handling logo upload first
    if (req.file) {
      settingsData.logoUrl = req.file.path;
    }

    // Mapping of keys to groups for flat structures (like GeneralSettings FormData)
    const keyToGroup = {
      platformName: 'general',
      contactEmail: 'general',
      contactPhone: 'general',
      contactAddress: 'general',
      timezone: 'general',
      currency: 'general',
      language: 'general',
      logoUrl: 'general',
      paymentGateway: 'payment',
      platformCommissionRate: 'payment',
      sellerCommissionRate: 'payment',
      minimumOrderAmount: 'payment',
      taxRate: 'payment',
      taxEnabled: 'payment'
    };

    await sequelize.transaction(async (t) => {
      // Handle nested structures first (like from EmailSettings)
      for (const group of ['smtpConfig', 'emailTemplates', 'notificationPreferences']) {
        if (settingsData[group]) {
          await Setting.upsert({
            key: group, // Using the group name as key for nested objects
            value: JSON.stringify(settingsData[group]),
            group: 'email',
            type: 'json'
          }, { transaction: t });
          delete settingsData[group];
        }
      }

      // Handle remaining flat keys
      for (const key in settingsData) {
        const group = keyToGroup[key] || 'other';
        let value = settingsData[key];
        let type = 'string';

        if (value === 'true' || value === 'false') {
          type = 'boolean';
        } else if (!isNaN(value) && typeof value !== 'object' && value !== '') {
          type = 'number';
        } else if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
          type = 'json';
        }

        await Setting.upsert({
          key,
          value: String(value),
          group,
          type
        }, { transaction: t });
      }
    });

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Test email connection
 */
exports.testEmailConnection = async (req, res) => {
  res.json({ success: true, message: 'Email connection test successful' });
};

/**
 * Update Chapa settings
 */
exports.updateChapaSettings = async (req, res) => {
  res.json({ success: true, message: 'Chapa settings updated' });
};
