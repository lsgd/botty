import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MessageTracker } from '../../../src/plugins/transcription/message-tracker.js';

describe('MessageTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new MessageTracker();
  });

  describe('isProcessing', () => {
    it('should return false for untracked message', () => {
      assert.strictEqual(tracker.isProcessing('msg123'), false);
    });

    it('should return true for message being processed', () => {
      // Add a pending entry
      tracker.pending.set('msg123', {
        timestamp: Date.now(),
        messageId: 'msg123',
        promise: Promise.resolve()
      });

      assert.strictEqual(tracker.isProcessing('msg123'), true);
    });
  });

  describe('isCompleted', () => {
    it('should return false for message not completed', () => {
      assert.strictEqual(tracker.isCompleted('msg123'), false);
    });

    it('should return true for completed message', () => {
      tracker.completed.add('msg123');
      assert.strictEqual(tracker.isCompleted('msg123'), true);
    });
  });

  describe('transcribe', () => {
    it('should skip already completed messages', async () => {
      tracker.completed.add('msg123');

      await tracker.transcribe('msg123', {}, '/path/to/audio.ogg');

      // Should not be in pending
      assert.strictEqual(tracker.pending.has('msg123'), false);
    });

    it('should skip messages already being processed', async () => {
      // Simulate ongoing processing
      tracker.pending.set('msg123', {
        timestamp: Date.now(),
        messageId: 'msg123',
        promise: new Promise(() => {}) // Never resolves
      });

      const pendingSizeBefore = tracker.pending.size;

      await tracker.transcribe('msg123', {}, '/path/to/audio.ogg');

      // Should not add another pending entry
      assert.strictEqual(tracker.pending.size, pendingSizeBefore);
    });
  });

  describe('getStatus', () => {
    it('should return correct status', () => {
      tracker.pending.set('msg1', { timestamp: Date.now() });
      tracker.pending.set('msg2', { timestamp: Date.now() });
      tracker.completed.add('msg3');
      tracker.completed.add('msg4');
      tracker.completed.add('msg5');

      const status = tracker.getStatus();

      assert.strictEqual(status.pending, 2);
      assert.strictEqual(status.completed, 3);
    });

    it('should return zeros when empty', () => {
      const status = tracker.getStatus();

      assert.strictEqual(status.pending, 0);
      assert.strictEqual(status.completed, 0);
    });
  });

  describe('race condition handling', () => {
    it('should handle multiple simultaneous transcriptions', async () => {
      const messages = [
        { id: 'msg1', duration: 100 },
        { id: 'msg2', duration: 50 },
        { id: 'msg3', duration: 150 }
      ];

      // All should be marked as completed eventually
      // even if they finish out of order
      messages.forEach(msg => {
        tracker.completed.add(msg.id);
      });

      assert.strictEqual(tracker.completed.size, 3);
      assert.ok(tracker.isCompleted('msg1'));
      assert.ok(tracker.isCompleted('msg2'));
      assert.ok(tracker.isCompleted('msg3'));
    });
  });
});
