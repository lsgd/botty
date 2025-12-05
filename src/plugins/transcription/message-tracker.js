import { TranscriptionService } from './transcription-service.js';
import { i18n } from '../../utils/i18n.js';
import { config } from '../../config.js';

export class MessageTracker {
  constructor() {
    this.queues = new Map(); // chatId -> Promise (tail of the queue)
    this.pending = new Set(); // messageId (currently processing or queued)
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

    this.pending.add(messageId);
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

        // Reply to the original message (solves race condition!)
        // By quoting, each transcription is tied to its source message
        await message.reply(i18n.t('transcriptionResult', transcriptionText));

        // Mark as unread
        try {
          const chat = await message.getChat();
          await chat.markUnread();
        } catch (chatError) {
          console.error(`[MessageTracker] Failed to mark chat as unread:`, chatError);
        }

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
      completed: this.completed.size
    };
  }

  // Clean up old completed entries (optional, for memory management)
  cleanup(maxAge = 3600000) { // Default 1 hour
    // For a production system, you'd want to track completion timestamps
    // and remove entries older than maxAge
    // Also clean up empty queues
  }

  // Handle message revocation
  async handleRevoke(message, client) {
    try {
      console.log(`[MessageTracker] Received revoke event for message:`, {
        id: message.id?._serialized,
        type: message.type,
        body: message.body?.substring(0, 50),
        from: message.from,
        hasMedia: message.hasMedia,
        rawData: message.rawData,
        rawDataId: message.rawData?.id,
        rawDataKeyId: message.rawData?.key?.id,
        rawDataKeyRemoteJid: message.rawData?.key?.remoteJid
      });

      // For revoked messages, get the original message ID from protocolMessageKey
      let messageId = message.id._serialized;
      if (message.type === 'revoked' && message.rawData?.protocolMessageKey?._serialized) {
        messageId = message.rawData.protocolMessageKey._serialized;
        console.log(`[MessageTracker] Using original message ID from protocolMessageKey: ${messageId}`);
      }
      console.log(`[MessageTracker] Processing revoke for message ${messageId} (type: ${message.type})`);

      // Check if transcription is in progress
      if (this.isProcessing(messageId)) {
        console.log(`[MessageTracker] Cancelling in -progress transcription for revoked message ${messageId} `);
        this.cancelled.add(messageId);
        return;
      }

      // Check if transcription exists and delete it
      if (this.isCompleted(messageId)) {
        const entry = this.transcriptionMessages.get(messageId);
        if (entry) {
          console.log(`[MessageTracker] Found transcription entry for ${messageId}: `, entry.transcriptionMessage.id._serialized);
          try {
            console.log(`[MessageTracker] Deleting transcription message ${entry.transcriptionMessage.id._serialized} `);
            await entry.transcriptionMessage.delete(true); // Delete for everyone
            console.log(`[MessageTracker] Deleted transcription for revoked message ${messageId} `);
            this.transcriptionMessages.delete(messageId);
          } catch (deleteError) {
            console.error(`[MessageTracker] Failed to delete transcription: `, deleteError);
            // Still remove from map even if delete failed
            this.transcriptionMessages.delete(messageId);
          }
        } else {
          console.log(`[MessageTracker] No transcription entry found for completed message ${messageId} `);
        }
      } else {
        console.log(`[MessageTracker] Message ${messageId} is not completed, no transcription to delete `);
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

  // Handle message revocation
  async handleRevoke(message, client) {
    try {
      console.log(`[MessageTracker] Received revoke event for message:`, {
        id: message.id?._serialized,
        type: message.type,
        body: message.body?.substring(0, 50),
        from: message.from,
        hasMedia: message.hasMedia,
        rawData: message.rawData,
        rawDataId: message.rawData?.id,
        rawDataKeyId: message.rawData?.key?.id,
        rawDataKeyRemoteJid: message.rawData?.key?.remoteJid
      });

      // For revoked messages, get the original message ID from protocolMessageKey
      let messageId = message.id._serialized;
      if (message.type === 'revoked' && message.rawData?.protocolMessageKey?._serialized) {
        messageId = message.rawData.protocolMessageKey._serialized;
        console.log(`[MessageTracker] Using original message ID from protocolMessageKey: ${messageId}`);
      }
      console.log(`[MessageTracker] Processing revoke for message ${messageId} (type: ${message.type})`);

      // Check if transcription is in progress
      if (this.isProcessing(messageId)) {
        console.log(`[MessageTracker] Cancelling in-progress transcription for revoked message ${messageId}`);
        this.cancelled.add(messageId);
        return;
      }

      // Check if transcription exists and delete it
      if (this.isCompleted(messageId)) {
        const entry = this.transcriptionMessages.get(messageId);
        if (entry) {
          console.log(`[MessageTracker] Found transcription entry for ${messageId}:`, entry.transcriptionMessage.id._serialized);
          try {
            console.log(`[MessageTracker] Deleting transcription message ${entry.transcriptionMessage.id._serialized}`);
            await entry.transcriptionMessage.delete(true); // Delete for everyone
            console.log(`[MessageTracker] Deleted transcription for revoked message ${messageId}`);
            this.transcriptionMessages.delete(messageId);
          } catch (deleteError) {
            console.error(`[MessageTracker] Failed to delete transcription:`, deleteError);
            // Still remove from map even if delete failed
            this.transcriptionMessages.delete(messageId);
          }
        } else {
          console.log(`[MessageTracker] No transcription entry found for completed message ${messageId}`);
        }
      } else {
        console.log(`[MessageTracker] Message ${messageId} is not completed, no transcription to delete`);
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
