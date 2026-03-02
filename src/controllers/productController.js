const Product = require('../models/Product');
const Seller = require('../models/Seller');
const Category = require('../models/Category');
const User = require('../models/User');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { transformImageUrls } = require('../utils/imageUtils');
const { deleteMultipleFromCloudinary } = require('../utils/cloudinaryUtils');


/**
 * Create a new product
 * @route POST /api/products
 * @access Private/Seller
 */
const createProduct = async (req, res, next) => {
  try {
    // Log incoming request data for debugging
    console.log('Create Product Request:', {
      body: req.body,
      files: req.files?.length || 0,
      userId: req.user?.id
    });

    // Support both camelCase and snake_case field names
    const { 
      name, 
      description, 
      price, 
      stock, 
      categoryId, 
      category_id,
      sku 
    } = req.body;
    const userId = req.user.id;

    // Use category_id if categoryId is not provided (support both formats)
    const finalCategoryId = categoryId || category_id;

    // Detailed validation with specific error messages
    const validationErrors = [];

    if (!name || name.trim() === '') {
      validationErrors.push({ field: 'name', message: 'Product name is required' });
    }

    if (!description || description.trim() === '') {
      validationErrors.push({ field: 'description', message: 'Product description is required' });
    }

    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      validationErrors.push({ field: 'price', message: 'Price must be a positive number' });
    }

    if (stock === undefined || stock === null || isNaN(parseInt(stock)) || parseInt(stock) < 0) {
      validationErrors.push({ field: 'stock', message: 'Stock must be a non-negative integer' });
    }

    if (!finalCategoryId || isNaN(parseInt(finalCategoryId))) {
      validationErrors.push({ field: 'categoryId', message: 'Valid category ID is required' });
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {
      console.log('Validation errors:', validationErrors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Get seller profile
    const seller = await Seller.findOne({ where: { user_id: userId } });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found. Please create a seller profile first.'
      });
    }

    // Verify category exists
    const category = await Category.findByPk(parseInt(finalCategoryId));
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found. Please select a valid category.'
      });
    }

    // Handle uploaded images
    let images = [];
    if (req.fileUrls && req.fileUrls.length > 0) {
      images = req.fileUrls;
      console.log('Uploaded Cloudinary images:', images);
    } else if (req.files && req.files.length > 0) {
      images = req.files.map(file => `/uploads/${file.filename}`);
      console.log('Uploaded local images:', images);
    }

    // Create product
    const product = await Product.create({
      seller_id: seller.id,  // Use snake_case for database column
      category_id: parseInt(finalCategoryId),  // Use snake_case for database column
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      quantity: parseInt(stock),
      sku: sku ? sku.trim() : null,
      images: images,
      is_published: true
    });

    console.log('Product created successfully:', product.id);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        product
      }
    });
  } catch (error) {
    console.error('Error creating product:', error);
    next(error);
  }
};

/**
 * Get all products with pagination and filters
 * @route GET /api/products
 * @access Public
 */
const getAllProducts = async (req, res, next) => {
  console.log('=== getAllProducts called ===');
  console.log('Transform function exists:', typeof transformImageUrls);
  try {
    const {
      page = 1,
      limit = 20,
      categoryId,
      minPrice,
      maxPrice,
      sellerId,
      isActive = 'true'
    } = req.query;

    // Build where clause
    const where = {};
    
    // Filter by published status
    if (isActive === 'true') {
      where.is_published = true;
    }

    // Filter by category
    if (categoryId) {
      where.category_id = categoryId;
    }

    // Filter by seller
    if (sellerId) {
      where.seller_id = sellerId;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch products with associations
    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        {
          model: Seller,
          as: 'seller',
          attributes: ['id', 'store_name', 'store_description'],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'email', 'first_name', 'last_name']
            }
          ]
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'description']
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sequelize.col('created_at'), 'DESC']],
      distinct: true
    });

    // Transform image URLs to absolute URLs
    const transformedProducts = products.map(product => {
      const productData = product.toJSON();
      if (productData.images) {
        productData.images = transformImageUrls(req, productData.images);
      }
      return productData;
    });

    res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      data: {
        products: transformedProducts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    next(error);
  }
};

