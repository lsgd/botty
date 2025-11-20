import fs from 'fs/promises';
import path from 'path';

export class ReminderStorage {
  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'reminders.json');
    this.reminders = [];
  }

  async load() {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      this.reminders = JSON.parse(data);
      console.log(`[ReminderStorage] Loaded ${this.reminders.length} reminders`);
      return this.reminders;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[ReminderStorage] No reminders file found, starting fresh');
        this.reminders = [];
        await this.save();
        return this.reminders;
      }
      throw error;
    }
  }

  async save() {
    await fs.writeFile(this.filePath, JSON.stringify(this.reminders, null, 2), 'utf-8');
  }

  async add(reminder) {
    // Generate unique ID
    const id = Date.now().toString();
    const newReminder = {
      id,
      scheduledFor: null,
      ...reminder,
      createdAt: new Date().toISOString()
    };
    this.reminders.push(newReminder);
    await this.save();
    return newReminder;
  }

  async markScheduled(id, scheduledFor) {
    const reminder = this.reminders.find(r => r.id === id);
    if (!reminder) {
      return null;
    }
    reminder.scheduledFor = scheduledFor;
    await this.save();
    return reminder;
  }

  async remove(id) {
    const index = this.reminders.findIndex(r => r.id === id);
    if (index === -1) return false;

    this.reminders.splice(index, 1);
    await this.save();
    return true;
  }

  getAll() {
    return this.reminders;
  }

  getByDate(date) {
    // date in format yyyy-mm-dd
    return this.reminders.filter(r => r.date === date);
  }

  getByChatId(chatId) {
    return this.reminders.filter(r => r.chatId === chatId);
  }
}
