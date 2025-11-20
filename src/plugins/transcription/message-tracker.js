import { TranscriptionService } from './transcription-service.js';
import { i18n } from '../../utils/i18n.js';

export class MessageTracker {
  constructor() {
    this.pending = new Map(); // messageId -> { timestamp, promise, message }
    this.completed = new Set(); // messageId -> to avoid duplicates
  }

  isProcessing(messageId) {
    return this.pending.has(messageId);
  }

  isCompleted(messageId) {
    return this.completed.has(messageId);
  }

  async transcribe(messageId, message, audioPath) {
    // Check if already processed or processing
    if (this.isCompleted(messageId)) {
      console.log(`[MessageTracker] Message ${messageId} already transcribed, skipping`);
      return;
    }

    if (this.isProcessing(messageId)) {
      console.log(`[MessageTracker] Message ${messageId} already being transcribed, skipping`);
      return;
    }

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
      // Remove from pending
      this.pending.delete(messageId);
    }
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
    const now = Date.now();
    const oldCompleted = Array.from(this.completed).filter(id => {
      // Simple age-based cleanup - you might want to store timestamps
      return false; // Keep all for now
    });

    // For a production system, you'd want to track completion timestamps
    // and remove entries older than maxAge
  }
}

export const messageTracker = new MessageTracker();
