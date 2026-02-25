const { Category, Product, sequelize } = require('../../models');

/**
 * Get all categories (Admin)
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      include: [
        { model: Category, as: 'children' },
        { model: Product, as: 'products', attributes: ['id'] }
      ],
      where: { parentId: null },
      order: [['sort_order', 'ASC'], ['name', 'ASC']]
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

/**
 * Create category
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, slug, description, parentId, status } = req.body;
    const image = req.file ? req.file.path : null;

    const category = await Category.create({
      name,
      slug,
      description,
      parentId: parentId || null,
      status: status || 'active',
      image
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

/**
 * Update category
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { name, slug, description, parentId, status } = req.body;
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const updateData = {
      name,
      slug,
      description,
      parentId: parentId || null,
      status
    };

    if (req.file) {
      updateData.image = req.file.path;
    }

    await category.update(updateData);

    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete category
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const productCount = await Product.count({ where: { categoryId: category.id } });
    if (productCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete category with associated products',
        hasProducts: true,
        productsCount: productCount
      });
    }

    const childrenCount = await Category.count({ where: { parentId: category.id } });
    if (childrenCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete category with subcategories',
        hasChildren: true,
        childrenCount: childrenCount
      });
    }

    await category.destroy();

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Reorder categories
 */
exports.reorderCategories = async (req, res, next) => {
  try {
    const { order } = req.body;
    
    await sequelize.transaction(async (t) => {
      for (const item of order) {
        await Category.update(
          { sort_order: item.sort_order, parentId: item.parentId },
          { where: { id: item.id }, transaction: t }
        );
      }
    });

    res.json({ success: true, message: 'Categories reordered successfully' });
  } catch (error) {
    next(error);
  }
};
