const CategoryTemplate = require('../models/CategoryTemplate');

/**
 * Category Template Service
 * Handles category template retrieval and caching for variant options
 */

// In-memory cache for category templates
let templateCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Get template for a specific category
 * @param {string} categoryName - Name of the category
 * @returns {Promise<Object|null>} Template object or null if not found
 */
const getTemplate = async (categoryName) => {
  try {
    // Check if cache is valid
    if (templateCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL)) {
      const cachedTemplate = templateCache.find(t => t.category_name.toLowerCase() === categoryName.toLowerCase());
      if (cachedTemplate) {
        console.log(`Template for ${categoryName} retrieved from cache`);
        return cachedTemplate;
      }
    }

    // Fetch from database if not in cache or cache expired
    const template = await CategoryTemplate.findOne({
      where: {
        category_name: categoryName
      }
    });

    if (template) {
      console.log(`Template for ${categoryName} retrieved from database`);
      // Update cache
      await refreshCache();
    }

    return template;
  } catch (error) {
    console.error('Error fetching category template:', error);
    throw error;
  }
};

/**
 * Get all templates
 * Uses cache if available and valid
 * @returns {Promise<Array>} Array of all category templates
 */
const getAllTemplates = async () => {
  try {
    // Check if cache is valid
    if (templateCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL)) {
      console.log('All templates retrieved from cache');
      return templateCache;
    }

    // Fetch from database if cache is invalid
    const templates = await CategoryTemplate.findAll({
      order: [['category_name', 'ASC']]
    });

    // Update cache
    templateCache = templates;
    cacheTimestamp = Date.now();

    console.log(`Fetched ${templates.length} templates from database and updated cache`);
    return templates;
  } catch (error) {
    console.error('Error fetching all category templates:', error);
    throw error;
  }
};

/**
 * Refresh the template cache
 * @returns {Promise<Array>} Updated cache
 */
const refreshCache = async () => {
  try {
    const templates = await CategoryTemplate.findAll({
      order: [['category_name', 'ASC']]
    });

    templateCache = templates;
    cacheTimestamp = Date.now();

    console.log(`Cache refreshed with ${templates.length} templates`);
    return templates;
  } catch (error) {
    console.error('Error refreshing template cache:', error);
    throw error;
  }
};

/**
 * Clear the template cache
 * Useful after seeding or updating templates
 */
const clearCache = () => {
  templateCache = null;
  cacheTimestamp = null;
  console.log('Template cache cleared');
};

/**
 * Seed default category templates
 * Creates predefined templates for common categories
 * @returns {Promise<Object>} Result object with created templates
 */
const seedDefaultTemplates = async () => {
  try {
    const defaultTemplates = [
      {
        category_name: 'Clothing',
        template_options: {
          options: [
            {
              name: 'Size',
              values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
            },
            {
              name: 'Color',
              values: ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Gray', 'Brown']
            },
            {
              name: 'Material',
              values: ['Cotton', 'Polyester', 'Wool', 'Silk', 'Linen', 'Denim', 'Leather']
            }
          ]
        }
      },
      {
        category_name: 'Electronics',
        template_options: {
          options: [
            {
              name: 'Storage',
              values: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB']
            },
            {
              name: 'RAM',
              values: ['2GB', '4GB', '6GB', '8GB', '12GB', '16GB', '32GB']
            },
            {
              name: 'Color',
              values: ['Black', 'White', 'Silver', 'Gold', 'Blue', 'Red', 'Green']
            },
            {
              name: 'Model',
              values: ['Standard', 'Pro', 'Plus', 'Max', 'Ultra']
            }
          ]
        }
      },
      {
        category_name: 'Phones',
        template_options: {
          options: [
            {
              name: 'Storage',
              values: ['64GB', '128GB', '256GB', '512GB', '1TB']
            },
            {
              name: 'RAM',
              values: ['4GB', '6GB', '8GB', '12GB', '16GB']
            },
            {
              name: 'Color',
              values: ['Black', 'White', 'Silver', 'Gold', 'Blue', 'Red', 'Green', 'Purple', 'Pink']
            },
            {
              name: 'Model',
              values: ['Standard', 'Pro', 'Pro Max', 'Plus', 'Ultra']
            }
          ]
        }
      },
      {
        category_name: 'PCs',
        template_options: {
          options: [
            {
              name: 'Storage',
              values: ['256GB SSD', '512GB SSD', '1TB SSD', '2TB SSD', '1TB HDD', '2TB HDD']
            },
            {
              name: 'RAM',
              values: ['8GB', '16GB', '32GB', '64GB']
            },
            {
              name: 'Color',
              values: ['Black', 'White', 'Silver', 'Gray', 'Blue']
            },
            {
              name: 'Model',
              values: ['Home', 'Business', 'Gaming', 'Workstation']
            }
          ]
        }
      }
    ];

    const createdTemplates = [];
    const skippedTemplates = [];

    for (const templateData of defaultTemplates) {
      try {
        // Check if template already exists
        const existing = await CategoryTemplate.findOne({
          where: { category_name: templateData.category_name }
        });

        if (existing) {
          console.log(`Template for ${templateData.category_name} already exists, skipping`);
          skippedTemplates.push(templateData.category_name);
          continue;
        }

        // Create new template
        const template = await CategoryTemplate.create(templateData);
        createdTemplates.push(template);
        console.log(`Created template for ${templateData.category_name}`);
      } catch (error) {
        console.error(`Error creating template for ${templateData.category_name}:`, error.message);
      }
    }

    // Clear cache after seeding
    clearCache();

    return {
      success: true,
      created: createdTemplates.length,
      skipped: skippedTemplates.length,
      createdTemplates: createdTemplates.map(t => t.category_name),
      skippedTemplates
    };
  } catch (error) {
    console.error('Error seeding default templates:', error);
    throw error;
  }
};

/**
 * Create or update a category template
 * @param {string} categoryName - Name of the category
 * @param {Object} templateOptions - Template options object
 * @returns {Promise<Object>} Created or updated template
 */
const createOrUpdateTemplate = async (categoryName, templateOptions) => {
  try {
    const [template, created] = await CategoryTemplate.upsert({
      category_name: categoryName,
      template_options: templateOptions
    }, {
      returning: true
    });

    // Clear cache after update
    clearCache();

    console.log(`Template for ${categoryName} ${created ? 'created' : 'updated'}`);
    return template;
  } catch (error) {
    console.error('Error creating/updating category template:', error);
    throw error;
  }
};

module.exports = {
  getTemplate,
  getAllTemplates,
  refreshCache,
  clearCache,
  seedDefaultTemplates,
  createOrUpdateTemplate
};
