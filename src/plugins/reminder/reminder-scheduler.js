import cron from 'node-cron';
import { DateTime } from 'luxon';
import { ReminderMessageGenerator } from './message-generator.js';
import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';

export class ReminderScheduler {
  constructor(storage, client) {
    this.storage = storage;
    this.client = client;
    this.cronJob = null;
    this.scheduledReminders = new Map(); // Map of reminder ID -> timeout
    this.timezone = config.scheduler.timezone;
    this.checkHour = config.scheduler.reminders.checkHour;
    this.sendHour = config.scheduler.reminders.sendHour;
    this.sendMinute = config.scheduler.reminders.sendMinute;
  }

  async start() {
    logger.info('ReminderScheduler', 'Starting reminder scheduler');

    const cronExpression = `0 ${this.checkHour} * * *`;
    this.cronJob = cron.schedule(
      cronExpression,
      async () => {
        try {
          logger.info('ReminderScheduler', 'Running daily check');
          await this.checkTodaysReminders();
        } catch (error) {
          logger.errorWithStack('ReminderScheduler', 'Error in daily check', error);
        }
      },
      { timezone: this.timezone }
    );

    await this.checkTodaysReminders();

    logger.info('ReminderScheduler', 'Reminder scheduler started successfully');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
    }
    // Clear all scheduled reminders
    for (const timeout of this.scheduledReminders.values()) {
      clearTimeout(timeout);
    }
    this.scheduledReminders.clear();
  }

  async checkTodaysReminders() {
    const today = this.getTodayDateString();
    const todaysReminders = this.storage.getByDate(today);

    logger.info('ReminderScheduler', 'Found reminders for today', {
      count: todaysReminders.length,
      date: today
    });

    for (const reminder of todaysReminders) {
      await this.scheduleReminder(reminder);
    }
  }

  async scheduleReminder(reminder) {
    // Check if already scheduled
    if (this.scheduledReminders.has(reminder.id)) {
      logger.debug('ReminderScheduler', 'Reminder already scheduled', { reminderId: reminder.id });
      return;
    }

    const now = DateTime.now().setZone(this.timezone);
    let sendTime = DateTime.fromISO(`${reminder.date}T${this.pad(this.sendHour)}:${this.pad(this.sendMinute)}:00`, {
      zone: this.timezone
    });

    if (now > sendTime) {
      // Already past send time – send immediately
      sendTime = now;
    }

    const delay = Math.max(0, Math.round(sendTime.diff(now).as('milliseconds')));

    await this.storage.markScheduled(reminder.id, sendTime.toISO());

    logger.info('ReminderScheduler', 'Scheduling reminder', {
      reminderId: reminder.id,
      sendTime: sendTime.toFormat('HH:mm'),
      timezone: this.timezone,
      delaySeconds: Math.round(delay / 1000)
    });

    const timeout = setTimeout(async () => {
      await this.sendReminder(reminder);
      this.scheduledReminders.delete(reminder.id);
    }, delay);

    this.scheduledReminders.set(reminder.id, timeout);
  }

  async sendReminder(reminder) {
    try {
      logger.info('ReminderScheduler', 'Sending reminder', {
        reminderId: reminder.id,
        chatId: reminder.chatId
      });

      // Generate nice message using GPT
      const message = await ReminderMessageGenerator.generate(
        reminder.text,
        reminder.language || 'en'
      );

      // Send to chat
      await this.client.sendMessage(reminder.chatId, message);

      logger.info('ReminderScheduler', 'Reminder sent successfully', { reminderId: reminder.id });

      // Remove from storage
      await this.storage.remove(reminder.id);
    } catch (error) {
      logger.error('ReminderScheduler', 'Error sending reminder', {
        reminderId: reminder.id,
        error: error.message
      });
    }
  }

  // Manually cancel a scheduled reminder
  cancelScheduledReminder(id) {
    const timeout = this.scheduledReminders.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledReminders.delete(id);
      return true;
    }
    return false;
  }

  getTodayDateString() {
    return DateTime.now().setZone(this.timezone).toISODate();
  }

  pad(value) {
    return value.toString().padStart(2, '0');
  }
}
