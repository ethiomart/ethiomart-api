const { sequelize, User, Seller, Category, Product } = require('../models');
require('dotenv').config();

async function seed() {
  try {
    console.log('Starting database seeding...\n');

    // Sync database
    console.log('Synchronizing database...');
    
    // Disable foreign key checks temporarily
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Drop all tables
    await sequelize.drop();
    
    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    
    // Sync all models
    await sequelize.sync({ force: true });
    
    console.log('✓ Database synchronized\n');

    // 1. Create Admin User
    console.log('Creating admin user...');
    const admin = await User.create({
      email: 'admin@ecommerce.com',
      password: 'Admin123!',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_active: true
    });
    console.log('✓ Admin user created:', admin.email);

    // 2. Create Test Customer
    console.log('Creating test customer...');
    const customer = await User.create({
      email: 'customer@test.com',
      password: 'Customer123!',
      first_name: 'John',
      last_name: 'Doe',
      role: 'customer',
      is_active: true
    });
    console.log('✓ Customer created:', customer.email);

    // 3. Create Test Seller User
    console.log('Creating test seller user...');
    const sellerUser = await User.create({
      email: 'seller@test.com',
      password: 'Seller123!',
      first_name: 'Jane',
      last_name: 'Smith',
      role: 'seller',
      is_active: true
    });
    console.log('✓ Seller user created:', sellerUser.email);

    // 4. Create Seller Profile
    console.log('Creating seller profile...');
    const seller = await Seller.create({
      user_id: sellerUser.id,
      store_name: 'Tech Haven Store',
      store_slug: 'tech-haven-store',
      store_description: 'Your one-stop shop for quality electronics and gadgets',
      business_address: '123 Commerce Street, Addis Ababa, Ethiopia',
      business_phone: '+251911234567',
      approval_status: 'approved'
    });
    console.log('✓ Seller profile created:', seller.store_name);

    // 5. Create Main Categories
    console.log('\nCreating main categories...');
    const electronics = await Category.create({
      name: 'Electronics',
      description: 'Electronic devices and accessories'
    });
    console.log('✓ Category created: Electronics');

    const fashion = await Category.create({
      name: 'Fashion',
      description: 'Clothing, shoes, and accessories'
    });
    console.log('✓ Category created: Fashion');

    const home = await Category.create({
      name: 'Home & Living',
      description: 'Furniture, decor, and home essentials'
    });
    console.log('✓ Category created: Home & Living');

    const books = await Category.create({
      name: 'Books & Media',
      description: 'Books, magazines, and media content'
    });
    console.log('✓ Category created: Books & Media');

    const sports = await Category.create({
      name: 'Sports & Outdoors',
      description: 'Sports equipment and outdoor gear'
    });
    console.log('✓ Category created: Sports & Outdoors');

    // 6. Create Subcategories
    console.log('\nCreating subcategories...');
    const smartphones = await Category.create({
      name: 'Smartphones',
      description: 'Mobile phones and accessories',
      parentId: electronics.id
    });
    console.log('✓ Subcategory created: Smartphones');

    const laptops = await Category.create({
      name: 'Laptops & Computers',
      description: 'Laptops, desktops, and computer accessories',
      parentId: electronics.id
    });
    console.log('✓ Subcategory created: Laptops & Computers');

    const mensClothing = await Category.create({
      name: "Men's Clothing",
      description: 'Clothing for men',
      parentId: fashion.id
    });
    console.log("✓ Subcategory created: Men's Clothing");

    const womensClothing = await Category.create({
      name: "Women's Clothing",
      description: 'Clothing for women',
      parentId: fashion.id
    });
    console.log("✓ Subcategory created: Women's Clothing");

    // 7. Create Sample Products
    console.log('\nCreating sample products...');
    
    const products = [
      {
        seller_id: seller.id,
        category_id: smartphones.id,
        name: 'Samsung Galaxy S24',
        slug: 'samsung-galaxy-s24',
        description: 'Latest Samsung flagship smartphone with 256GB storage, 12GB RAM, and advanced camera system',
        price: 45999.00,
        quantity: 25,
        images: ['/uploads/1771148213441-2672d263e0106f67.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: smartphones.id,
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        description: 'Apple iPhone 15 Pro with A17 Pro chip, titanium design, and ProRAW camera',
        price: 65999.00,
        quantity: 15,
        images: ['/uploads/1771148256257-baad8df67d3ff23b.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: laptops.id,
        name: 'Dell XPS 15',
        slug: 'dell-xps-15',
        description: 'Premium laptop with Intel i7, 16GB RAM, 512GB SSD, and 15.6" 4K display',
        price: 89999.00,
        quantity: 10,
        images: ['/uploads/1771148294111-8a71a8f3b8c40207.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: laptops.id,
        name: 'MacBook Pro 14"',
        slug: 'macbook-pro-14',
        description: 'Apple MacBook Pro with M3 chip, 16GB unified memory, and stunning Liquid Retina XDR display',
        price: 125999.00,
        quantity: 8,
        images: ['/uploads/1771148306234-7881696e5aa4460f.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: electronics.id,
        name: 'Sony WH-1000XM5 Headphones',
        slug: 'sony-wh-1000xm5-headphones',
        description: 'Industry-leading noise canceling wireless headphones with premium sound quality',
        price: 18999.00,
        quantity: 30,
        images: ['/uploads/1771148375000-8be335d1457ea1e2.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: mensClothing.id,
        name: 'Classic Cotton T-Shirt',
        slug: 'classic-cotton-tshirt',
        description: 'Comfortable 100% cotton t-shirt available in multiple colors',
        price: 499.00,
        quantity: 100,
        images: ['/uploads/1771149863077-921bfbdb3a618f1a.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: womensClothing.id,
        name: 'Summer Floral Dress',
        slug: 'summer-floral-dress',
        description: 'Elegant floral print dress perfect for summer occasions',
        price: 1299.00,
        quantity: 50,
        images: ['/uploads/1771149907772-b77dbdb9fd862a18.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: home.id,
        name: 'Modern Coffee Table',
        slug: 'modern-coffee-table',
        description: 'Stylish wooden coffee table with storage compartment',
        price: 8999.00,
        quantity: 12,
        images: ['/uploads/1771150078159-967664df64d1c83c.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: books.id,
        name: 'The Art of Programming',
        slug: 'the-art-of-programming',
        description: 'Comprehensive guide to modern software development practices',
        price: 899.00,
        quantity: 40,
        images: ['/uploads/1771150087889-c67d798fcac7302f.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: sports.id,
        name: 'Yoga Mat Premium',
        slug: 'yoga-mat-premium',
        description: 'Non-slip yoga mat with carrying strap, perfect for home or studio use',
        price: 1499.00,
        quantity: 60,
        images: ['/uploads/1771150211370-fc184ffeb74a98e4.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: mensClothing.id,
        name: 'Premium Denim Jeans',
        slug: 'premium-denim-jeans',
        description: 'High-quality denim jeans with perfect fit and comfort',
        price: 2499.00,
        quantity: 45,
        images: ['/uploads/1771431546696-e74f9067c9c690ec.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: womensClothing.id,
        name: 'Elegant High Heels',
        slug: 'elegant-high-heels',
        description: 'Stylish high heels perfect for formal occasions',
        price: 3499.00,
        quantity: 30,
        images: ['/uploads/test-product.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: sports.id,
        name: 'Nike Running Shoes',
        slug: 'nike-running-shoes',
        description: 'Professional running shoes with advanced cushioning technology',
        price: 5999.00,
        quantity: 35,
        images: ['/uploads/1771148213441-2672d263e0106f67.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: electronics.id,
        name: 'Wireless Gaming Headset',
        slug: 'wireless-gaming-headset',
        description: 'Premium gaming headset with 7.1 surround sound and RGB lighting',
        price: 4999.00,
        quantity: 20,
        images: ['/uploads/1771148256257-baad8df67d3ff23b.jpg'],
        is_published: true,
        approval_status: 'approved'
      },
      {
        seller_id: seller.id,
        category_id: mensClothing.id,
        name: 'Casual Button-Up Shirt',
        slug: 'casual-button-up-shirt',
        description: 'Comfortable casual shirt perfect for everyday wear',
        price: 1299.00,
        quantity: 55,
        images: ['/uploads/1771148294111-8a71a8f3b8c40207.jpg'],
        is_published: true,
        approval_status: 'approved'
      }
    ];

    for (const productData of products) {
      const product = await Product.create(productData);
      console.log(`✓ Product created: ${product.name} (${product.price} ETB)`);
    }

    console.log('\n✓ Database seeding completed successfully!');
    console.log('\n=== Seed Summary ===');
    console.log(`Users created: 3 (1 admin, 1 customer, 1 seller)`);
    console.log(`Categories created: 5 main + 4 subcategories`);
    console.log(`Sellers created: 1`);
    console.log(`Products created: ${products.length}`);
    console.log('\n=== Test Credentials ===');
    console.log('Admin: admin@ecommerce.com / Admin123!');
    console.log('Customer: customer@test.com / Customer123!');
    console.log('Seller: seller@test.com / Seller123!');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeder
seed();
