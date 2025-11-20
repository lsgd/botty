import cron from 'node-cron';
import { DateTime } from 'luxon';
import { ReminderMessageGenerator } from './message-generator.js';
import { config } from '../../config.js';

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
    console.log('[ReminderScheduler] Starting reminder scheduler...');

    const cronExpression = `0 ${this.checkHour} * * *`;
    this.cronJob = cron.schedule(
      cronExpression,
      async () => {
        console.log('[ReminderScheduler] Running daily check...');
        await this.checkTodaysReminders();
      },
      { timezone: this.timezone }
    );

    await this.checkTodaysReminders();

    console.log('[ReminderScheduler] ✅ Reminder scheduler started successfully');
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

    console.log(`[ReminderScheduler] Found ${todaysReminders.length} reminders for today (${today})`);

    for (const reminder of todaysReminders) {
      await this.scheduleReminder(reminder);
    }
  }

  async scheduleReminder(reminder) {
    // Check if already scheduled
    if (this.scheduledReminders.has(reminder.id)) {
      console.log(`[ReminderScheduler] Reminder ${reminder.id} already scheduled`);
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

    console.log(
      `[ReminderScheduler] Scheduling reminder ${reminder.id} for ${sendTime.toFormat('HH:mm')} ${this.timezone} (in ${Math.round(delay / 1000)}s)`
    );

    const timeout = setTimeout(async () => {
      await this.sendReminder(reminder);
      this.scheduledReminders.delete(reminder.id);
    }, delay);

    this.scheduledReminders.set(reminder.id, timeout);
  }

  async sendReminder(reminder) {
    try {
      console.log(`[ReminderScheduler] Sending reminder ${reminder.id} to ${reminder.chatId}`);

      // Generate nice message using GPT
      const message = await ReminderMessageGenerator.generate(
        reminder.text,
        reminder.language || 'en'
      );

      // Send to chat
      await this.client.sendMessage(reminder.chatId, message);

      console.log(`[ReminderScheduler] ✅ Reminder ${reminder.id} sent successfully`);

      // Remove from storage
      await this.storage.remove(reminder.id);
    } catch (error) {
      console.error(`[ReminderScheduler] Error sending reminder ${reminder.id}:`, error.message);
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
