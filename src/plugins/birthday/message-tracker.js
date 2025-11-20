import fs from 'fs/promises';
import path from 'path';
import { DateTime } from 'luxon';
import { config } from '../../config.js';

/**
 * Tracks messages from authorized users per chat per day
 * to avoid sending birthday wishes if user already messaged
 */
export class DailyMessageTracker {
  constructor() {
    // Map: chatId -> Set of dates when authorized users sent messages
    // Format: chatId -> Set(['2025-01-18', '2025-01-19', ...])
    this.chatMessages = new Map();
    this.filePath = path.join(process.cwd(), 'data', 'birthday-message-tracker.json');
    this.initialized = false;
    this.persistPromise = null;
  }

  async initialize(filePath = this.filePath) {
    if (this.initialized) {
      return;
    }
    this.filePath = filePath;
    await this.loadFromDisk();
    this.initialized = true;
  }

  async loadFromDisk() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      this.chatMessages = new Map(
        Object.entries(data).map(([chatId, dates]) => [chatId, new Set(dates)])
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.writeFile(this.filePath, JSON.stringify({}, null, 2));
        this.chatMessages = new Map();
        return;
      }
      throw error;
    }
  }

  async persist() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const payload = {};
    for (const [chatId, dates] of this.chatMessages.entries()) {
      payload[chatId] = Array.from(dates.values());
    }
    await fs.writeFile(this.filePath, JSON.stringify(payload, null, 2));
  }

  schedulePersist() {
    if (!this.initialized) {
      return;
    }
    if (this.persistPromise) {
      return;
    }
    this.persistPromise = this.persist()
      .catch(error => {
        console.error('[DailyMessageTracker] Failed to persist tracker state:', error.message);
      })
      .finally(() => {
        this.persistPromise = null;
      });
  }

  /**
   * Record that an authorized user sent a message in a chat
   * @param {string} chatId - Chat ID
   * @param {string} from - Sender ID
   */
  recordMessage(chatId, from) {
    // Check if sender is authorized
    if (!this.isAuthorized(from)) {
      return;
    }

    const today = this.getTodayString();

    if (!this.chatMessages.has(chatId)) {
      this.chatMessages.set(chatId, new Set());
    }

    this.chatMessages.get(chatId).add(today);

    // Cleanup old dates (keep only last 7 days)
    this.cleanup(chatId);
    this.schedulePersist();
  }

  /**
   * Check if an authorized user sent a message today in this chat
   * @param {string} chatId - Chat ID
   * @returns {boolean}
   */
  hasMessageToday(chatId) {
    const today = this.getTodayString();
    const dates = this.chatMessages.get(chatId);
    return dates ? dates.has(today) : false;
  }

  /**
   * Check if a user is authorized
   * @param {string} from - Sender ID
   * @returns {boolean}
   */
  isAuthorized(from) {
    const authorizedNumbers = config.auth.authorizedNumbers;

    return authorizedNumbers.some(authNumber => {
      const cleanAuth = authNumber.replace('@c.us', '').replace(/\D/g, '');
      const cleanFrom = from.replace('@c.us', '').replace(/\D/g, '');
      return cleanAuth === cleanFrom;
    });
  }

  /**
   * Get today's date as string (YYYY-MM-DD)
   * @returns {string}
   */
  getTodayString() {
    return DateTime.now().setZone(config.scheduler.timezone).toISODate();
  }

  /**
   * Cleanup old dates for a chat (keep only last 7 days)
   * @param {string} chatId
   */
  cleanup(chatId) {
    const dates = this.chatMessages.get(chatId);
    if (!dates) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffString = cutoff.toISOString().split('T')[0];

    const toDelete = [];
    for (const date of dates) {
      if (date < cutoffString) {
        toDelete.push(date);
      }
    }

    toDelete.forEach(date => dates.delete(date));

    if (dates.size === 0) {
      this.chatMessages.delete(chatId);
    }
  }

  /**
   * Get tracker status for debugging
   * @returns {Object}
   */
  getStatus() {
    const status = {};
    for (const [chatId, dates] of this.chatMessages.entries()) {
      status[chatId] = Array.from(dates);
    }
    return status;
  }
}

export const dailyMessageTracker = new DailyMessageTracker();
