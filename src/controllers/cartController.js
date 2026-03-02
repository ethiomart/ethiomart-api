const { 
  Cart, 
  CartItem, 
  Product, 
  Seller, 
  VariantCombination, 
  VariantValue, 
  VariantOption,
  sequelize
} = require('../models');
const variantService = require('../services/variantService');

/**
 * Helper to get and format cart
 */
const getFormattedCart = async (userId) => {
  const cart = await Cart.findOne({
    where: { user_id: userId },
    include: [
      {
        model: CartItem,
        as: 'items',
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'description', 'price', 'quantity', 'images', 'is_published'],
            include: [
              {
                model: Seller,
                as: 'seller',
                attributes: ['id', 'store_name']
              }
            ]
          },
          {
            model: VariantCombination,
            as: 'variantCombination',
            attributes: ['id', 'sku', 'price', 'stock_quantity', 'image_url', 'is_active'],
            include: [
              {
                model: VariantValue,
                as: 'variantValues',
                attributes: ['id', 'value_name'],
                through: { attributes: [] },
                include: [
                  {
                    model: VariantOption,
                    as: 'option',
                    attributes: ['option_name']
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  });

  if (!cart) return null;

  let total = 0;
  const items = cart.items || [];
  
  const validItems = items.filter(item => {
    if (!item.product) return false;
    if (!item.product.is_published) return false;
    if (item.variant_combination_id && item.variantCombination) {
      if (!item.variantCombination.is_active || item.variantCombination.stock_quantity === 0) return false;
    }
    return true;
  });
  
  validItems.forEach(item => {
    const price = item.variantCombination 
      ? parseFloat(item.variantCombination.price) 
      : parseFloat(item.product.price);
    total += item.quantity * price;
  });

  const formattedItems = validItems.map(item => {
    const baseItem = {
      id: item.id,
      cart_id: item.cart_id,
      product_id: item.product_id,
      quantity: item.quantity,
      product: item.product,
      variant_combination_id: item.variant_combination_id,
      created_at: item.created_at,
      updated_at: item.updated_at
    };

    if (item.variant_combination_id && item.variantCombination) {
      baseItem.variant = {
        id: item.variantCombination.id,
        sku: item.variantCombination.sku,
        price: parseFloat(item.variantCombination.price),
        stock_quantity: item.variantCombination.stock_quantity,
        image_url: item.variantCombination.image_url,
        is_active: item.variantCombination.is_active,
        description: item.variantCombination.variantValues
          .map(v => v.value_name)
          .join(' / '),
        variant_values: item.variantCombination.variantValues.map(v => ({
          option_name: v.option.option_name,
          value_name: v.value_name
        }))
      };
    }

    return baseItem;
  });

  return {
    id: cart.id,
    user_id: cart.user_id || cart.userId,
    items: formattedItems,
    total: parseFloat(total.toFixed(2)),
    item_count: validItems.length,
    created_at: cart.created_at || cart.createdAt,
    updated_at: cart.updated_at || cart.updatedAt
  };
};

const getCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let cartData = await getFormattedCart(userId);

    if (!cartData) {
      const cart = await Cart.create({ user_id: userId });
      cartData = {
        id: cart.id,
        user_id: userId,
        items: [],
        total: 0,
        item_count: 0,
        created_at: cart.created_at,
        updated_at: cart.updated_at
      };
    }

    res.status(200).json({
      success: true,
      message: 'Cart retrieved successfully',
      data: { cart: cartData }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add or update cart item with stock validation
 * @route POST /api/cart/items
 * @access Private
 */
const addToCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId, quantity, variantCombinationId } = req.body;

    // Validate quantity
    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    // Check if product exists and is active
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.is_published) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available'
      });
    }

    // Handle variant products
    let variant = null;
    if (variantCombinationId) {
      // Validate variant exists and belongs to product
      variant = await VariantCombination.findOne({
        where: { 
          id: variantCombinationId,
          product_id: productId
        }
      });

      if (!variant) {
        return res.status(404).json({
          success: false,
          message: 'Variant not found for this product'
        });
      }

      if (!variant.is_active) {
        return res.status(400).json({
          success: false,
          message: 'This variant is not available'
        });
      }

      // Validate stock availability for variant
      if (quantity > variant.stock_quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Only ${variant.stock_quantity} items available for this variant`
        });
      }
    } else {
      // For non-variant products, validate stock availability
      if (quantity > product.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Only ${product.quantity} items available`
        });
      }
    }

    // Find or create cart
    let cart = await Cart.findOne({ where: { user_id: userId } });
    if (!cart) {
      cart = await Cart.create({ user_id: userId });
    }

    // Check if item already exists in cart (same product and variant combination)
    const whereClause = {
      cart_id: cart.id,
      product_id: productId
    };

    // For variant products, include variant_combination_id in uniqueness check
    if (variantCombinationId) {
      whereClause.variant_combination_id = variantCombinationId;
    } else {
      // For non-variant products, ensure variant_combination_id is null
      whereClause.variant_combination_id = null;
    }

    let cartItem = await CartItem.findOne({ where: whereClause });

    if (cartItem) {
      // Update existing cart item
      const newQuantity = cartItem.quantity + quantity;
      
      // Validate total quantity against stock
      if (variant) {
        if (newQuantity > variant.stock_quantity) {
          return res.status(400).json({
            success: false,
            message: `Cannot add ${quantity} more items. Only ${variant.stock_quantity - cartItem.quantity} items available`
          });
        }
        
        // Reserve additional stock for variant
        try {
          await variantService.reserveStock(variantCombinationId, quantity);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: error.message || 'Failed to reserve stock'
          });
        }
      } else {
        if (newQuantity > product.quantity) {
          return res.status(400).json({
            success: false,
            message: `Cannot add ${quantity} more items. Only ${product.quantity - cartItem.quantity} items available`
          });
        }
      }

      await cartItem.update({ quantity: newQuantity });
    } else {
      // Create new cart item
      const cartItemData = {
        cart_id: cart.id,
        product_id: productId,
        quantity
      };

      if (variantCombinationId) {
        cartItemData.variant_combination_id = variantCombinationId;
        
        // Reserve stock for variant
        try {
          await variantService.reserveStock(variantCombinationId, quantity);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: error.message || 'Failed to reserve stock'
          });
        }
      }

      cartItem = await CartItem.create(cartItemData);
    }

    // Fetch complete cart with all items (same structure as getCart)
    const updatedCart = await Cart.findOne({
      where: { id: cart.id },
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'description', 'price', 'quantity', 'images', 'is_published'],
              include: [
                {
                  model: Seller,
                  as: 'seller',
                  attributes: ['id', 'store_name']
                }
              ]
            },
            {
              model: VariantCombination,
              as: 'variantCombination',
              attributes: ['id', 'sku', 'price', 'stock_quantity', 'image_url', 'is_active'],
              include: [
                {
                  model: VariantValue,
                  as: 'variantValues',
                  attributes: ['id', 'value_name'],
                  through: { attributes: [] },
                  include: [
                    {
                      model: VariantOption,
                      as: 'option',
                      attributes: ['option_name']
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    // Calculate total and filter published products
    let total = 0;
    const items = updatedCart.items || [];
    
    // Filter out items with null or unpublished products
    const validItems = items.filter(item => {
      if (!item.product) {
        console.warn(`⚠️ Cart item ${item.id} has null product (product_id: ${item.product_id})`);
        return false;
      }
      if (!item.product.is_published) {
        console.warn(`⚠️ Cart item ${item.id} has unpublished product (product_id: ${item.product_id})`);
        return false;
      }
      // Check variant availability if variant is specified
      if (item.variant_combination_id && item.variantCombination) {
        if (!item.variantCombination.is_active || item.variantCombination.stock_quantity === 0) {
          console.warn(`⚠️ Cart item ${item.id} has unavailable variant (variant_id: ${item.variant_combination_id})`);
          return false;
        }
      }
      return true;
    });
    
    // Calculate total only for valid items
    validItems.forEach(item => {
      // Use variant price if available, otherwise use product price
      const price = item.variantCombination 
        ? parseFloat(item.variantCombination.price) 
        : parseFloat(item.product.price);
      total += item.quantity * price;
    });

    // Format items with variant details
    const formattedItems = validItems.map(item => {
      const baseItem = {
        id: item.id,
        cart_id: item.cart_id,
        product_id: item.product_id,
        quantity: item.quantity,
        product: item.product,
        created_at: item.created_at,
        updated_at: item.updated_at
      };

      // Add variant details if present
      if (item.variant_combination_id && item.variantCombination) {
        baseItem.variant_combination_id = item.variant_combination_id;
        baseItem.variant = {
          id: item.variantCombination.id,
          sku: item.variantCombination.sku,
          price: parseFloat(item.variantCombination.price),
          stock_quantity: item.variantCombination.stock_quantity,
          image_url: item.variantCombination.image_url,
          is_active: item.variantCombination.is_active,
          description: item.variantCombination.variantValues
            .map(v => v.value_name)
            .join(' / '),
          variant_values: item.variantCombination.variantValues.map(v => ({
            option_name: v.option.option_name,
            value_name: v.value_name
          }))
        };
      }

      return baseItem;
    });

    // Determine success message based on whether item was added or updated
    const message = cartItem.quantity === quantity ? 'Item added to cart' : 'Cart item updated';

    // Fetch refreshed complete cart
    const cartData = await getFormattedCart(userId);

    res.status(200).json({
      success: true,
      message: message,
      data: { cart: cartData }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update cart item quantity with stock validation
 * @route PUT /api/cart/items/:id
 * @access Private
 */
const updateCartItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity } = req.body;

    // Validate quantity
    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    // Find cart item
    console.log(`🛒 [DEBUG] updateCartItem: userId=${userId}, cartItemId=${id}, quantity=${quantity}`);

    const cartItem = await CartItem.findByPk(id, {
      include: [
        {
          model: Cart,
          as: 'cart',
          where: { user_id: userId },
          attributes: ['id', 'user_id']
        },
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price', 'quantity', 'is_published']
        },
        {
          model: VariantCombination,
          as: 'variantCombination',
          attributes: ['id', 'sku', 'price', 'stock_quantity', 'is_active']
        }
      ]
    });

    if (!cartItem) {
      console.error(`🛒 [ERROR] Cart item ${id} not found for user ${userId}. This could be an ID mismatch or an association issue.`);
      // Debug: Check if the cart item exists at all without the user filter
      const exists = await CartItem.findByPk(id);
      if (exists) {
        console.error(`🛒 [DEBUG] Cart item ${id} exists but belongs to cart_id ${exists.cart_id}. Checking ownership...`);
        const cart = await Cart.findByPk(exists.cart_id);
        if (cart) {
          console.error(`🛒 [DEBUG] Cart ${exists.cart_id} belongs to user_id ${cart.user_id}. Current user: ${userId}`);
        } else {
          console.error(`🛒 [DEBUG] Cart ${exists.cart_id} not found!`);
        }
      } else {
        console.error(`🛒 [DEBUG] Cart item ${id} does not exist in database.`);
      }

      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    // Check if product is still active
    if (!cartItem.product.is_published) {
      return res.status(400).json({
        success: false,
        message: 'Product is no longer available'
      });
    }

    const oldQuantity = cartItem.quantity;
    const quantityDiff = quantity - oldQuantity;

    // Handle variant items
    if (cartItem.variant_combination_id && cartItem.variantCombination) {
      // Check if variant is still active
      if (!cartItem.variantCombination.is_active) {
        return res.status(400).json({
          success: false,
          message: 'This variant is no longer available'
        });
      }

      // Validate stock availability
      if (quantity > cartItem.variantCombination.stock_quantity + oldQuantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Only ${cartItem.variantCombination.stock_quantity + oldQuantity} items available`
        });
      }

      // Adjust stock reservation
      if (quantityDiff > 0) {
        // Reserve additional stock
        try {
          await variantService.reserveStock(cartItem.variant_combination_id, quantityDiff);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: error.message || 'Failed to reserve stock'
          });
        }
      } else if (quantityDiff < 0) {
        // Release excess stock
        try {
          await variantService.releaseStock(cartItem.variant_combination_id, Math.abs(quantityDiff));
        } catch (error) {
          console.error('Failed to release stock:', error);
          // Continue with update even if stock release fails
        }
      }
    } else {
      // For non-variant products, validate stock availability
      if (quantity > cartItem.product.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Only ${cartItem.product.quantity} items available`
        });
      }
    }

    // Update quantity
    await cartItem.update({ quantity });

    // Fetch updated cart item with variant details
    const updatedCartItem = await CartItem.findByPk(id, {
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price', 'quantity', 'images', 'is_published']
        },
        {
          model: VariantCombination,
          as: 'variantCombination',
          attributes: ['id', 'sku', 'price', 'stock_quantity', 'image_url', 'is_active'],
          include: [
            {
              model: VariantValue,
              as: 'variantValues',
              attributes: ['id', 'value_name'],
              through: { attributes: [] },
              include: [
                {
                  model: VariantOption,
                  as: 'option',
                  attributes: ['option_name']
                }
              ]
            }
          ]
        }
      ]
    });

    // Format response with variant details
    const responseItem = {
      id: updatedCartItem.id,
      cart_id: updatedCartItem.cart_id,
      product_id: updatedCartItem.product_id,
      quantity: updatedCartItem.quantity,
      product: updatedCartItem.product,
      created_at: updatedCartItem.created_at,
      updated_at: updatedCartItem.updated_at
    };

    if (updatedCartItem.variant_combination_id && updatedCartItem.variantCombination) {
      responseItem.variant_combination_id = updatedCartItem.variant_combination_id;
      responseItem.variant = {
        id: updatedCartItem.variantCombination.id,
        sku: updatedCartItem.variantCombination.sku,
        price: parseFloat(updatedCartItem.variantCombination.price),
        stock_quantity: updatedCartItem.variantCombination.stock_quantity,
        image_url: updatedCartItem.variantCombination.image_url,
        is_active: updatedCartItem.variantCombination.is_active,
        description: updatedCartItem.variantCombination.variantValues
          .map(v => v.value_name)
          .join(' / '),
        variant_values: updatedCartItem.variantCombination.variantValues.map(v => ({
          option_name: v.option.option_name,
          value_name: v.value_name
        }))
      };
    }

    // Fetch refreshed complete cart
    const cartData = await getFormattedCart(userId);

    res.status(200).json({
      success: true,
      message: 'Cart item updated successfully',
      data: { cart: cartData }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove item from cart
 * @route DELETE /api/cart/items/:id
 * @access Private
 */
const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find cart item
    const cartItem = await CartItem.findByPk(id, {
      include: [
        {
          model: Cart,
          as: 'cart',
          where: { user_id: userId },
          attributes: ['id', 'user_id']
        }
      ]
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    // Release stock if this is a variant item
    if (cartItem.variant_combination_id) {
      try {
        await variantService.releaseStock(cartItem.variant_combination_id, cartItem.quantity);
      } catch (error) {
        console.error('Failed to release stock:', error);
        // Continue with deletion even if stock release fails
      }
    }

    // Delete cart item
    await cartItem.destroy();

    // Fetch refreshed complete cart
    const cartData = await getFormattedCart(userId);

    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      data: { cart: cartData }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear all items from cart
 * @route DELETE /api/cart
 * @access Private
 */
const clearCart = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Find user's cart
    const cart = await Cart.findOne({ where: { user_id: userId } });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Delete all cart items
    await CartItem.destroy({
      where: { cart_id: cart.id }
    });

    // Fetch refreshed empty cart
    const cartData = await getFormattedCart(userId);

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: { cart: cartData }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};
