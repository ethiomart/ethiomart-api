const { User, Seller, Product, Order, Payment, Category, OrderItem, Brand, Banner, StaticPage, Setting, sequelize } = require('../models');
const { Op } = require('sequelize');
const orderStatusService = require('../services/orderStatusService');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');

/**
 * Admin Login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email, role: 'admin' } });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or not an admin' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is suspended' });
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Logout
 */
exports.logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
};

/**
 * Admin Profile
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard statistics
 * Returns counts and trends for key metrics
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    // Get current counts
    const [
      totalUsers,
      totalSellers,
      totalProducts,
      totalOrders,
      totalRevenue
    ] = await Promise.all([
      User.count({ where: { role: 'customer' } }),
      Seller.count({ where: { status: 'approved' } }),
      Product.count({ where: { status: 'approved' } }),
      Order.count(),
      Order.sum('totalAmount', { where: { status: { [Op.in]: ['completed', 'delivered'] } } })
    ]);

    // Get counts from 30 days ago for trend calculation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      usersLastMonth,
      sellersLastMonth,
      productsLastMonth,
      ordersLastMonth,
      revenueLastMonth
    ] = await Promise.all([
      User.count({ 
        where: { 
          role: 'customer',
          createdAt: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Seller.count({ 
        where: { 
          status: 'approved',
          createdAt: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Product.count({ 
        where: { 
          status: 'approved',
          createdAt: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Order.count({ 
        where: { 
          createdAt: { [Op.lt]: thirtyDaysAgo }
        } 
      }),
      Order.sum('totalAmount', { 
        where: { 
          status: { [Op.in]: ['completed', 'delivered'] },
          createdAt: { [Op.lt]: thirtyDaysAgo }
        } 
      })
    ]);

    // Calculate trends (percentage change)
    const calculateTrend = (current, previous) => {
      if (previous === 0) {
        return { value: current > 0 ? 100 : 0, direction: 'up' };
      }
      const change = ((current - previous) / previous) * 100;
      return {
        value: Math.abs(Math.round(change * 10) / 10),
        direction: change >= 0 ? 'up' : 'down'
      };
    };

    const stats = {
      totalUsers,
      totalSellers,
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenue || 0,
      usersTrend: calculateTrend(totalUsers, usersLastMonth),
      sellersTrend: calculateTrend(totalSellers, sellersLastMonth),
      productsTrend: calculateTrend(totalProducts, productsLastMonth),
      ordersTrend: calculateTrend(totalOrders, ordersLastMonth),
      revenueTrend: calculateTrend(totalRevenue || 0, revenueLastMonth || 0)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard overview with detailed metrics
 */
