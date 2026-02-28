const Category = require('../models/Category');

/**
 * Create a new category
 * @route POST /api/categories
 * @access Private/Admin
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, description, parentId } = req.body;

    // If parentId is provided, verify parent category exists
    if (parentId) {
      const parentCategory = await Category.findByPk(parentId);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: 'Parent category not found'
        });
      }
    }

    // Create category
    const category = await Category.create({
      name,
      description,
      parent_id: parentId || null
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        category
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all categories as a tree structure
 * @route GET /api/categories
 * @access Public
 */
const getAllCategories = async (req, res, next) => {
  try {
    // Fetch all categories
    const categories = await Category.findAll({
      order: [['name', 'ASC']]
    });

    // Build category tree
    const categoryMap = {};
    const rootCategories = [];

    // First pass: create map of all categories
    categories.forEach(category => {
      categoryMap[category.id] = {
        id: category.id,
        name: category.name,
        description: category.description,
        parentId: category.parent_id,
        createdAt: category.created_at,
        updatedAt: category.updated_at,
        children: []
      };
    });

    // Second pass: build tree structure
    categories.forEach(category => {
      if (category.parent_id === null) {
        rootCategories.push(categoryMap[category.id]);
      } else if (categoryMap[category.parent_id]) {
        categoryMap[category.parent_id].children.push(categoryMap[category.id]);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      data: {
        categories: rootCategories,
        totalCount: categories.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a category
 * @route PUT /api/categories/:id
 * @access Private/Admin
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, parentId } = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // If parentId is being updated, verify it exists and prevent circular reference
    if (parentId !== undefined) {
      if (parentId !== null) {
        // Check if parent exists
        const parentCategory = await Category.findByPk(parentId);
        if (!parentCategory) {
          return res.status(404).json({
            success: false,
            message: 'Parent category not found'
          });
        }

        // Prevent setting self as parent
        if (parseInt(parentId) === parseInt(id)) {
          return res.status(400).json({
            success: false,
            message: 'Category cannot be its own parent'
          });
        }

        // Prevent circular reference (check if new parent is a descendant)
        const isDescendant = await checkIfDescendant(id, parentId);
        if (isDescendant) {
          return res.status(400).json({
            success: false,
            message: 'Cannot set a descendant category as parent (circular reference)'
          });
        }
      }
    }

    // Update category fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (parentId !== undefined) updateData.parent_id = parentId;

    await category.update(updateData);

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: {
        category
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a category
 * @route DELETE /api/categories/:id
 * @access Private/Admin
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const Product = require('../models/Product');

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has children
    const childrenCount = await Category.count({
      where: { parent_id: id }
    });

    if (childrenCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with subcategories. Delete or reassign subcategories first.',
        hasChildren: true,
        childrenCount
      });
    }

    // Check if category has associated products
    const productsCount = await Product.count({
      where: { category_id: id }
    });

    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productsCount} associated product${productsCount > 1 ? 's' : ''}. Please reassign or delete the products first.`,
        hasProducts: true,
        productsCount
      });
    }

    await category.destroy();

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to check if a category is a descendant of another
 * @param {number} ancestorId - The potential ancestor category ID
 * @param {number} descendantId - The potential descendant category ID
 * @returns {Promise<boolean>}
 */
const checkIfDescendant = async (ancestorId, descendantId) => {
  let currentId = descendantId;
  
  while (currentId !== null) {
    const category = await Category.findByPk(currentId);
    if (!category) break;
    
    if (category.parent_id === null) break;
    if (parseInt(category.parent_id) === parseInt(ancestorId)) return true;
    
    currentId = category.parent_id;
  }
  
  return false;
};

module.exports = {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory
};
