const { Product, Seller, Category } = require('../../models');
const { Op } = require('sequelize');

/**
 * Get all products (Admin view)
 */
exports.getAllProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, category, status } = req.query;
    const where = {};

    if (category) where.category_id = category;
    if (status) where.approval_status = status;
    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        { model: Seller, as: 'seller', attributes: ['store_name'] },
        { model: Category, as: 'category', attributes: ['name'] }
      ],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending products
 */
exports.getPendingProducts = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: { approval_status: 'pending' },
      include: [
        { model: Seller, as: 'seller', attributes: ['store_name'] },
        { model: Category, as: 'category', attributes: ['name'] }
      ]
    });

    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve product
 */
exports.approveProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await product.update({
      approval_status: 'approved',
      approved_by: req.user.id,
      approved_at: new Date()
    });

    res.json({ success: true, message: 'Product approved successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject product
 */
exports.rejectProduct = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await product.update({
      approval_status: 'rejected',
      rejection_reason: reason
    });

    res.json({ success: true, message: 'Product rejected' });
  } catch (error) {
    next(error);
  }
};

/**
 * Feature/Unfeature product
 */
exports.featureProduct = async (req, res, next) => {
  try {
    const { featured } = req.body;
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await product.update({ is_featured: featured });

    res.json({ 
      success: true, 
      message: `Product ${featured ? 'featured' : 'unfeatured'} successfully`,
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await product.destroy();

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};
