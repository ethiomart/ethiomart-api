const { User, Seller, sequelize } = require('../../models');
const { Op } = require('sequelize');

/**
 * Get all users with filters and pagination
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const where = {};

    if (role) where.role = role;
    if (status) {
      if (status === 'active') where.is_active = true;
      else if (status === 'suspended') where.is_active = false;
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
