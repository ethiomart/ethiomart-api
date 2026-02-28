/**
 * Preservation Test: Chapa Payment Retry Logic
 * **Validates: Requirements 3.10, 3.11, 3.12**
 */

const axios = require('axios');
const chapaService = require('../../src/services/chapaService');

jest.mock('axios');

describe('Chapa Payment Retry Logic Preservation', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    chapaService.chapaCircuitBreaker.reset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Network Error Retry', () => {
    it('should retry 3 times for ECONNRESET', async () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';
      let attempts = 0;
      
      axios.post.mockImplementation(() => {
        attempts++;
        throw error;
      });

      await expect(
        chapaService.initializePayment('order-1', 1000, 'test@test.com', 'John', 'Doe')
      ).rejects.toThrow();
      
      expect(attempts).toBe(3);
    }, 10000);

    it('should retry 3 times for ETIMEDOUT', async () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      let attempts = 0;
      
      axios.post.mockImplementation(() => {
        attempts++;
        throw error;
      });

      await expect(
        chapaService.initializePayment('order-2', 1000, 'test@test.com', 'Jane', 'Doe')
      ).rejects.toThrow();
      
      expect(attempts).toBe(3);
    }, 10000);
  });

  describe('5xx Error Retry', () => {
    it('should retry 3 times for 500 error', async () => {
      const error = new Error('Server Error');
      error.response = { status: 500, data: {}, headers: {} };
      let attempts = 0;
      
      axios.post.mockImplementation(() => {
        attempts++;
        throw error;
      });

      await expect(
        chapaService.initializePayment('order-3', 1000, 'test@test.com', 'Bob', 'Smith')
      ).rejects.toThrow();
      
      expect(attempts).toBe(3);
    }, 10000);

    it('should retry 3 times for 503 error', async () => {
      const error = new Error('Service Unavailable');
      error.response = { status: 503, data: {}, headers: {} };
      let attempts = 0;
      
      axios.post.mockImplementation(() => {
        attempts++;
        throw error;
      });

      await expect(
        chapaService.initializePayment('order-4', 1000, 'test@test.com', 'Alice', 'Jones')
      ).rejects.toThrow();
      
      expect(attempts).toBe(3);
    }, 10000);
  });

  describe('4xx Error No Retry', () => {
    it('should NOT retry for 400 error', async () => {
      const error = new Error('Bad Request');
      error.response = { status: 400, data: {}, headers: {} };
      let attempts = 0;
      
      axios.post.mockImplementation(() => {
        attempts++;
        throw error;
      });

      await expect(
        chapaService.initializePayment('order-5', 1000, 'test@test.com', 'Charlie', 'Brown')
      ).rejects.toThrow();
      
      expect(attempts).toBe(1);
    });

    it('should NOT retry for 401 error', async () => {
      const error = new Error('Unauthorized');
      error.response = { status: 401, data: {}, headers: {} };
      let attempts = 0;
      
      axios.post.mockImplementation(() => {
        attempts++;
        throw error;
      });

      await expect(
        chapaService.initializePayment('order-6', 1000, 'test@test.com', 'David', 'Wilson')
      ).rejects.toThrow();
      
      expect(attempts).toBe(1);
    });

    it('should NOT retry for 404 error', async () => {
      const error = new Error('Not Found');
      error.response = { status: 404, data: {}, headers: {} };
      let attempts = 0;
      
      axios.post.mockImplementation(() => {
        attempts++;
        throw error;
      });

      await expect(
        chapaService.initializePayment('order-7', 1000, 'test@test.com', 'Eve', 'Davis')
      ).rejects.toThrow();
      
      expect(attempts).toBe(1);
    });
  });

  describe('Payment Verification Retry', () => {
    it('should retry verification 3 times for network errors', async () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';
      let attempts = 0;
      
      axios.get.mockImplementation(() => {
        attempts++;
        throw error;
      });

      await expect(
        chapaService.verifyPayment('tx-ref-123')
      ).rejects.toThrow();
      
      expect(attempts).toBe(3);
    }, 10000);

    it('should retry verification 3 times for 5xx errors', async () => {
      const error = new Error('Server Error');
      error.response = { status: 500, data: {}, headers: {} };
      let attempts = 0;
      
      axios.get.mockImplementation(() => {
        attempts++;
        throw error;
      });

      await expect(
        chapaService.verifyPayment('tx-ref-456')
      ).rejects.toThrow();
      
      expect(attempts).toBe(3);
    }, 10000);

    it('should NOT retry verification for 4xx errors', async () => {
      const error = new Error('Not Found');
      error.response = { status: 404, data: {}, headers: {} };
      let attempts = 0;
      
      axios.get.mockImplementation(() => {
        attempts++;
        throw error;
      });

      await expect(
        chapaService.verifyPayment('tx-ref-789')
      ).rejects.toThrow();
      
      expect(attempts).toBe(1);
    });
  });
});
