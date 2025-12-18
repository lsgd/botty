import { TranscriptionService } from './transcription-service.js';
import { i18n } from '../../utils/i18n.js';

export class MessageTracker {
  constructor() {
    this.queues = new Map(); // chatId -> Promise (tail of the queue)
    this.pending = new Set(); // messageId (currently processing or queued)
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

    this.pending.add(messageId);
    const chatId = message.fromMe ? message.to : message.from;

    // Initialize queue for this chat if it doesn't exist
    if (!this.queues.has(chatId)) {
      this.queues.set(chatId, Promise.resolve());
    }

    // Get the previous task in the queue
    const previousTask = this.queues.get(chatId);

    // Chain the new task
    const processingTask = previousTask.then(async () => {
      console.log(`[MessageTracker] Starting transcription for ${messageId}`);

      try {
        // Start transcription
        const transcriptionText = await TranscriptionService.transcribe(audioPath, messageId);

        // Reply to the original message
        await message.reply(i18n.t('transcriptionResult', transcriptionText));

        // Mark as unread
        try {
          const chat = await message.getChat();
          if (chat) {
            await chat.markUnread();
          }
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
      }
    });

    // Wrap with cleanup logic
    // We use a separate promise to ensure we check the map against the *stored* promise
    const currentTask = processingTask.finally(() => {
      // If this task is still the tail of the queue, remove the queue
      if (this.queues.get(chatId) === currentTask) {
        this.queues.delete(chatId);
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
      activeQueues: this.queues.size
    };
  }

  // Clean up old completed entries (optional, for memory management)
  cleanup(maxAge = 3600000) { // Default 1 hour
    // For a production system, you'd want to track completion timestamps
    // and remove entries older than maxAge
    // Also clean up empty queues
  }
}

export const messageTracker = new MessageTracker();
