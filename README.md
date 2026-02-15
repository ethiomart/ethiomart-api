# EthioMart Backend API

Node.js backend API for EthioMart multi-vendor e-commerce platform.

## 🚀 Features
- ✅ JWT Authentication (Access & Refresh Tokens)
- ✅ Role-based access (Customer, Seller, Admin)
- ✅ Product management with variants and images
- ✅ Shopping cart & wishlist
- ✅ Order processing with inventory management
- ✅ Chapa payment integration (ETB)
- ✅ Seller dashboard with earnings wallet
- ✅ Admin panel for platform management
- ✅ File upload with Multer
- ✅ Rate limiting & security headers
- ✅ Comprehensive error handling

## 🛠️ Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL with Sequelize ORM
- **Authentication**: JWT
- **Payment**: Chapa API
- **File Upload**: Multer
- **Security**: Helmet, CORS, express-rate-limit

## 📋 Prerequisites
- Node.js v18+
- MySQL 8.0+
- Chapa account (for payment)

## 🔧 Installation

```bash
# Clone repository
git clone https://github.com/ethiomart/ethiomart-backend.git
cd ethiomart-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations (if any)
npm run migrate

# Start development server
npm run dev
