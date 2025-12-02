import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { MessageTracker } from '../../../src/plugins/transcription/message-tracker.js';
import { TranscriptionService } from '../../../src/plugins/transcription/transcription-service.js';

describe('MessageTracker', () => {
  let tracker;
  const mockMessage = {
    from: 'chat1',
    id: { _serialized: 'msg123' },
    reply: mock.fn(),
    getChat: mock.fn(async () => ({ markUnread: mock.fn() }))
  };

  beforeEach(() => {
    tracker = new MessageTracker();
    // Mock TranscriptionService.transcribe to avoid actual API calls
    mock.method(TranscriptionService, 'transcribe', async () => 'Transcribed text');
  });

  describe('isProcessing', () => {
    it('should return false for untracked message', () => {
      assert.strictEqual(tracker.isProcessing('msg123'), false);
    });

    it('should return true for message being processed', () => {
      // Add a pending entry
      tracker.pending.add('msg123');
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

      await tracker.transcribe('msg123', mockMessage, '/path/to/audio.ogg');

      // Should not be in pending
      assert.strictEqual(tracker.pending.has('msg123'), false);
    });

    it('should skip messages already being processed', async () => {
      // Simulate ongoing processing
      tracker.pending.add('msg123');

      const pendingSizeBefore = tracker.pending.size;

      await tracker.transcribe('msg123', mockMessage, '/path/to/audio.ogg');

      // Should not add another pending entry (size remains 1)
      assert.strictEqual(tracker.pending.size, pendingSizeBefore);
    });

    it('should queue messages for the same chat', async () => {
      const msg1 = { ...mockMessage, id: { _serialized: 'msg1' } };
      const msg2 = { ...mockMessage, id: { _serialized: 'msg2' } };
      
      // Start first transcription
      const p1 = tracker.transcribe('msg1', msg1, 'path1');
      assert.strictEqual(tracker.isProcessing('msg1'), true);
      
      // Start second transcription
      const p2 = tracker.transcribe('msg2', msg2, 'path2');
      assert.strictEqual(tracker.isProcessing('msg2'), true);
      
      await Promise.all([p1, p2]);
      
      assert.strictEqual(tracker.isCompleted('msg1'), true);
      assert.strictEqual(tracker.isCompleted('msg2'), true);
    });
  });

  describe('getStatus', () => {
    it('should return correct status', () => {
      tracker.pending.add('msg1');
      tracker.pending.add('msg2');
      tracker.completed.add('msg3');
      tracker.completed.add('msg4');
      tracker.completed.add('msg5');
      tracker.queues.set('chat1', Promise.resolve());

      const status = tracker.getStatus();

      assert.strictEqual(status.pending, 2);
      assert.strictEqual(status.completed, 3);
      assert.strictEqual(status.activeQueues, 1);
    });

    it('should return zeros when empty', () => {
      const status = tracker.getStatus();

      assert.strictEqual(status.pending, 0);
      assert.strictEqual(status.completed, 0);
      assert.strictEqual(status.activeQueues, 0);
    });
  });
});
