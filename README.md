# EthioMart Backend

A robust e-commerce backend API built with Node.js, Express, and MySQL, featuring comprehensive product management, order processing, payment integration, and multi-vendor support.

## Features

- **User Management**: Customer and seller registration, authentication, and profile management
- **Product Management**: Full CRUD operations with variant support, categories, and brands
- **Order Processing**: Complete order lifecycle management with status tracking
- **Payment Integration**: Chapa payment gateway integration for secure transactions
- **Multi-Vendor Support**: Seller dashboard with earnings tracking and order management
- **Cart & Wishlist**: Shopping cart and wishlist functionality
- **Address Management**: Multiple shipping address support
- **Admin Panel**: Comprehensive admin controls for platform management
- **Security**: JWT authentication, rate limiting, and input validation
- **File Uploads**: Image upload support for products and profiles

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL with Sequelize ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Payment**: Chapa Payment Gateway
- **Push Notifications**: Firebase Cloud Messaging
- **Email**: Nodemailer
- **Security**: Helmet, bcryptjs, express-rate-limit
- **File Upload**: Multer

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/ethiomart/ethiomart-backend.git
cd ethiomart-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your `.env` file with the following variables:
```
# Database
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=ethiomart
DB_PORT=3306

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Chapa Payment
CHAPA_SECRET_KEY=your_chapa_secret_key
CHAPA_WEBHOOK_SECRET=your_webhook_secret

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_email_password

# Server
PORT=3000
NODE_ENV=development
```

5. Run database migrations:
```bash
npm run migrate
```

6. (Optional) Seed the database:
```bash
npm run seed
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new customer
- `POST /api/auth/login` - User login
- `POST /api/auth/seller/register` - Register as seller

### Product Endpoints
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (seller only)
- `PUT /api/products/:id` - Update product (seller only)
- `DELETE /api/products/:id` - Delete product (seller only)

### Order Endpoints
- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/status` - Update order status

### Payment Endpoints
- `POST /api/payments/initialize` - Initialize payment
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/webhook` - Chapa webhook handler

### Cart Endpoints
- `GET /api/cart` - Get user cart
- `POST /api/cart` - Add item to cart
- `PUT /api/cart/:id` - Update cart item
- `DELETE /api/cart/:id` - Remove cart item

For complete API documentation, refer to the `/docs` endpoint when running the server.

## Project Structure

```
ethiomart-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── server.js        # Application entry point
├── migrations/          # Database migrations
├── test/               # Test files
├── uploads/            # Uploaded files (gitignored)
├── .env.example        # Environment variables template
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

## Testing

Run the test suite:
```bash
npm test
```

Run integration tests:
```bash
npm run test:integration
```

## Security Features

- Password hashing with bcryptjs
- JWT-based authentication
- Rate limiting on API endpoints
- Input validation and sanitization
- Helmet for security headers
- CORS configuration
- SQL injection prevention via Sequelize ORM

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

For support, email support@ethiomart.com or open an issue in the repository.

## Acknowledgments

- Chapa for payment processing
- Firebase for push notifications
- All contributors who have helped shape this project
