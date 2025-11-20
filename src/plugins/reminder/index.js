import { DateTime } from 'luxon';
import { ReminderStorage } from './reminder-storage.js';
import { ReminderScheduler } from './reminder-scheduler.js';
import { i18n } from '../../utils/i18n.js';
import { config } from '../../config.js';

export class ReminderPlugin {
  constructor() {
    this.name = 'Reminders';
    this.description = i18n.currentLanguage === 'de'
      ? 'Setze Erinnerungen für bestimmte Tage'
      : 'Set reminders for specific dates';

    this.commands = [
      {
        command: 'remind',
        description: i18n.currentLanguage === 'de'
          ? 'Erstelle eine Erinnerung (Format: !remind yyyy-mm-dd <text>)'
          : 'Create a reminder (Format: !remind yyyy-mm-dd <text>)'
      },
      {
        command: 'reminders',
        description: i18n.currentLanguage === 'de'
          ? 'Zeige alle Erinnerungen'
          : 'Show all reminders'
      },
      {
        command: 'reminders-cancel',
        description: i18n.currentLanguage === 'de'
          ? 'Lösche eine Erinnerung (Format: !reminders-cancel <number>)'
          : 'Cancel a reminder (Format: !reminders-cancel <number>)'
      }
    ];

    this.storage = new ReminderStorage();
    this.scheduler = null;
  }

  async initialize(client) {
    console.log('[ReminderPlugin] Initializing...');

    await this.storage.load();

    this.scheduler = new ReminderScheduler(this.storage, client);
    this.scheduler.start();

    console.log('[ReminderPlugin] ✅ Reminder plugin initialized');
  }

  shouldHandle(message) {
    return false; // No automatic message handling
  }

  async onMessage(message) {
    // Not used
  }

  async onCommand(command, args, message) {
    if (command === 'remind') {
      await this.handleRemind(args, message);
      return true;
    }

    if (command === 'reminders') {
      await this.handleListReminders(args, message);
      return true;
    }

    if (command === 'reminders-cancel') {
      await this.handleCancelReminder(args, message);
      return true;
    }

    return false;
  }

  async handleRemind(args, message) {
    // Expected format: !remind yyyy-mm-dd <text>
    if (args.length < 2) {
      const helpText = i18n.currentLanguage === 'de'
        ? '❌ Format: !remind yyyy-mm-dd <Erinnerungstext>\n\nBeispiel: !remind 2025-12-24 Geschenke kaufen'
        : '❌ Format: !remind yyyy-mm-dd <reminder text>\n\nExample: !remind 2025-12-24 Buy gifts';

      await message.reply(helpText);
      return;
    }

    const dateStr = args[0];
    const text = args.slice(1).join(' ');

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      const errorText = i18n.currentLanguage === 'de'
        ? '❌ Ungültiges Datumsformat. Verwende yyyy-mm-dd (z.B. 2025-12-24)'
        : '❌ Invalid date format. Use yyyy-mm-dd (e.g. 2025-12-24)';

      await message.reply(errorText);
      return;
    }

    // Validate date is valid
    const date = DateTime.fromISO(dateStr, { zone: config.scheduler.timezone });
    if (!date.isValid) {
      const errorText = i18n.currentLanguage === 'de'
        ? '❌ Ungültiges Datum'
        : '❌ Invalid date';

      await message.reply(errorText);
      return;
    }

    // Check date is not in the past
    const today = DateTime.now().setZone(config.scheduler.timezone).startOf('day');
    if (date.startOf('day') < today) {
      const errorText = i18n.currentLanguage === 'de'
        ? '❌ Das Datum liegt in der Vergangenheit'
        : '❌ Date is in the past';

      await message.reply(errorText);
      return;
    }

    // Get chat ID
    const chat = await message.getChat();
    const chatId = chat.id._serialized;

    // Create reminder
    const reminder = await this.storage.add({
      date: dateStr,
      text: text,
      chatId: chatId,
      language: i18n.currentLanguage
    });

    // If it's for today, schedule it immediately (respect scheduler timezone)
    const todayStr = DateTime.now().setZone(config.scheduler.timezone).toISODate();
    if (dateStr === todayStr) {
      await this.scheduler.scheduleReminder(reminder);
    }

    const successText = i18n.currentLanguage === 'de'
      ? `✅ Erinnerung erstellt für ${dateStr}:\n"${text}"\n\nWird gesendet um 7:07 Uhr`
      : `✅ Reminder created for ${dateStr}:\n"${text}"\n\nWill be sent at 7:07 AM`;

    await message.reply(successText);
  }

  async handleListReminders(args, message) {
    const chat = await message.getChat();
    const chatId = chat.id._serialized;

    const reminders = this.storage.getByChatId(chatId);

    if (reminders.length === 0) {
      const emptyText = i18n.currentLanguage === 'de'
        ? '📅 Keine Erinnerungen in diesem Chat'
        : '📅 No reminders in this chat';

      await message.reply(emptyText);
      return;
    }

    // Sort by date
    reminders.sort((a, b) => a.date.localeCompare(b.date));

    let responseText = i18n.currentLanguage === 'de'
      ? `📅 *Erinnerungen* (${reminders.length})\n\n`
      : `📅 *Reminders* (${reminders.length})\n\n`;

    reminders.forEach((reminder, index) => {
      responseText += `${index + 1}. ${reminder.date} - ${reminder.text}\n`;
    });

    responseText += i18n.currentLanguage === 'de'
      ? '\n💡 Lösche mit: !reminders-cancel <Nummer>'
      : '\n💡 Cancel with: !reminders-cancel <number>';

    await message.reply(responseText);
  }

  async handleCancelReminder(args, message) {
    if (args.length === 0) {
      const helpText = i18n.currentLanguage === 'de'
        ? '❌ Format: !reminders-cancel <Nummer>\n\nVerwende !reminders um die Nummern zu sehen'
        : '❌ Format: !reminders-cancel <number>\n\nUse !reminders to see the numbers';

      await message.reply(helpText);
      return;
    }

    const chat = await message.getChat();
    const chatId = chat.id._serialized;

    const reminders = this.storage.getByChatId(chatId);
    reminders.sort((a, b) => a.date.localeCompare(b.date));

    const index = parseInt(args[0]) - 1;
    if (isNaN(index) || index < 0 || index >= reminders.length) {
      const errorText = i18n.currentLanguage === 'de'
        ? '❌ Ungültige Nummer'
        : '❌ Invalid number';

      await message.reply(errorText);
      return;
    }

    const reminder = reminders[index];

    // Cancel scheduled reminder if exists
    this.scheduler.cancelScheduledReminder(reminder.id);

    // Remove from storage
    await this.storage.remove(reminder.id);

    const successText = i18n.currentLanguage === 'de'
      ? `✅ Erinnerung gelöscht:\n${reminder.date} - ${reminder.text}`
      : `✅ Reminder cancelled:\n${reminder.date} - ${reminder.text}`;

    await message.reply(successText);
  }
}
