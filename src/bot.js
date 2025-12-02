import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { config } from './config.js';
import { storage } from './utils/storage.js';
import { i18n } from './utils/i18n.js';
import { pluginManager } from './plugins/plugin-manager.js';
import { CommandHandler } from './commands/command-handler.js';
import { TranscriptionPlugin } from './plugins/transcription/index.js';
import { messageTracker } from './plugins/transcription/message-tracker.js';
import { BirthdayPlugin } from './plugins/birthday/index.js';
import { ReminderPlugin } from './plugins/reminder/index.js';
import { ProfileCinemaPlugin } from './plugins/profile-cinema/index.js';

export class WhatsAppBot {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.transcriptionPlugin = null;
    this.birthdayPlugin = null;
    this.reminderPlugin = null;
    this.profileCinemaPlugin = null;
  }

  async initialize() {
    console.log('🚀 Initializing WhatsApp Bot...');

    // Set language from config
    i18n.setLanguage(config.language);
    console.log(`Language set to: ${config.language}`);

    // Create WhatsApp client with authentication
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: config.whatsapp.authPath
      }),
      puppeteer: {
        headless: true,
        args: config.whatsapp.puppeteerArgs
      }
    });

    // Register event handlers
    this.registerEventHandlers();

    // Register plugins
    this.registerPlugins();

    // Initialize client
    await this.client.initialize();
  }

  registerEventHandlers() {
    // QR Code generation
    this.client.on('qr', (qr) => {
      console.log('\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      console.log('\nWaiting for authentication...\n');
    });

    // Authentication success
    this.client.on('authenticated', () => {
      console.log(i18n.t('authenticated'));
    });

    // Ready
    this.client.on('ready', async () => {
      console.log(i18n.t('botReady'));
      this.isReady = true;
      this.logBotInfo();

      // Initialize transcription plugin (needs client to be ready)
      if (this.transcriptionPlugin) {
        await this.transcriptionPlugin.initialize(this.client);
      }

      // Initialize birthday plugin (needs client to be ready)
      if (this.birthdayPlugin) {
        await this.birthdayPlugin.initialize(this.client);
      }

      // Initialize reminder plugin (needs client to be ready)
      if (this.reminderPlugin) {
        await this.reminderPlugin.initialize(this.client);
      }

      if (this.profileCinemaPlugin) {
        await this.profileCinemaPlugin.initialize(this.client);
      }
    });

    // Message received
    this.client.on('message', async (message) => {
      await this.handleMessage(message);
    });

    // Message created (sent by bot/user)
    this.client.on('message_create', async (message) => {
      // Also handle sent voice messages for transcription
      if (message.fromMe) {
        await this.handleMessage(message);
      }
    });

    // Disconnected
    this.client.on('disconnected', (reason) => {
      console.log('❌ WhatsApp Bot disconnected:', reason);
      this.isReady = false;
    });

    // Authentication failure
    this.client.on('auth_failure', (msg) => {
      console.error('❌ Authentication failed:', msg);
      process.exit(1);
    });
  }

  registerPlugins() {
    console.log('📦 Registering plugins...');

    // Register transcription plugin
    this.transcriptionPlugin = new TranscriptionPlugin();
    pluginManager.register(this.transcriptionPlugin);

    // Register birthday plugin (will be initialized when client is ready)
    this.birthdayPlugin = new BirthdayPlugin();
    pluginManager.register(this.birthdayPlugin);

    // Register reminder plugin (will be initialized when client is ready)
    this.reminderPlugin = new ReminderPlugin();
    pluginManager.register(this.reminderPlugin);

    // Register profile cinema plugin
    this.profileCinemaPlugin = new ProfileCinemaPlugin();
    pluginManager.register(this.profileCinemaPlugin);

    console.log('✅ Plugins registered successfully');
  }

  async handleMessage(message) {
    try {
      // Skip status messages
      if (message.isStatus) {
        return;
      }

      // Log message
      const from = message.from;
      const body = message.body;
      const type = message.type;
      console.log(`📨 Message from ${from} [${type}]: ${body || '(media)'}`);

      // Check if it's a command
      const isCommand = await CommandHandler.handle(message);

      if (isCommand) {
        return;
      }

      // Delegate to plugins for automatic handling
      await pluginManager.handleMessage(message);
    } catch (error) {
      console.error('❌ Error handling message:', error);
    }
  }

  logBotInfo() {
    console.log('\n' + '='.repeat(50));
    console.log('🤖 WhatsApp Transcription Bot');
    console.log('='.repeat(50));
    console.log(`Model: ${config.openai.model}`);
    console.log(`Authorized Numbers: ${config.auth.authorizedNumbers.join(', ') || 'None (warning!)'}`);
    console.log(`Global Transcription: ${storage.getGlobalTranscription() ? 'Enabled' : 'Disabled'}`);
    console.log('='.repeat(50) + '\n');
  }

  async destroy() {
    // Cleanup birthday plugin
    if (this.birthdayPlugin) {
      this.birthdayPlugin.destroy();
    }

    // Cleanup reminder plugin
    if (this.reminderPlugin && this.reminderPlugin.scheduler) {
      this.reminderPlugin.scheduler.stop();
    }

    if (this.profileCinemaPlugin) {
      await this.profileCinemaPlugin.destroy();
    }

    // Cleanup message tracker
    messageTracker.destroy();

    if (this.client) {
      await this.client.destroy();
      console.log('Bot destroyed');
    }
  }
}
