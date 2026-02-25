/**
 * Unit tests for authController.registerSeller method
 * Tests seller registration functionality
 */

const { registerSeller } = require('../../src/controllers/authController');
const User = require('../../src/models/User');
const Seller = require('../../src/models/Seller');

// Mock the models
jest.mock('../../src/models/User');
jest.mock('../../src/models/Seller');

describe('authController.registerSeller', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup request object
    req = {
      user: {
        id: 1,
        email: 'test@example.com',
        role: 'customer'
      },
      body: {
        storeName: 'Test Store',
        businessEmail: 'business@example.com',
        businessPhone: '+251911234567',
        businessAddress: '123 Main St, Addis Ababa',
        taxId: 'TAX123456'
      }
    };

    // Setup response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Setup next function
    next = jest.fn();
  });

  describe('Successful registration', () => {
    test('should create seller account with valid data', async () => {
      // Mock no existing seller
      Seller.findOne.mockResolvedValue(null);

      // Mock seller creation
      const mockSeller = {
        id: 1,
        user_id: 1,
        store_name: 'Test Store',
        store_slug: 'test-store',
        business_email: 'business@example.com',
        business_phone: '+251911234567',
        business_address: '123 Main St, Addis Ababa',
        tax_id: 'TAX123456',
        approval_status: 'pending',
        created_at: new Date()
      };
      Seller.create.mockResolvedValue(mockSeller);

      await registerSeller(req, res, next);

      expect(Seller.findOne).toHaveBeenCalledWith({
        where: { user_id: 1 }
      });
      expect(Seller.create).toHaveBeenCalledWith({
        user_id: 1,
        store_name: 'Test Store',
        store_slug: 'test-store',
        business_email: 'business@example.com',
        business_phone: '+251911234567',
        business_address: '123 Main St, Addis Ababa',
        tax_id: 'TAX123456',
        approval_status: 'pending'
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Seller registration submitted successfully',
        data: {
          seller: expect.objectContaining({
            id: 1,
            storeName: 'Test Store',
            storeSlug: 'test-store',
            approvalStatus: 'pending'
          })
        }
      });
    });

    test('should handle null taxId', async () => {
      req.body.taxId = undefined;

      Seller.findOne.mockResolvedValue(null);
      const mockSeller = {
        id: 1,
        user_id: 1,
        store_name: 'Test Store',
        store_slug: 'test-store',
        business_email: 'business@example.com',
        business_phone: '+251911234567',
        business_address: '123 Main St, Addis Ababa',
        tax_id: null,
        approval_status: 'pending',
        created_at: new Date()
      };
      Seller.create.mockResolvedValue(mockSeller);

      await registerSeller(req, res, next);

      expect(Seller.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tax_id: null
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('should generate correct store slug from store name', async () => {
      req.body.storeName = 'My Awesome Store!!!';

      Seller.findOne.mockResolvedValue(null);
      const mockSeller = {
        id: 1,
        user_id: 1,
        store_name: 'My Awesome Store!!!',
        store_slug: 'my-awesome-store',
        business_email: 'business@example.com',
        business_phone: '+251911234567',
        business_address: '123 Main St, Addis Ababa',
        tax_id: 'TAX123456',
        approval_status: 'pending',
        created_at: new Date()
      };
      Seller.create.mockResolvedValue(mockSeller);

      await registerSeller(req, res, next);

      expect(Seller.create).toHaveBeenCalledWith(
        expect.objectContaining({
          store_slug: 'my-awesome-store'
        })
      );
    });
  });

  describe('Authentication validation', () => {
    test('should return 401 if user is not authenticated', async () => {
      req.user = null;

      await registerSeller(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(Seller.findOne).not.toHaveBeenCalled();
      expect(Seller.create).not.toHaveBeenCalled();
    });

    test('should return 401 if req.user is undefined', async () => {
      req.user = undefined;

      await registerSeller(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
    });
  });

  describe('Duplicate seller validation', () => {
    test('should return 400 if seller account already exists', async () => {
      const existingSeller = {
        id: 1,
        user_id: 1,
        store_name: 'Existing Store',
        approval_status: 'approved'
      };
      Seller.findOne.mockResolvedValue(existingSeller);

      await registerSeller(req, res, next);

      expect(Seller.findOne).toHaveBeenCalledWith({
        where: { user_id: 1 }
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Seller account already exists'
      });
      expect(Seller.create).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    test('should handle unique constraint error for store_slug', async () => {
      Seller.findOne.mockResolvedValue(null);
      
      const uniqueError = new Error('Unique constraint violation');
      uniqueError.name = 'SequelizeUniqueConstraintError';
      Seller.create.mockRejectedValue(uniqueError);

      await registerSeller(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'A store with a similar name already exists. Please choose a different name.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next with error for database errors', async () => {
      Seller.findOne.mockResolvedValue(null);
      
      const dbError = new Error('Database connection failed');
      Seller.create.mockRejectedValue(dbError);

      await registerSeller(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });

    test('should call next with error if findOne fails', async () => {
      const dbError = new Error('Database query failed');
      Seller.findOne.mockRejectedValue(dbError);

      await registerSeller(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(Seller.create).not.toHaveBeenCalled();
    });
  });

  describe('Store slug generation', () => {
    test('should handle store names with special characters', async () => {
      const testCases = [
        { input: 'Store@#$%Name', expected: 'store-name' },
        { input: '  Leading Spaces', expected: 'leading-spaces' },
        { input: 'Trailing Spaces  ', expected: 'trailing-spaces' },
        { input: 'Multiple   Spaces', expected: 'multiple-spaces' },
        { input: 'Store-With-Dashes', expected: 'store-with-dashes' },
        { input: '123 Number Store', expected: '123-number-store' }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        req.body.storeName = testCase.input;

        Seller.findOne.mockResolvedValue(null);
        const mockSeller = {
          id: 1,
          user_id: 1,
          store_name: testCase.input,
          store_slug: testCase.expected,
          business_email: 'business@example.com',
          business_phone: '+251911234567',
          business_address: '123 Main St',
          tax_id: 'TAX123',
          approval_status: 'pending',
          created_at: new Date()
        };
        Seller.create.mockResolvedValue(mockSeller);

        await registerSeller(req, res, next);

        expect(Seller.create).toHaveBeenCalledWith(
          expect.objectContaining({
            store_slug: testCase.expected
          })
        );
      }
    });
  });
});
