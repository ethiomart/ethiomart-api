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
const Attribute = require('./Attribute');
const AttributeValue = require('./AttributeValue');

// Define associations

// User associations
User.hasOne(Seller, { foreignKey: 'user_id', as: 'seller' });
User.hasOne(Cart, { foreignKey: 'user_id', as: 'cart' });
User.hasOne(Wishlist, { foreignKey: 'user_id', as: 'wishlist' });
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
User.hasMany(Review, { foreignKey: 'user_id', as: 'reviews' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });

// Seller associations
Seller.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Seller.hasMany(Product, { foreignKey: 'seller_id', as: 'products' });
Seller.hasMany(OrderItem, { foreignKey: 'seller_id', as: 'orderItems' });
Seller.hasMany(Analytics, { foreignKey: 'seller_id', as: 'analytics' });

// Category associations (self-referencing)
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Category.belongsTo(Category, { as: 'parent', foreignKey: 'parent_id' });
Category.hasMany(Category, { as: 'children', foreignKey: 'parent_id' });

// Product associations
Product.belongsTo(Seller, { foreignKey: 'seller_id', as: 'seller' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Product.hasMany(CartItem, { foreignKey: 'product_id', as: 'cartItems' });
Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'orderItems' });
Product.hasMany(Review, { foreignKey: 'product_id', as: 'reviews' });
Product.hasMany(WishlistItem, { foreignKey: 'product_id', as: 'wishlistItems' });
Product.hasMany(VariantOption, { foreignKey: 'product_id', as: 'variantOptions', onDelete: 'CASCADE' });
Product.hasMany(VariantCombination, { foreignKey: 'product_id', as: 'variantCombinations', onDelete: 'CASCADE' });
Product.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Brand.hasMany(Product, { foreignKey: 'brand_id', as: 'products' });

// Cart associations
Cart.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Cart.hasMany(CartItem, { foreignKey: 'cart_id', as: 'items' });

// CartItem associations
CartItem.belongsTo(Cart, { foreignKey: 'cart_id', as: 'cart' });
CartItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
CartItem.belongsTo(VariantCombination, { foreignKey: 'variant_combination_id', as: 'variantCombination' });

// Order associations
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Order.belongsTo(Address, { foreignKey: 'address_id', as: 'address' });
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
Order.hasOne(Payment, { foreignKey: 'order_id', as: 'payment' });
Order.hasMany(OrderStatusHistory, { foreignKey: 'order_id', as: 'statusHistory' });
Order.hasMany(Analytics, { foreignKey: 'order_id', as: 'analytics' });

// OrderStatusHistory associations
OrderStatusHistory.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
OrderStatusHistory.belongsTo(User, { foreignKey: 'updated_by', as: 'updatedBy' });

// Analytics associations
Analytics.belongsTo(Seller, { foreignKey: 'seller_id', as: 'seller' });
Analytics.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// OrderItem associations
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
OrderItem.belongsTo(Seller, { foreignKey: 'seller_id', as: 'seller' });
OrderItem.belongsTo(VariantCombination, { foreignKey: 'variant_combination_id', as: 'variantCombination' });
VariantCombination.hasMany(OrderItem, { foreignKey: 'variant_combination_id', as: 'orderItems' });

// Payment associations
Payment.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// Review associations
Review.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Wishlist associations
Wishlist.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Wishlist.hasMany(WishlistItem, { foreignKey: 'wishlist_id', as: 'items' });

// WishlistItem associations
WishlistItem.belongsTo(Wishlist, { foreignKey: 'wishlist_id', as: 'wishlist' });
WishlistItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

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

// Global Attribute associations
Attribute.hasMany(AttributeValue, { foreignKey: 'attribute_id', as: 'values', onDelete: 'CASCADE' });
AttributeValue.belongsTo(Attribute, { foreignKey: 'attribute_id', as: 'attribute' });

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
  Setting,
  Attribute,
  AttributeValue
};
