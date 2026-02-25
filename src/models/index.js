const sequelize = require('../config/database');

// Import all models
const User = require('./User');
const Seller = require('./Seller');
const Category = require('./Category');
const Product = require('./Product');
const Cart = require('./Cart');
const CartItem = require('./CartItem');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Payment = require('./Payment');
const Review = require('./Review');
const Notification = require('./Notification');
const Wishlist = require('./Wishlist');
const WishlistItem = require('./WishlistItem');
const Address = require('./Address');
const OrderStatusHistory = require('./OrderStatusHistory');
const Analytics = require('./Analytics');
const VariantOption = require('./VariantOption');
const VariantValue = require('./VariantValue');
const VariantCombination = require('./VariantCombination');
const VariantCombinationValue = require('./VariantCombinationValue');
const CategoryTemplate = require('./CategoryTemplate');
const Brand = require('./Brand');
const Banner = require('./Banner');
const StaticPage = require('./StaticPage');
const Setting = require('./Setting');

// Define associations

// User associations
User.hasOne(Seller, { foreignKey: 'userId', as: 'seller' });
User.hasOne(Cart, { foreignKey: 'userId', as: 'cart' });
User.hasOne(Wishlist, { foreignKey: 'userId', as: 'wishlist' });
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
User.hasMany(Review, { foreignKey: 'userId', as: 'reviews' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });

// Seller associations
Seller.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Seller.hasMany(Product, { foreignKey: 'sellerId', as: 'products' });
Seller.hasMany(OrderItem, { foreignKey: 'sellerId', as: 'orderItems' });
Seller.hasMany(Analytics, { foreignKey: 'seller_id', as: 'analytics' });

// Category associations (self-referencing)
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Category.belongsTo(Category, { as: 'parent', foreignKey: 'parentId' });
Category.hasMany(Category, { as: 'children', foreignKey: 'parentId' });

// Product associations
Product.belongsTo(Seller, { foreignKey: 'sellerId', as: 'seller' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Product.hasMany(CartItem, { foreignKey: 'productId', as: 'cartItems' });
Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'orderItems' });
Product.hasMany(Review, { foreignKey: 'productId', as: 'reviews' });
Product.hasMany(WishlistItem, { foreignKey: 'productId', as: 'wishlistItems' });
Product.hasMany(VariantOption, { foreignKey: 'product_id', as: 'variantOptions', onDelete: 'CASCADE' });
Product.hasMany(VariantCombination, { foreignKey: 'product_id', as: 'variantCombinations', onDelete: 'CASCADE' });
Product.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Brand.hasMany(Product, { foreignKey: 'brand_id', as: 'products' });

// Cart associations
Cart.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Cart.hasMany(CartItem, { foreignKey: 'cartId', as: 'items' });

// CartItem associations
CartItem.belongsTo(Cart, { foreignKey: 'cartId', as: 'cart' });
CartItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
CartItem.belongsTo(VariantCombination, { foreignKey: 'variant_combination_id', as: 'variantCombination' });

// Order associations
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Order.belongsTo(Address, { foreignKey: 'address_id', as: 'address' });
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
Order.hasOne(Payment, { foreignKey: 'orderId', as: 'payment' });
Order.hasMany(OrderStatusHistory, { foreignKey: 'order_id', as: 'statusHistory' });
Order.hasMany(Analytics, { foreignKey: 'order_id', as: 'analytics' });

// OrderStatusHistory associations
OrderStatusHistory.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
OrderStatusHistory.belongsTo(User, { foreignKey: 'updated_by', as: 'updatedBy' });

// Analytics associations
Analytics.belongsTo(Seller, { foreignKey: 'seller_id', as: 'seller' });
Analytics.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// OrderItem associations
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
OrderItem.belongsTo(Seller, { foreignKey: 'sellerId', as: 'seller' });

// Payment associations
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// Review associations
Review.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Review.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Wishlist associations
Wishlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Wishlist.hasMany(WishlistItem, { foreignKey: 'wishlistId', as: 'items' });

// WishlistItem associations
WishlistItem.belongsTo(Wishlist, { foreignKey: 'wishlistId', as: 'wishlist' });
WishlistItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// Address associations
Address.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Variant associations
VariantOption.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
VariantOption.hasMany(VariantValue, { foreignKey: 'variant_option_id', as: 'values', onDelete: 'CASCADE' });

VariantValue.belongsTo(VariantOption, { foreignKey: 'variant_option_id', as: 'option' });
VariantValue.belongsToMany(VariantCombination, { 
  through: VariantCombinationValue, 
  foreignKey: 'variant_value_id',
  otherKey: 'variant_combination_id',
  as: 'combinations' 
});

VariantCombination.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
VariantCombination.belongsToMany(VariantValue, { 
  through: VariantCombinationValue, 
  foreignKey: 'variant_combination_id',
  otherKey: 'variant_value_id',
  as: 'variantValues' 
});
VariantCombination.hasMany(CartItem, { foreignKey: 'variant_combination_id', as: 'cartItems' });

VariantCombinationValue.belongsTo(VariantCombination, { foreignKey: 'variant_combination_id', as: 'combination' });
VariantCombinationValue.belongsTo(VariantValue, { foreignKey: 'variant_value_id', as: 'value' });

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  Seller,
  Category,
  Product,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Payment,
  Review,
  Notification,
  Wishlist,
  WishlistItem,
  Address,
  OrderStatusHistory,
  Analytics,
  VariantOption,
  VariantValue,
  VariantCombination,
  VariantCombinationValue,
  CategoryTemplate,
  Brand,
  Banner,
  StaticPage,
  Setting
};