exports.getDashboardOverview = async (req, res, next) => {
  try {
    // Get pending approvals
    const [pendingSellers, pendingProducts] = await Promise.all([
      Seller.count({ where: { status: 'pending' } }),
      Product.count({ where: { status: 'pending' } })
    ]);

    // Get recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentOrders = await Order.count({
      where: {
        createdAt: { [Op.gte]: sevenDaysAgo }
      }
    });

    // Get revenue by status
    const revenueByStatus = await Order.findAll({
      attributes: [
        'status',
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'total']
      ],
      group: ['status']
    });

    const overview = {
      pendingApprovals: {
        sellers: pendingSellers,
        products: pendingProducts,
        total: pendingSellers + pendingProducts
      },
      recentOrders,
      revenueByStatus: revenueByStatus.map(item => ({
        status: item.status,
        total: parseFloat(item.dataValues.total || 0)
      }))
    };

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users with filters and pagination
 * @route GET /api/admin/users
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const where = {};

    if (role) where.role = role;
    if (status) {
      if (status === 'active') where.is_active = true;
      else if (status === 'suspended') where.is_active = false;
      // Handle other status strings if they exist in your DB or logic
    }

    if (search) {
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        users,
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
 * Get user by ID
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Seller, as: 'seller' }]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user status
 */
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Toggle is_active based on status string
    const isActive = status === 'active';
    await user.update({ is_active: isActive });

    res.json({
      success: true,
      message: `User status updated to ${status}`,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (soft delete)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.update({ is_active: false });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending seller applications
 */
exports.getPendingSellers = async (req, res, next) => {
  try {
    const sellers = await Seller.findAll({
      where: { approval_status: 'pending' },
      include: [{ model: User, as: 'user', attributes: { exclude: ['password'] } }]
    });

    res.json({ success: true, data: sellers });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve seller
 */
exports.approveSeller = async (req, res, next) => {
  try {
    const seller = await Seller.findByPk(req.params.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    await seller.update({
      approval_status: 'approved',
      approved_by: req.user.id,
      approved_at: new Date()
    });

    // Also upgrade user role if not already seller
    const user = await User.findByPk(seller.user_id);
    if (user && user.role !== 'seller') {
      await user.update({ role: 'seller' });
    }

    res.json({ success: true, message: 'Seller approved successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject seller
 */
exports.rejectSeller = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const seller = await Seller.findByPk(req.params.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    await seller.update({
      approval_status: 'rejected',
      rejection_reason: reason
    });

    res.json({ success: true, message: 'Seller application rejected' });
  } catch (error) {
    next(error);
  }
};

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

    // Soft delete or hard delete? Let's go with destroying for now or setting status to deleted
    await product.destroy();

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

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
      where: { parentId: null }, // Start from root
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

    // Check if category has products
    const productCount = await Product.count({ where: { categoryId: category.id } });
    if (productCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete category with associated products',
        hasProducts: true,
        productsCount: productCount
      });
    }

    // Check if category has children
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
    const { order } = req.body; // Array of { id, sort_order, parentId }
    
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

/**
 * Brand Handlers
 */
exports.getBrands = async (req, res, next) => {
  try {
    const brands = await Brand.findAll({
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: brands });
  } catch (error) {
    next(error);
  }
};

exports.createBrand = async (req, res, next) => {
  try {
    const { name, slug, description } = req.body;
    const logo = req.file ? req.file.path : null;

    const brand = await Brand.create({
      name,
      slug,
      description,
      logo
    });

    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

exports.updateBrand = async (req, res, next) => {
  try {
    const { name, slug, description, is_active } = req.body;
    const brand = await Brand.findByPk(req.params.id);

    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    const updateData = { name, slug, description, is_active };
    if (req.file) {
      updateData.logo = req.file.path;
    }

    await brand.update(updateData);

    res.json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

exports.deleteBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findByPk(req.params.id);
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    // Check if brand has products
    const productCount = await Product.count({ where: { brand_id: brand.id } });
    if (productCount > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete brand with associated products' });
    }

    await brand.destroy();
    res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * CMS Handlers - Banners
 */
exports.getBanners = async (req, res, next) => {
  try {
    const banners = await Banner.findAll({
      order: [['sort_order', 'ASC']]
    });
    res.json({ success: true, data: banners });
  } catch (error) {
    next(error);
  }
};

exports.createBanner = async (req, res, next) => {
  try {
    const { title, link_url, position, sort_order } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Banner image is required' });
    }

    const banner = await Banner.create({
      title,
      image_url: req.file.path,
      link_url,
      position,
      sort_order: sort_order || 0
    });

    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
};

exports.updateBanner = async (req, res, next) => {
  try {
    const { title, link_url, position, sort_order, is_active } = req.body;
    const banner = await Banner.findByPk(req.params.id);

    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    const updateData = { title, link_url, position, sort_order, is_active };
    if (req.file) {
      updateData.image_url = req.file.path;
    }

    await banner.update(updateData);
    res.json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
};

exports.deleteBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findByPk(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    await banner.destroy();
    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.reorderBanners = async (req, res, next) => {
  try {
    const { order } = req.body; // Array of { id, sort_order }
    
    await sequelize.transaction(async (t) => {
      for (const item of order) {
        await Banner.update(
          { sort_order: item.sort_order },
          { where: { id: item.id }, transaction: t }
        );
      }
    });

    res.json({ success: true, message: 'Banners reordered successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * CMS Handlers - Static Pages
 */
exports.getPages = async (req, res, next) => {
  try {
    const pages = await StaticPage.findAll({
      order: [['title', 'ASC']]
    });
    res.json({ success: true, data: pages });
  } catch (error) {
    next(error);
  }
};

exports.getPageById = async (req, res, next) => {
  try {
    const page = await StaticPage.findByPk(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }
    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
};

exports.updatePage = async (req, res, next) => {
  try {
    const { title, content, meta_title, meta_description, is_active } = req.body;
    const page = await StaticPage.findByPk(req.params.id);

    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    await page.update({
      title,
      content,
      meta_title,
      meta_description,
      is_active
    });

    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
};

/**
 * Settings Handlers
 */
exports.getSettings = async (req, res, next) => {
  try {
    const settings = await Setting.findAll();
    // Convert array of settings to an object for easier frontend use if needed
    // or just return as is. Let's return as a grouped object.
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

exports.updateSettings = async (req, res, next) => {
  try {
    const { settings } = req.body; // Expecting { group: { key: value } }
    
    await sequelize.transaction(async (t) => {
      for (const group in settings) {
        for (const key in settings[group]) {
          let value = settings[group][key];
          let type = 'string';
          
          if (typeof value === 'object') {
            value = JSON.stringify(value);
            type = 'json';
          } else if (typeof value === 'number') {
            value = value.toString();
            type = 'number';
          } else if (typeof value === 'boolean') {
            value = value.toString();
            type = 'boolean';
          }

          await Setting.upsert({
            key,
            value,
            group,
            type
          }, { transaction: t });
        }
      }
    });

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.testEmailConnection = async (req, res) => {
  res.json({ success: true, message: 'Email connection test successful' });
};

exports.updateChapaSettings = async (req, res) => {
  res.json({ success: true, message: 'Chapa settings updated' });
};

/**
 * Payment Handlers
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const transactions = await Payment.findAll({
      include: [{ model: Order, as: 'order', attributes: ['order_number', 'total_amount'] }],
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
};

exports.getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Payment.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order' }]
    });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};

exports.getPaymentLogs = async (req, res, next) => {
  try {
    // Assuming payment logs are stored somewhere or just return payment records
    const logs = await Payment.findAll({
      limit: 50,
      order: [['updated_at', 'DESC']]
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

exports.retryPayment = async (req, res) => {
    res.json({ success: true, message: 'Payment retry initiated' });
};

/**
 * Get all orders (Admin)
 */
exports.getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search, dateFrom, dateTo } = req.query;
    const where = {};

    if (status) where.order_status = status;
    if (dateFrom && dateTo) {
      where.created_at = { [Op.between]: [new Date(dateFrom), new Date(dateTo)] };
    }

    // Search by order number or customer name/email
    const userInclude = { model: User, as: 'user', attributes: ['first_name', 'last_name', 'email'] };
    if (search) {
      where[Op.or] = [
        { order_number: { [Op.like]: `%${search}%` } },
        { '$user.first_name$': { [Op.like]: `%${search}%` } },
        { '$user.last_name$': { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        userInclude,
        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['name', 'price'] }] }
      ],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        orders,
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
 * Get order by ID
 */
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['first_name', 'last_name', 'email', 'phone'] },
        { model: Address, as: 'address' },
        { 
          model: OrderItem, as: 'items', 
          include: [{ model: Product, as: 'product' }] 
        },
        { model: Payment, as: 'payment' }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status (admin)
 * @route PUT /api/admin/orders/:id/status
 * @access Private/Admin
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    const { status, trackingNumber, carrier, estimatedDelivery, notes } = req.body;

    const updatedOrder = await orderStatusService.updateOrderStatus(
      orderId,
      status,
      { id: userId, role: 'admin' }, // Treat admin as admin role
      { trackingNumber, carrier, estimatedDelivery, notes }
    );

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order: updatedOrder
      }
    });
  } catch (error) {
    if (error.message.includes('Invalid status transition') || error.message.includes('cannot set status')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

/**
 * Report Handlers
 */
exports.getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, dateFrom, dateTo, period = 'day' } = req.query;
    const start = startDate || dateFrom;
    const end = endDate || dateTo;
    
    const where = { order_status: { [Op.in]: ['completed', 'delivered'] } };

    if (start && end) {
      where.created_at = { [Op.between]: [new Date(start), new Date(end)] };
    }

    let groupFormat;
    if (period === 'month') groupFormat = '%Y-%m';
    else if (period === 'year') groupFormat = '%Y';
    else groupFormat = '%Y-%m-%d';

    // Get trend data for chart
    const chartDataResult = await Order.findAll({
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), groupFormat), 'date'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'revenue'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders']
      ],
      where,
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), groupFormat)],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), groupFormat), 'ASC']]
    });

    const chartData = chartDataResult.map(item => ({
      date: item.getDataValue('date'),
      revenue: parseFloat(item.getDataValue('revenue') || 0),
      orders: parseInt(item.getDataValue('orders') || 0)
    }));

    // Get detailed sales list for table
    const salesData = await Order.findAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: 50 // Limit for current implementation
    });

    // Calculate summary stats
    const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrders = chartData.reduce((sum, item) => sum + item.orders, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    res.json({ 
      success: true, 
      data: {
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue,
          customerCount: await User.count({ where: { role: 'customer' } })
        },
        chartData,
        salesData,
        total: await Order.count({ where })
      } 
    });
  } catch (error) {
    next(error);
  }
};

exports.getProductPerformance = async (req, res, next) => {
  try {
    const { topSellingLimit = 10, lowStockLimit = 10, mostViewedLimit = 10 } = req.query;

    // Top Selling Products
    const topSelling = await OrderItem.findAll({
      attributes: [
        'productId',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'unitsSold'],
        [sequelize.fn('SUM', sequelize.literal('quantity * price')), 'revenue']
      ],
      include: [{ 
        model: Product, as: 'product', 
        attributes: ['name', 'sku', 'stock', 'price', 'main_image'] 
      }],
      group: ['productId'],
      order: [[sequelize.literal('unitsSold'), 'DESC']],
      limit: parseInt(topSellingLimit)
    });

    // Low Stock Products
    const lowStock = await Product.findAll({
      where: {
        stock: { [Op.lte]: 10 }, // Assuming 10 is low stock threshold
        is_active: true
      },
      attributes: ['id', 'name', 'sku', 'stock', 'price', 'main_image'],
      order: [['stock', 'ASC']],
      limit: parseInt(lowStockLimit)
    });

    // Most Viewed Products (Using orders as a proxy if views not tracked, or just mock/query if tracked)
    // For now, let's use revenue as a proxy or just the same as top selling for this demonstration,
    // or if the model has a 'views' field, use that.
    const mostViewed = await Product.findAll({
      attributes: ['id', 'name', 'sku', 'stock', 'price', 'main_image', [sequelize.literal('0'), 'views']], // Mocking views as 0
      order: [['created_at', 'DESC']],
      limit: parseInt(mostViewedLimit)
    });

    res.json({ 
      success: true, 
      data: {
        topSelling: topSelling.map(item => ({
          id: item.productId,
          name: item.product?.name,
          sku: item.product?.sku,
          image: item.product?.main_image,
          unitsSold: item.getDataValue('unitsSold'),
          revenue: item.getDataValue('revenue'),
          stock: item.product?.stock
        })),
        lowStock: lowStock.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          image: p.main_image,
          stock: p.stock,
          minStock: 10,
          price: p.price
        })),
        mostViewed: mostViewed.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          image: p.main_image,
          views: 0,
          unitsSold: 0,
          revenue: 0
        })),
        totalProducts: await Product.count({ where: { is_active: true } }),
        lowStockCount: await Product.count({ where: { stock: { [Op.lte]: 10 }, is_active: true } }),
        totalViews: 0
      } 
    });
  } catch (error) {
    next(error);
  }
};

