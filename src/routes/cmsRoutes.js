const express = require('express');
const router = express.Router();
const { Banner } = require('../models');
const { Op } = require('sequelize');

/**
 * Get active banners for consumers
 */
router.get('/banners', async (req, res, next) => {
  try {
    const { position } = req.query;
    
    const where = {
      is_active: true
    };

    if (position) {
      where.position = position;
    }

    // Filter by date if applicable
    const now = new Date();
    where[Op.and] = [
      {
        [Op.or]: [
          { start_date: null },
          { start_date: { [Op.lte]: now } }
        ]
      },
      {
        [Op.or]: [
          { end_date: null },
          { end_date: { [Op.gte]: now } }
        ]
      }
    ];

    const banners = await Banner.findAll({
      where,
      order: [['sort_order', 'ASC']]
    });

    res.json({ success: true, data: banners });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
