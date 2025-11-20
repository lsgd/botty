import cron from 'node-cron';
import { DateTime } from 'luxon';
import { BirthdayCSVLoader } from './csv-loader.js';
import { BirthdayMessageGenerator } from './message-generator.js';
import { dailyMessageTracker } from './message-tracker.js';
import { config } from '../../config.js';

export class BirthdayScheduler {
  constructor(client, birthdayFilePath) {
    this.client = client;
    this.birthdayFilePath = birthdayFilePath;
    this.birthdays = [];
    this.scheduledTasks = new Map(); // chatId -> timeout
    this.cronJob = null;
    this.timezone = config.scheduler.timezone;
    this.windowStartHour = config.scheduler.birthday.windowStartHour;
    this.windowEndHour = config.scheduler.birthday.windowEndHour;
    this.checkHour = config.scheduler.birthday.checkHour;
  }

  /**
   * Start the birthday scheduler
   */
  async start() {
    console.log('[BirthdayScheduler] Starting birthday scheduler...');

    // Load birthdays from CSV
    await this.loadBirthdays();

    // Check immediately on startup (in case bot restarted during birthday window)
    await this.checkBirthdays();

    // Schedule daily check at configured time (prepare for sending window)
    const cronExpression = `0 ${this.checkHour} * * *`;
    this.cronJob = cron.schedule(
      cronExpression,
      async () => {
        console.log('[BirthdayScheduler] Running daily birthday check...');
        await this.loadBirthdays(); // Reload CSV in case it changed
        await this.checkBirthdays();
      },
      { timezone: this.timezone }
    );

    console.log('[BirthdayScheduler] ✅ Birthday scheduler started successfully');
  }

  /**
   * Stop the birthday scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('[BirthdayScheduler] Birthday scheduler stopped');
    }

    // Cancel all scheduled tasks
    for (const timeout of this.scheduledTasks.values()) {
      clearTimeout(timeout);
    }
    this.scheduledTasks.clear();
  }

  /**
   * Reload birthdays from CSV
   */
  async loadBirthdays() {
    this.birthdays = await BirthdayCSVLoader.load(this.birthdayFilePath, this.client);
  }

  /**
   * Check for today's birthdays and schedule messages
   */
  async checkBirthdays() {
    const todaysBirthdays = BirthdayCSVLoader.getTodaysBirthdays(this.birthdays);

    if (todaysBirthdays.length === 0) {
      console.log('[BirthdayScheduler] No birthdays today');
      return;
    }

    console.log(`[BirthdayScheduler] 🎉 Found ${todaysBirthdays.length} birthdays today!`);

    for (const birthday of todaysBirthdays) {
      await this.scheduleBirthdayMessage(birthday);
    }
  }

  /**
   * Schedule a birthday message to be sent randomly between 7-9 AM
   * @param {Object} birthday - Birthday entry
   */
  async scheduleBirthdayMessage(birthday) {
    const { chatId } = birthday;
    const personName = birthday.personName || `${birthday.firstName || ''} ${birthday.lastName || ''}`.trim() || chatId;

    // Check if we already scheduled for this chat today
    if (this.scheduledTasks.has(chatId)) {
      console.log(`[BirthdayScheduler] Already scheduled for ${personName} (${chatId})`);
      return;
    }

    // Check if authorized user already sent a message today
    if (dailyMessageTracker.hasMessageToday(chatId)) {
      console.log(`[BirthdayScheduler] ⏭️  Skipping ${personName} (${chatId}) - authorized user already messaged today`);
      return;
    }

    // Calculate random time between configured window (default 7–9 AM)
    const delay = this.getRandomDelayMs();
    const sendTime = DateTime.now().setZone(this.timezone).plus({ milliseconds: delay });

    console.log(
      `[BirthdayScheduler] 📅 Scheduled birthday message for ${personName} at ${sendTime.toFormat('HH:mm:ss')} ${this.timezone}`
    );

    // Schedule the message
    const timeout = setTimeout(async () => {
      await this.sendBirthdayMessage(birthday);
      this.scheduledTasks.delete(chatId);
    }, delay);

    this.scheduledTasks.set(chatId, timeout);
  }

  /**
   * Get random delay in milliseconds between now and 9:00 AM
   * If current time is before 7:00 AM, schedule between 7:00-9:00 AM
   * If current time is between 7:00-9:00 AM, schedule randomly in remaining window
   * If current time is after 9:00 AM, schedule within next minute (missed window)
   * @returns {number} Delay in milliseconds
   */
  getRandomDelayMs() {
    if (this.windowEndHour <= this.windowStartHour) {
      return 0;
    }

    const now = DateTime.now().setZone(this.timezone);
    const windowStart = now.set({ hour: this.windowStartHour, minute: 0, second: 0, millisecond: 0 });
    const windowEnd = now.set({ hour: this.windowEndHour, minute: 0, second: 0, millisecond: 0 });

    let minDelayMs = 0;
    let maxDelayMs = 60 * 1000; // fallback when window already passed

    if (now < windowStart) {
      minDelayMs = windowStart.diff(now).as('milliseconds');
      maxDelayMs = windowEnd.diff(now).as('milliseconds');
    } else if (now < windowEnd) {
      minDelayMs = 0;
      maxDelayMs = windowEnd.diff(now).as('milliseconds');
    }

    const range = Math.max(maxDelayMs - minDelayMs, 1);
    return Math.round(minDelayMs + Math.random() * range);
  }

  /**
   * Send a birthday message
   * @param {Object} birthday - Birthday entry
   */
  async sendBirthdayMessage(birthday) {
    const { chatId, personName } = birthday;

    try {
      // Double-check if authorized user sent a message in the meantime
      if (dailyMessageTracker.hasMessageToday(chatId)) {
        console.log(`[BirthdayScheduler] ⏭️  Cancelling birthday message for ${personName} - authorized user messaged in the meantime`);
        return;
      }

      // Generate personalized message using GPT-4o
      const message = await BirthdayMessageGenerator.generate(birthday);

      // Send message
      await this.client.sendMessage(chatId, message);

      console.log(`[BirthdayScheduler] 🎂 ✅ Sent birthday wish to ${personName} (${chatId})`);
    } catch (error) {
      console.error(`[BirthdayScheduler] ❌ Failed to send birthday message to ${personName} (${chatId}):`, error);
    }
  }

  /**
   * Get all birthdays
   * @returns {Array} All loaded birthdays
   */
  getBirthdays() {
    return this.birthdays;
  }

  /**
   * Get scheduler status for debugging
   * @returns {Object}
   */
  getStatus() {
    return {
      totalBirthdays: this.birthdays.length,
      todaysBirthdays: BirthdayCSVLoader.getTodaysBirthdays(this.birthdays).length,
      scheduledTasks: this.scheduledTasks.size,
      isRunning: this.cronJob !== null
    };
  }
}
