const express = require('express');
const router = express.Router();
const categoryTemplateService = require('../services/categoryTemplateService');

/**
 * @route   GET /api/categories/:categoryId/template
 * @desc    Get variant template for a category
 * @access  Public
 */
router.get('/:categoryId/template', async (req, res) => {
  try {
    const { categoryId } = req.params;

    // For now, we'll use categoryId as the category name
    // In a full implementation, you might want to look up the category by ID first
    const template = await categoryTemplateService.getTemplate(categoryId);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: `No template found for category: ${categoryId}`
      });
    }

    // Format response according to design spec
    const formattedTemplate = {
      category_name: template.category_name,
      template_options: template.template_options.options.map(option => ({
        name: option.name,
        suggested_values: option.values
      }))
    };

    res.json({
      success: true,
      data: formattedTemplate
    });
  } catch (error) {
    console.error('Error fetching category template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category template',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/categories/templates
 * @desc    Get all category templates
 * @access  Public
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = await categoryTemplateService.getAllTemplates();

    const formattedTemplates = templates.map(template => ({
      category_name: template.category_name,
      template_options: template.template_options.options.map(option => ({
        name: option.name,
        suggested_values: option.values
      }))
    }));

    res.json({
      success: true,
      data: formattedTemplates
    });
  } catch (error) {
    console.error('Error fetching all templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category templates',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/categories/templates/seed
 * @desc    Seed default category templates
 * @access  Public (should be protected in production)
 */
router.post('/templates/seed', async (req, res) => {
  try {
    const result = await categoryTemplateService.seedDefaultTemplates();

    res.json({
      success: true,
      message: 'Default templates seeded successfully',
      data: result
    });
  } catch (error) {
    console.error('Error seeding templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed default templates',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/categories/templates/refresh-cache
 * @desc    Manually refresh the template cache
 * @access  Public (should be protected in production)
 */
router.post('/templates/refresh-cache', async (req, res) => {
  try {
    const templates = await categoryTemplateService.refreshCache();

    res.json({
      success: true,
      message: 'Template cache refreshed successfully',
      data: {
        count: templates.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error refreshing cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh template cache',
      error: error.message
    });
  }
});

module.exports = router;
