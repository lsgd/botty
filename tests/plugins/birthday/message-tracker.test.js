import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert';
import { DailyMessageTracker } from '../../../src/plugins/birthday/message-tracker.js';

describe('DailyMessageTracker', () => {
  let tracker;
  let originalConfig;

  before(async () => {
    // Save original config
    const { config } = await import('../../../src/config.js');
    originalConfig = { ...config.auth };
  });

  after(async () => {
    // Restore original config
    const { config } = await import('../../../src/config.js');
    Object.assign(config.auth, originalConfig);
  });

  beforeEach(async () => {
    tracker = new DailyMessageTracker();

    // Set up test authorized numbers
    const { config } = await import('../../../src/config.js');
    config.auth.authorizedNumbers = ['+1234567890', '+0987654321'];
  });

  describe('recordMessage', () => {
    it('should record message from authorized user', () => {
      tracker.recordMessage('chat123', '+1234567890@c.us');

      const today = tracker.getTodayString();
      assert.ok(tracker.chatMessages.has('chat123'));
      assert.ok(tracker.chatMessages.get('chat123').has(today));
    });

    it('should not record message from unauthorized user', () => {
      tracker.recordMessage('chat123', '+9999999999@c.us');

      assert.strictEqual(tracker.chatMessages.has('chat123'), false);
    });

    it('should record messages for multiple chats', () => {
      tracker.recordMessage('chat1', '+1234567890@c.us');
      tracker.recordMessage('chat2', '+0987654321@c.us');

      assert.ok(tracker.chatMessages.has('chat1'));
      assert.ok(tracker.chatMessages.has('chat2'));
    });

    it('should handle multiple messages in same chat on same day', () => {
      tracker.recordMessage('chat123', '+1234567890@c.us');
      tracker.recordMessage('chat123', '+0987654321@c.us');

      const today = tracker.getTodayString();
      const dates = tracker.chatMessages.get('chat123');

      assert.strictEqual(dates.size, 1);
      assert.ok(dates.has(today));
    });
  });

  describe('hasMessageToday', () => {
    it('should return true if authorized user messaged today', () => {
      tracker.recordMessage('chat123', '+1234567890@c.us');

      assert.strictEqual(tracker.hasMessageToday('chat123'), true);
    });

    it('should return false if no messages today', () => {
      assert.strictEqual(tracker.hasMessageToday('chat123'), false);
    });

    it('should return false for chat with no messages', () => {
      tracker.recordMessage('chat456', '+1234567890@c.us');

      assert.strictEqual(tracker.hasMessageToday('chat123'), false);
    });
  });

  describe('isAuthorized', () => {
    it('should recognize authorized numbers', () => {
      assert.strictEqual(tracker.isAuthorized('+1234567890@c.us'), true);
      assert.strictEqual(tracker.isAuthorized('+0987654321@c.us'), true);
    });

    it('should reject unauthorized numbers', () => {
      assert.strictEqual(tracker.isAuthorized('+9999999999@c.us'), false);
    });

    it('should normalize phone numbers', () => {
      assert.strictEqual(tracker.isAuthorized('1234567890@c.us'), true);
    });
  });

  describe('getTodayString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const today = tracker.getTodayString();
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      assert.ok(dateRegex.test(today));
    });

    it('should return current date', () => {
      const today = new Date();
      const expected = today.toISOString().split('T')[0];
      const actual = tracker.getTodayString();

      assert.strictEqual(actual, expected);
    });
  });

  describe('cleanup', () => {
    it('should remove dates older than 7 days', () => {
      const chatId = 'chat123';

      // Manually add old dates
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const oldDateString = oldDate.toISOString().split('T')[0];

      tracker.chatMessages.set(chatId, new Set([oldDateString]));

      // Run cleanup
      tracker.cleanup(chatId);

      // Old date should be removed
      const dates = tracker.chatMessages.get(chatId);
      assert.strictEqual(dates, undefined); // Set should be deleted when empty
    });

    it('should keep recent dates', () => {
      const chatId = 'chat123';

      // Add recent date
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      const recentDateString = recentDate.toISOString().split('T')[0];

      tracker.chatMessages.set(chatId, new Set([recentDateString]));

      // Run cleanup
      tracker.cleanup(chatId);

      // Recent date should be kept
      const dates = tracker.chatMessages.get(chatId);
      assert.ok(dates);
      assert.ok(dates.has(recentDateString));
    });

    it('should handle mixed old and recent dates', () => {
      const chatId = 'chat123';

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const oldDateString = oldDate.toISOString().split('T')[0];

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      const recentDateString = recentDate.toISOString().split('T')[0];

      tracker.chatMessages.set(chatId, new Set([oldDateString, recentDateString]));

      // Run cleanup
      tracker.cleanup(chatId);

      // Only recent date should remain
      const dates = tracker.chatMessages.get(chatId);
      assert.strictEqual(dates.size, 1);
      assert.ok(dates.has(recentDateString));
      assert.ok(!dates.has(oldDateString));
    });
  });

  describe('getStatus', () => {
    it('should return status of all chats', () => {
      const today = tracker.getTodayString();

      tracker.recordMessage('chat1', '+1234567890@c.us');
      tracker.recordMessage('chat2', '+0987654321@c.us');

      const status = tracker.getStatus();

      assert.ok('chat1' in status);
      assert.ok('chat2' in status);
      assert.ok(status.chat1.includes(today));
      assert.ok(status.chat2.includes(today));
    });

    it('should return empty object when no messages', () => {
      const status = tracker.getStatus();
      assert.deepStrictEqual(status, {});
    });
  });
});
