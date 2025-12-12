import { TranscriptionService } from './transcription-service.js';
import { i18n } from '../../utils/i18n.js';
import { config } from '../../config.js';

export class MessageTracker {
  constructor() {
    this.queues = new Map(); // chatId -> Promise (tail of the queue)
    this.pending = new Map(); // messageId -> { timestamp, promise, message }
    this.completed = new Set(); // messageId -> to avoid duplicates
    this.transcriptionMessages = new Map(); // audioMessageId -> { transcriptionMessage, timestamp }
    this.cancelled = new Set(); // messageIds that should not be transcribed

    // Set up periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupTranscriptions();
    }, config.transcription.cleanupIntervalMs);
  }

  isProcessing(messageId) {
    return this.pending.has(messageId);
  }

  isCompleted(messageId) {
    return this.completed.has(messageId);
  }

  async transcribe(messageId, message, audioPath, client) {
    // Check if already processed or processing
    if (this.isCompleted(messageId)) {
      console.log(`[MessageTracker] Message ${messageId} already transcribed, skipping`);
      return;
    }

    if (this.isProcessing(messageId)) {
      console.log(`[MessageTracker] Message ${messageId} already being transcribed, skipping`);
      return;
    }

    const chatId = message.from;

    // Initialize queue for this chat if it doesn't exist
    if (!this.queues.has(chatId)) {
      this.queues.set(chatId, Promise.resolve());
    }

    // Get the previous task in the queue
    const previousTask = this.queues.get(chatId);

    // Chain the new task
    const currentTask = previousTask.then(async () => {
      console.log(`[MessageTracker] Starting transcription for ${messageId}`);

      const entry = {
        timestamp: Date.now(),
        messageId: messageId,
        message: message
      };

      try {
        // Start transcription and store the promise
        const promise = TranscriptionService.transcribe(audioPath, messageId);
        this.pending.set(messageId, { ...entry, promise });

        // Wait for completion
        const transcriptionText = await promise;

        // Check if transcription was cancelled during processing
        if (this.cancelled.has(messageId)) {
          console.log(`[MessageTracker] Transcription for ${messageId} was cancelled, skipping reply`);
          throw new Error('Transcription cancelled');
        }

        // Reply to the original message (solves race condition!)
        // By quoting, each transcription is tied to its source message
        const replyMsg = await message.reply(i18n.t('transcriptionResult', transcriptionText));

        // Store transcription message for potential deletion
        this.transcriptionMessages.set(messageId, {
          transcriptionMessage: replyMsg,
          timestamp: Date.now()
        });

        // Mark as unread
        try {
          const chat = await message.getChat();
          await chat.markUnread();
        } catch (chatError) {
          console.error(`[MessageTracker] Failed to mark chat as unread:`, chatError);
        }
        // Mark as completed
        this.completed.add(messageId);

        console.log(`[MessageTracker] Successfully transcribed ${messageId}`);
      } catch (error) {
        console.error(`[MessageTracker] Error transcribing ${messageId}:`, error);

        // Try to send error message to user
        try {
          const errorDetail = error.message.includes('timeout')
            ? i18n.t('transcriptionTimeout')
            : i18n.t('transcriptionRetry');
          await message.reply(i18n.t('transcriptionFailed') + errorDetail);
        } catch (replyError) {
          console.error(`[MessageTracker] Failed to send error message:`, replyError);
        }
      } finally {
        // Mark as completed and remove from pending
        this.completed.add(messageId);
        this.pending.delete(messageId);
        // Clean up cancelled if present
        this.cancelled.delete(messageId);
      }
    });

    // Update the queue tail
    this.queues.set(chatId, currentTask);

    // Return the task promise so the caller can await it if needed
    return currentTask;
  }

  // Get status for debugging
  getStatus() {
    return {
      pending: this.pending.size,
      completed: this.completed.size,
      transcriptionMessages: this.transcriptionMessages.size,
      cancelled: this.cancelled.size
    };
  }


  // Clean up old transcription message mappings
  cleanupTranscriptions() {
    const now = Date.now();
    const maxAge = config.transcription.maxAgeMs;
    const toRemove = [];

    for (const [audioId, entry] of this.transcriptionMessages) {
      if (now - entry.timestamp > maxAge) {
        toRemove.push(audioId);
      }
    }

    toRemove.forEach(audioId => {
      this.transcriptionMessages.delete(audioId);
      console.log(`[MessageTracker] Cleaned up expired transcription mapping for ${audioId}`);
    });

    if (toRemove.length > 0) {
      console.log(`[MessageTracker] Cleaned up ${toRemove.length} expired transcription mappings`);
    }
  }

  // Handle message revocation
  async handleRevoke(message, client) {
    try {
      // For revoked messages, get the original message ID from protocolMessageKey
      let messageId = message.id._serialized;
      if (message.type === 'revoked' && message.rawData?.protocolMessageKey?._serialized) {
        messageId = message.rawData.protocolMessageKey._serialized;
      }

      // Check if transcription is in progress
      if (this.isProcessing(messageId)) {
        this.cancelled.add(messageId);
        return;
      }

      // Check if transcription exists and delete it
      if (this.isCompleted(messageId)) {
        const entry = this.transcriptionMessages.get(messageId);
        if (entry) {
          try {
            await entry.transcriptionMessage.delete(true); // Delete for everyone
            this.transcriptionMessages.delete(messageId);
          } catch (deleteError) {
            console.error(`[MessageTracker] Failed to delete transcription:`, deleteError);
            // Still remove from map even if delete failed
            this.transcriptionMessages.delete(messageId);
          }
        }
      }
    } catch (error) {
      console.error('[MessageTracker] Error handling message revocation:', error);
    }
  }

  // Clean up resources
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const messageTracker = new MessageTracker();