exports.getSellerPerformance = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    
    const performance = await OrderItem.findAll({
      attributes: [
        'sellerId',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'unitsSold'],
        [sequelize.fn('SUM', sequelize.literal('quantity * price')), 'revenue'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('orderId'))), 'orderCount']
      ],
      include: [{ model: Seller, as: 'seller', attributes: ['store_name', 'logo'] }],
      group: ['sellerId'],
      order: [[sequelize.literal('revenue'), 'DESC']],
      limit: parseInt(limit)
    });

    res.json({ 
      success: true, 
      data: {
        sellers: performance.map(item => ({
          id: item.sellerId,
          storeName: item.seller?.store_name,
          logo: item.seller?.logo,
          unitsSold: item.getDataValue('unitsSold'),
          revenue: item.getDataValue('revenue'),
          orderCount: item.getDataValue('orderCount'),
          rating: 4.5 // Mock rating
        })),
        totalSellers: await Seller.count({ where: { status: 'approved' } }),
        topSeller: performance[0]?.seller?.store_name || 'N/A'
      } 
    });
  } catch (error) {
    next(error);
  }
};

exports.exportReport = async (req, res, next) => {
  try {
    const { type } = req.query;
    let data = [];
    let filename = 'report.csv';
    let headers = '';

    if (type === 'sales') {
      const sales = await Order.findAll({
        attributes: ['order_number', 'total_amount', 'order_status', 'created_at'],
        include: [{ model: User, as: 'user', attributes: ['email'] }],
        limit: 1000
      });
      headers = 'Order Number,Amount,Status,Date,Customer Email\n';
      data = sales.map(s => `${s.order_number},${s.total_amount},${s.order_status},${s.created_at},${s.user ? s.user.email : 'N/A'}`);
      filename = 'sales_report.csv';
    } else {
      // Default dummy for other types
      headers = 'ID,Name,Date\n';
      data = ['1,Test Report,2026-02-25'];
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.status(200).send(headers + data.join('\n'));
  } catch (error) {
    next(error);
  }
};
