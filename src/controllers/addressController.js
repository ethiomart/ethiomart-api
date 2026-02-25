const Address = require('../models/Address');
const { Op } = require('sequelize');

/**
 * Create a new address
 * @route POST /api/user/addresses
 * @access Private
 */
const createAddress = async (req, res, next) => {
  try {
    const {
      full_name,
      phone_number,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      is_default,
      type
    } = req.body;

    // If this address is being set as default, unset all other user addresses
    if (is_default) {
      await Address.update(
        { is_default: false },
        { where: { user_id: req.user.id } }
      );
    }

    // Create new address
    const address = await Address.create({
      user_id: req.user.id,
      full_name,
      phone_number,
      address_line1,
      address_line2: address_line2 || null,
      city,
      state: state || null,
      postal_code: postal_code || null,
      country: country || 'Ethiopia',
      is_default: is_default || false,
      type: type || 'shipping'
    });

    // Return address in camelCase format
    res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: {
        id: address.id,
        userId: address.user_id,
        fullName: address.full_name,
        phoneNumber: address.phone_number,
        addressLine1: address.address_line1,
        addressLine2: address.address_line2,
        city: address.city,
        state: address.state,
        postalCode: address.postal_code,
        country: address.country,
        isDefault: address.is_default,
        type: address.type,
        createdAt: address.created_at,
        updatedAt: address.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all addresses for authenticated user
 * @route GET /api/user/addresses
 * @access Private
 */
const getAddresses = async (req, res, next) => {
  try {
    // Get all addresses for the authenticated user
    const addresses = await Address.findAll({
      where: { user_id: req.user.id },
      order: [
        ['is_default', 'DESC'],
        ['created_at', 'DESC']
      ]
    });

    // Convert to camelCase format
    const formattedAddresses = addresses.map(address => ({
      id: address.id,
      userId: address.user_id,
      fullName: address.full_name,
      phoneNumber: address.phone_number,
      addressLine1: address.address_line1,
      addressLine2: address.address_line2,
      city: address.city,
      state: address.state,
      postalCode: address.postal_code,
      country: address.country,
      isDefault: address.is_default,
      type: address.type,
      createdAt: address.created_at,
      updatedAt: address.updated_at
    }));

    res.status(200).json({
      success: true,
      message: 'Addresses retrieved successfully',
      data: formattedAddresses
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single address by ID
 * @route GET /api/user/addresses/:id
 * @access Private
 */
const getAddressById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find address and verify ownership
    const address = await Address.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Return address in camelCase format
    res.status(200).json({
      success: true,
      message: 'Address retrieved successfully',
      data: {
        id: address.id,
        userId: address.user_id,
        fullName: address.full_name,
        phoneNumber: address.phone_number,
        addressLine1: address.address_line1,
        addressLine2: address.address_line2,
        city: address.city,
        state: address.state,
        postalCode: address.postal_code,
        country: address.country,
        isDefault: address.is_default,
        type: address.type,
        createdAt: address.created_at,
        updatedAt: address.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update address
 * @route PUT /api/user/addresses/:id
 * @access Private
 */
const updateAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      phone_number,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      is_default,
      type
    } = req.body;

    // Find address and verify ownership
    const address = await Address.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // If setting this address as default, unset all other user addresses
    if (is_default && !address.is_default) {
      await Address.update(
        { is_default: false },
        { where: { user_id: req.user.id, id: { [Op.ne]: id } } }
      );
    }

    // Update address
    await address.update({
      full_name: full_name !== undefined ? full_name : address.full_name,
      phone_number: phone_number !== undefined ? phone_number : address.phone_number,
      address_line1: address_line1 !== undefined ? address_line1 : address.address_line1,
      address_line2: address_line2 !== undefined ? address_line2 : address.address_line2,
      city: city !== undefined ? city : address.city,
      state: state !== undefined ? state : address.state,
      postal_code: postal_code !== undefined ? postal_code : address.postal_code,
      country: country !== undefined ? country : address.country,
      is_default: is_default !== undefined ? is_default : address.is_default,
      type: type !== undefined ? type : address.type
    });

    // Return updated address in camelCase format
    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: {
        id: address.id,
        userId: address.user_id,
        fullName: address.full_name,
        phoneNumber: address.phone_number,
        addressLine1: address.address_line1,
        addressLine2: address.address_line2,
        city: address.city,
        state: address.state,
        postalCode: address.postal_code,
        country: address.country,
        isDefault: address.is_default,
        type: address.type,
        createdAt: address.created_at,
        updatedAt: address.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete address
 * @route DELETE /api/user/addresses/:id
 * @access Private
 */
const deleteAddress = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find address and verify ownership
    const address = await Address.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Delete address
    await address.destroy();

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set address as default
 * @route PUT /api/user/addresses/:id/default
 * @access Private
 */
const setDefaultAddress = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find address and verify ownership
    const address = await Address.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Unset all other user addresses as default
    await Address.update(
      { is_default: false },
      { where: { user_id: req.user.id } }
    );

    // Set this address as default
    await address.update({ is_default: true });

    // Return updated address in camelCase format
    res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      data: {
        id: address.id,
        userId: address.user_id,
        fullName: address.full_name,
        phoneNumber: address.phone_number,
        addressLine1: address.address_line1,
        addressLine2: address.address_line2,
        city: address.city,
        state: address.state,
        postalCode: address.postal_code,
        country: address.country,
        isDefault: address.is_default,
        type: address.type,
        createdAt: address.created_at,
        updatedAt: address.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAddress,
  getAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
