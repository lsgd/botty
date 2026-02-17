import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { i18n } from '../../utils/i18n.js';
import { BirthdayScheduler } from './birthday-scheduler.js';
import { dailyMessageTracker } from './message-tracker.js';
import { storage } from '../../utils/storage.js';
import { responseHelper } from '../../utils/response-helper.js';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class BirthdayPlugin {
  constructor() {
    this.name = i18n.currentLanguage === 'de' ? 'Geburtstagswünsche' : 'Birthday Wishes';
    this.description = i18n.currentLanguage === 'de'
      ? 'Automatische Geburtstagswünsche basierend auf CSV-Datei'
      : 'Automatic birthday wishes based on CSV file';

    this.commands = [
      {
        command: 'birthdays',
        description: i18n.currentLanguage === 'de'
          ? 'Zeige Liste aller Geburtstage'
          : 'Show list of all birthdays'
      },
      {
        command: 'birthdays-reload',
        description: i18n.currentLanguage === 'de'
          ? 'Lade Geburtstags-CSV neu'
          : 'Reload birthday CSV file'
      },
      {
        command: 'birthdays-test',
        description: i18n.currentLanguage === 'de'
          ? 'Teste Geburtstagsnachricht (Syntax: !birthdays-test <nummer>)'
          : 'Test birthday message (Syntax: !birthdays-test <number>)'
      }
    ];

    this.scheduler = null;
    this.client = null;
  }

  get isEnabled() {
    return storage.isPluginEnabled(this.name);
  }

  /**
   * Initialize the plugin with WhatsApp client
   * @param {Object} client - WhatsApp client
   */
  async initialize(client) {
    this.client = client;

    // Path to birthdays.csv in data directory
    const birthdayFilePath = path.join(__dirname, '../../../data/birthdays.csv');

    // Ensure tracker state is restored before scheduling
    await dailyMessageTracker.initialize(path.join(__dirname, '../../../data/birthday-message-tracker.json'));

    // Initialize scheduler
    this.scheduler = new BirthdayScheduler(client, birthdayFilePath);
    await this.scheduler.start();

    logger.info('BirthdayPlugin', 'Birthday plugin initialized');
  }

  /**
   * Check if this plugin should handle a message
   * @param {Object} message - WhatsApp message
   * @returns {boolean}
   */
  shouldHandle(message) {
    if (!this.isEnabled) return false;
    // Track messages from authorized users
    // message.author is the actual sender in group chats
    // message.from is the chat ID
    const senderId = message.author || message.from;
    dailyMessageTracker.recordMessage(message.from, senderId);
    return false; // Don't actively handle messages
  }

  /**
   * Handle message (not used, but required by plugin interface)
   * @param {Object} message - WhatsApp message
   */
  async onMessage(message) {
    // Not used - we only track messages via shouldHandle
  }

  /**
   * Handle commands
   * @param {string} command - Command name
   * @param {Array} args - Command arguments
   * @param {Object} message - WhatsApp message
   */
  async onCommand(command, args, message) {
    if (!this.isEnabled) return;

    if (command === 'birthdays') {
      await this.handleStatusCommand(message);
    } else if (command === 'birthdays-reload') {
      await this.handleReloadCommand(message);
    } else if (command === 'birthdays-test') {
      await this.handleTestCommand(args, message);
    }
  }

  /**
   * Handle !birthdays command - show numbered list of all birthdays
   * @param {Object} message - WhatsApp message
   */
  async handleStatusCommand(message) {
    try {
      const birthdays = this.scheduler.getBirthdays();
      const status = this.scheduler.getStatus();

      let statusText = i18n.currentLanguage === 'de'
        ? '🎂 *Geburtstage*\n\n'
        : '🎂 *Birthdays*\n\n';

      statusText += i18n.currentLanguage === 'de'
        ? `Gesamt: ${birthdays.length}\n`
        : `Total: ${birthdays.length}\n`;

      statusText += i18n.currentLanguage === 'de'
        ? `Heute: ${status.todaysBirthdays}\n`
        : `Today: ${status.todaysBirthdays}\n`;

      statusText += i18n.currentLanguage === 'de'
        ? `Geplante Nachrichten: ${status.scheduledTasks}\n\n`
        : `Scheduled messages: ${status.scheduledTasks}\n\n`;

      if (birthdays.length === 0) {
        statusText += i18n.currentLanguage === 'de'
          ? 'Keine Geburtstage geladen.'
          : 'No birthdays loaded.';
      } else {
        statusText += i18n.currentLanguage === 'de'
          ? '*Liste aller Geburtstage:*\n'
          : '*All Birthdays:*\n';

        birthdays.forEach((birthday, index) => {
          const number = index + 1;
          const date = birthday.birthDate; // YYYY-MM-DD
          const [year, month, day] = date.split('-');
          const name = `${birthday.firstName} ${birthday.lastName}`;
          const formality = birthday.formality === 'formal'
            ? (i18n.currentLanguage === 'de' ? 'formell' : 'formal')
            : (i18n.currentLanguage === 'de' ? 'informell' : 'informal');

          statusText += `${number}. ${name} - ${day}.${month}. (${formality})\n`;
        });

        statusText += '\n';
        statusText += i18n.currentLanguage === 'de'
          ? '💡 Teste eine Nachricht mit: !birthdays-test <nummer>'
          : '💡 Test a message with: !birthdays-test <number>';
      }

      await responseHelper.reply(message, statusText);
    } catch (error) {
      logger.errorWithStack('BirthdayPlugin', 'Error in status command', error);
      await responseHelper.reply(message,
        i18n.currentLanguage === 'de'
          ? '❌ Fehler beim Abrufen der Geburtstage'
          : '❌ Error getting birthdays'
      );
    }
  }

  /**
   * Handle !birthdays-reload command
   * @param {Object} message - WhatsApp message
   */
  async handleReloadCommand(message) {
    try {
      await responseHelper.reply(message,
        i18n.currentLanguage === 'de'
          ? '🔄 Lade Geburtstags-CSV neu...'
          : '🔄 Reloading birthday CSV...'
      );

      await this.scheduler.loadBirthdays();
      await this.scheduler.checkBirthdays();

      const status = this.scheduler.getStatus();

      await responseHelper.reply(message,
        i18n.currentLanguage === 'de'
          ? `✅ CSV neu geladen!\n\nGeburtstage: ${status.totalBirthdays}\nHeute: ${status.todaysBirthdays}`
          : `✅ CSV reloaded!\n\nBirthdays: ${status.totalBirthdays}\nToday: ${status.todaysBirthdays}`
      );
    } catch (error) {
      logger.errorWithStack('BirthdayPlugin', 'Error in reload command', error);
      await responseHelper.reply(message,
        i18n.currentLanguage === 'de'
          ? '❌ Fehler beim Neuladen der CSV'
          : '❌ Error reloading CSV'
      );
    }
  }

  /**
   * Handle !birthdays-test command - generate and show test message
   * @param {Array} args - Command arguments
   * @param {Object} message - WhatsApp message
   */
  async handleTestCommand(args, message) {
    try {
      if (args.length === 0) {
        await responseHelper.reply(message,
          i18n.currentLanguage === 'de'
            ? '❌ Verwendung: !birthdays-test <nummer>\n\nVerwende !birthdays um die Liste mit Nummern zu sehen.'
            : '❌ Usage: !birthdays-test <number>\n\nUse !birthdays to see the numbered list.'
        );
        return;
      }

      const number = parseInt(args[0], 10);
      if (isNaN(number) || number < 1) {
        await responseHelper.reply(message,
          i18n.currentLanguage === 'de'
            ? '❌ Ungültige Nummer. Verwende eine positive Zahl.'
            : '❌ Invalid number. Use a positive number.'
        );
        return;
      }

      const birthdays = this.scheduler.getBirthdays();
      const index = number - 1;

      if (index >= birthdays.length) {
        await responseHelper.reply(message,
          i18n.currentLanguage === 'de'
            ? `❌ Nummer ${number} nicht gefunden. Es gibt nur ${birthdays.length} Geburtstage.`
            : `❌ Number ${number} not found. There are only ${birthdays.length} birthdays.`
        );
        return;
      }

      const birthday = birthdays[index];

      // Calculate age for today
      const [birthYear] = birthday.birthDate.split('-').map(Number);
      const age = new Date().getFullYear() - birthYear;
      const birthdayWithAge = { ...birthday, age };

      await responseHelper.reply(message,
        i18n.currentLanguage === 'de'
          ? `🧪 *Test für:* ${birthday.firstName} ${birthday.lastName}\n\nGeneriere Nachricht...`
          : `🧪 *Testing for:* ${birthday.firstName} ${birthday.lastName}\n\nGenerating message...`
      );

      // Import message generator
      const { BirthdayMessageGenerator } = await import('./message-generator.js');

      // Generate the birthday message
      const testMessage = await BirthdayMessageGenerator.generate(birthdayWithAge);

      // Reply with the generated message as a quoted preview
      let responseText = i18n.currentLanguage === 'de'
        ? '✅ *Generierte Nachricht:*\n\n'
        : '✅ *Generated Message:*\n\n';

      responseText += `> ${testMessage.split('\n').join('\n> ')}`;

      await responseHelper.reply(message, responseText);

      logger.info('BirthdayPlugin', 'Test message generated', {
        firstName: birthday.firstName,
        lastName: birthday.lastName
      });
    } catch (error) {
      logger.errorWithStack('BirthdayPlugin', 'Error in test command', error);
      await responseHelper.reply(message,
        i18n.currentLanguage === 'de'
          ? '❌ Fehler beim Generieren der Testnachricht'
          : '❌ Error generating test message'
      );
    }
  }

  /**
   * Cleanup when plugin is destroyed
   */
  destroy() {
    if (this.scheduler) {
      this.scheduler.stop();
    }
  }
}
