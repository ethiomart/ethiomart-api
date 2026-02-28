const User = require('../models/User');
const { transformImageUrls } = require('../utils/imageUtils');

/**
 * Upload profile picture
 * @route POST /api/users/profile-picture
 * @access Private
 */
const uploadProfilePicture = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Get the file URL
    const profilePictureUrl = req.fileUrl;

    // Update user's profile picture
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.update({ profile_picture_url: profilePictureUrl });

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profilePictureUrl: transformImageUrls(req, profilePictureUrl) // Return absolute URL
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users (Admin only)
 * @route GET /api/users
 * @access Private/Admin
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        count: users.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 * @route GET /api/users/:id
 * @access Private
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * @route PUT /api/users/:id
 * @access Private
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email } = req.body;

    // Check if user exists
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check authorization: users can only update their own profile unless admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this user'
      });
    }

    // If email is being changed, check if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use'
        });
      }
    }

    // Update user fields
    const updateData = {};
    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (email) updateData.email = email;

    await user.update(updateData);

    // Return updated user without password
    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (Admin only - soft delete)
 * @route DELETE /api/users/:id
 * @access Private/Admin
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete by setting is_active to false
    await user.update({ is_active: false });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadProfilePicture,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
};
