/**
 * Retry Queue System
 * Handles retry logic for failed operations (emails, webhooks, etc.)
 * Task 16.1.4: Add retry queue for failed operations
 */

const logger = require('./logger');

/**
 * In-memory retry queue
 * In production, this should be replaced with a persistent queue (Redis, RabbitMQ, etc.)
 */
class RetryQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds initial delay
    this.maxDelay = 60000; // 60 seconds max delay
  }

  /**
   * Add an operation to the retry queue
   * @param {string} operationType - Type of operation (email, webhook, etc.)
   * @param {Function} operation - Async function to retry
   * @param {object} context - Context data for logging
   * @param {number} priority - Priority level (1-10, higher = more important)
   * @returns {string} Queue item ID
   */
  add(operationType, operation, context = {}, priority = 5) {
    const item = {
      id: `${operationType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operationType,
      operation,
      context,
      priority,
      attempts: 0,
      maxRetries: this.maxRetries,
      addedAt: new Date(),
      lastAttemptAt: null,
      nextRetryAt: new Date(),
      status: 'pending'
    };

    this.queue.push(item);
    
    // Sort queue by priority (higher priority first) and nextRetryAt
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.nextRetryAt - b.nextRetryAt;
    });

    logger.info('Operation added to retry queue', {
      operation: 'retry_queue_add',
      queueItemId: item.id,
      operationType,
      priority,
      queueSize: this.queue.length,
      ...context
    });

    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }

    return item.id;
  }

  /**
   * Start processing the retry queue
   */
  async startProcessing() {
    if (this.processing) return;
    
    this.processing = true;
    logger.info('Retry queue processing started', {
      operation: 'retry_queue_start',
      queueSize: this.queue.length
    });

    while (this.queue.length > 0) {
      const now = new Date();
      const item = this.queue.find(i => i.status === 'pending' && i.nextRetryAt <= now);

      if (!item) {
        // No items ready to process, wait a bit
        await this.sleep(1000);
        continue;
      }

      await this.processItem(item);
    }

    this.processing = false;
    logger.info('Retry queue processing stopped', {
      operation: 'retry_queue_stop'
    });
  }

  /**
   * Process a single queue item
   * @param {object} item - Queue item to process
   */
  async processItem(item) {
    item.attempts++;
    item.lastAttemptAt = new Date();
    item.status = 'processing';

    logger.logRetryAttempt({
      attemptNumber: item.attempts,
      maxAttempts: item.maxRetries,
      operationType: item.operationType,
      reference: item.context.reference || item.context.orderId,
      error: item.context.lastError
    });

    try {
      // Execute the operation
      await item.operation();

      // Success - remove from queue
      item.status = 'completed';
      this.removeItem(item.id);

      logger.info('Retry operation succeeded', {
        operation: 'retry_success',
        queueItemId: item.id,
        operationType: item.operationType,
        attempts: item.attempts,
        ...item.context
      });
    } catch (error) {
      // Operation failed
      item.context.lastError = error.message;

      if (item.attempts >= item.maxRetries) {
        // Max retries reached - mark as failed and remove
        item.status = 'failed';
        this.removeItem(item.id);

        logger.error('Retry operation failed after max attempts', {
          operation: 'retry_failed',
          queueItemId: item.id,
          operationType: item.operationType,
          attempts: item.attempts,
          maxRetries: item.maxRetries,
          error: error.message,
          ...item.context
        });

        // Optionally: Store failed operations in database for manual review
        await this.storeFailed Operation(item, error);
      } else {
        // Schedule next retry with exponential backoff
        const delay = Math.min(
          this.retryDelay * Math.pow(2, item.attempts - 1),
          this.maxDelay
        );
        item.nextRetryAt = new Date(Date.now() + delay);
        item.status = 'pending';

        logger.warn('Retry operation failed, will retry', {
          operation: 'retry_scheduled',
          queueItemId: item.id,
          operationType: item.operationType,
          attempts: item.attempts,
          maxRetries: item.maxRetries,
          nextRetryIn: `${delay}ms`,
          error: error.message,
          ...item.context
        });
      }
    }
  }

  /**
   * Remove an item from the queue
   * @param {string} itemId - Queue item ID
   */
  removeItem(itemId) {
    const index = this.queue.findIndex(i => i.id === itemId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Store failed operation for manual review
   * @param {object} item - Failed queue item
   * @param {Error} error - Error that caused failure
   */
  async storeFailedOperation(item, error) {
    try {
      // In production, store in database
      // For now, just log it
      logger.error('Failed operation stored for manual review', {
        operation: 'failed_operation_stored',
        queueItemId: item.id,
        operationType: item.operationType,
        attempts: item.attempts,
        error: error.message,
        context: item.context,
        addedAt: item.addedAt,
        lastAttemptAt: item.lastAttemptAt
      });

      // TODO: Store in database table for admin review
      // await FailedOperation.create({
      //   operation_type: item.operationType,
      //   context: item.context,
      //   attempts: item.attempts,
      //   error: error.message,
      //   added_at: item.addedAt,
      //   last_attempt_at: item.lastAttemptAt
      // });
    } catch (storeError) {
      logger.error('Failed to store failed operation', {
        operation: 'store_failed_operation_error',
        error: storeError.message
      });
    }
  }

  /**
   * Get queue status
   * @returns {object} Queue status
   */
  getStatus() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      items: this.queue.map(item => ({
        id: item.id,
        operationType: item.operationType,
        status: item.status,
        attempts: item.attempts,
        maxRetries: item.maxRetries,
        nextRetryAt: item.nextRetryAt,
        priority: item.priority
      }))
    };
  }

  /**
   * Clear the queue (for testing)
   */
  clear() {
    this.queue = [];
    this.processing = false;
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const retryQueue = new RetryQueue();

/**
 * Add email operation to retry queue
 * @param {Function} emailOperation - Email sending function
 * @param {object} context - Email context (recipient, type, etc.)
 */
const addEmailToQueue = (emailOperation, context) => {
  return retryQueue.add('email', emailOperation, context, 7);
};

/**
 * Add webhook callback to retry queue
 * @param {Function} webhookOperation - Webhook callback function
 * @param {object} context - Webhook context
 */
const addWebhookToQueue = (webhookOperation, context) => {
  return retryQueue.add('webhook', webhookOperation, context, 8);
};

/**
 * Add notification to retry queue
 * @param {Function} notificationOperation - Notification function
 * @param {object} context - Notification context
 */
const addNotificationToQueue = (notificationOperation, context) => {
  return retryQueue.add('notification', notificationOperation, context, 6);
};

/**
 * Get retry queue status
 * @returns {object} Queue status
 */
const getQueueStatus = () => {
  return retryQueue.getStatus();
};

/**
 * Clear retry queue (for testing)
 */
const clearQueue = () => {
  retryQueue.clear();
};

module.exports = {
  RetryQueue,
  retryQueue,
  addEmailToQueue,
  addWebhookToQueue,
  addNotificationToQueue,
  getQueueStatus,
  clearQueue
};