/**
 * Get product by ID with seller information
 * @route GET /api/products/:id
 * @access Public
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: Seller,
          as: 'seller',
          attributes: ['id', 'store_name', 'store_description', 'business_phone'],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'email', 'first_name', 'last_name']
            }
          ]
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'description', 'parent_id']
        },
        {
          model: require('../models/VariantOption'),
          as: 'variantOptions',
          include: [{
            model: require('../models/VariantValue'),
            as: 'values',
            attributes: ['id', 'value_name', 'value_position']
          }]
        },
        {
          model: require('../models/VariantCombination'),
          as: 'variantCombinations',
          include: [{
            model: require('../models/VariantValue'),
            as: 'variantValues',
            attributes: ['id', 'value_name'],
            through: { attributes: [] }
          }]
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Transform image URLs to absolute URLs
    const productData = product.toJSON();
    if (productData.images) {
      productData.images = transformImageUrls(req, productData.images);
    }

    res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      data: {
        product: productData
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a product
 * @route PUT /api/products/:id
 * @access Private/Seller/Admin
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, category_id, categoryId, isActive, is_published } = req.body;
    const finalCategoryId = categoryId || category_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: Seller,
          as: 'seller',
          include: [{ model: User, as: 'user' }]
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Authorization check: only product owner or admin can update
    const sellerUserId = product.seller ? product.seller.user_id : null;
    if (userRole !== 'admin' && sellerUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this product'
      });
    }

    // Verify category exists if being updated
    if (finalCategoryId !== undefined && finalCategoryId !== null) {
      const category = await Category.findByPk(finalCategoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
    }

    // Handle uploaded images
    let images = product.images || [];
    if (req.fileUrls && req.fileUrls.length > 0) {
      images = [...images, ...req.fileUrls];
    } else if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/${file.filename}`);
      images = [...images, ...newImages];
    }

    // Handle image removal (Admin/Seller can pass remaining images)
    const { existing_images, existingImages } = req.body;
    const imagesToKeep = existingImages || existing_images;
    
    if (imagesToKeep) {
      const parsedImagesToKeep = typeof imagesToKeep === 'string' ? JSON.parse(imagesToKeep) : imagesToKeep;
      
      // Identify images to delete
      const imagesToDelete = product.images.filter(img => !parsedImagesToKeep.includes(img));
      if (imagesToDelete.length > 0) {
        await deleteMultipleFromCloudinary(imagesToDelete);
      }
      images = [...parsedImagesToKeep, ...(req.fileUrls || [])];
    }

    // Update product fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (stock !== undefined) updateData.quantity = stock;
    if (finalCategoryId !== undefined) updateData.category_id = finalCategoryId;
    if (isActive !== undefined) updateData.is_published = isActive === 'true' || isActive === true;
    if (is_published !== undefined) updateData.is_published = is_published === 'true' || is_published === true;
    
    // Always update images if we've recalculated them (handles Cloudinary and removals)
    updateData.images = images;

    await product.update(updateData);

    // Fetch updated product with associations
    const updatedProduct = await Product.findByPk(id, {
      include: [
        {
          model: Seller,
          as: 'seller',
          attributes: ['id', 'store_name']
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: {
        product: updatedProduct
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a product
 * @route DELETE /api/products/:id
 * @access Private/Seller/Admin
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: Seller,
          as: 'seller',
          include: [{ model: User, as: 'user' }]
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Authorization check: only product owner or admin can delete
    const sellerUserId = product.seller ? product.seller.user_id : null;
    if (userRole !== 'admin' && sellerUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this product'
      });
    }

    // Delete images from Cloudinary before destroying product
    if (product.images && product.images.length > 0) {
      await deleteMultipleFromCloudinary(product.images);
    }

    await product.destroy();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search products by keyword
 * @route GET /api/products/search
 * @access Public
 */
const searchProducts = async (req, res, next) => {
  try {
    const {
      keyword = '',
      page = 1,
      limit = 20,
      categoryId,
      minPrice,
      maxPrice
    } = req.query;

    if (!keyword.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search keyword is required'
      });
    }

    // Build where clause
    const where = {
      is_published: true,
      [Op.or]: [
        { name: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } }
      ]
    };

    // Add additional filters
    if (categoryId) {
      where.category_id = categoryId;
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch products
    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        {
          model: Seller,
          as: 'seller',
          attributes: ['id', 'store_name']
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sequelize.col('created_at'), 'DESC']],
      distinct: true
    });

    res.status(200).json({
      success: true,
      message: 'Search completed successfully',
      data: {
        products,
        searchTerm: keyword,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  searchProducts
};
