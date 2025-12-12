import fs from 'fs-extra';
import { config } from '../config.js';

class Storage {
  constructor() {
    this.configPath = config.storage.configPath;
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        return fs.readJsonSync(this.configPath);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }

    // Default configuration
    return {
      transcription: {
        globalEnabled: true,
        globalEnabled: true,
        chatSettings: {}
      },
      plugins: {}
    };
  }

  save() {
    try {
      fs.ensureFileSync(this.configPath);
      fs.writeJsonSync(this.configPath, this.data, { spaces: 2 });
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  // Transcription settings
  isTranscriptionEnabled(chatId) {
    // Check chat-specific setting first
    if (chatId in this.data.transcription.chatSettings) {
      return this.data.transcription.chatSettings[chatId].enabled;
    }
    // Fall back to global setting
    return this.data.transcription.globalEnabled;
  }

  setTranscriptionForChat(chatId, enabled) {
    if (!this.data.transcription.chatSettings[chatId]) {
      this.data.transcription.chatSettings[chatId] = {};
    }
    this.data.transcription.chatSettings[chatId].enabled = enabled;
    this.save();
  }

  setGlobalTranscription(enabled) {
    this.data.transcription.globalEnabled = enabled;
    this.save();
  }

  getGlobalTranscription() {
    return this.data.transcription.globalEnabled;
  }

  getChatTranscription(chatId) {
    return this.data.transcription.chatSettings[chatId]?.enabled;
  }

  // Plugin state management
  isPluginEnabled(pluginName) {
    if (this.data.plugins && pluginName in this.data.plugins) {
      return this.data.plugins[pluginName];
    }
    return true; // Default to enabled
  }

  setPluginEnabled(pluginName, enabled) {
    if (!this.data.plugins) {
      this.data.plugins = {};
    }
    this.data.plugins[pluginName] = enabled;
    this.save();
  }

  // Admin chat settings
  getAdminChatId() {
    const adminChatId = this.data.adminChatId || null;
    console.log(`[Storage] getAdminChatId called, returning: ${adminChatId}`);
    return adminChatId;
  }

  setAdminChatId(chatId) {
    console.log(`[Storage] setAdminChatId called with: ${chatId}`);
    this.data.adminChatId = chatId;
    this.save();
    console.log(`[Storage] Admin chat ID saved, current data.adminChatId: ${this.data.adminChatId}`);
  }

  clearAdminChatId() {
    console.log('[Storage] clearAdminChatId called');
    delete this.data.adminChatId;
    this.save();
  }
}

export const storage = new Storage();
