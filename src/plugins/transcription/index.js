import path from 'path';
import fs from 'fs-extra';
import { storage } from '../../utils/storage.js';
import { messageTracker } from './message-tracker.js';
import { config } from '../../config.js';
import { i18n } from '../../utils/i18n.js';

export class TranscriptionPlugin {
  constructor() {
    this.name = i18n.t('transcriptionPluginName');
    this.description = i18n.t('transcriptionPluginDesc');
    this.commands = [
      {
        command: i18n.t('cmdTranscribe'),
        description: i18n.t('cmdTranscribeDesc')
      },
      {
        command: i18n.t('cmdTranscription'),
        description: i18n.t('cmdTranscriptionDesc')
      }
    ];

    // Ensure temp directory exists
    fs.ensureDirSync(config.storage.tempAudioPath);
  }

  shouldHandle(message) {
    // Handle voice messages automatically
    return message.hasMedia && message.type === 'ptt'; // ptt = push-to-talk (voice message)
  }

  async onMessage(message) {
    // Check if auto-transcription is enabled for this chat
    const chatId = message.from;
    const isEnabled = storage.isTranscriptionEnabled(chatId);

    if (!isEnabled) {
      console.log(`[TranscriptionPlugin] Auto-transcription disabled for chat ${chatId}`);
      return;
    }

    // Transcribe the voice message
    await this.transcribeMessage(message);
  }

  async onCommand(command, args, message) {
    if (command === 't') {
      await this.handleManualTranscription(message);
    } else if (command === 'transcription') {
      await this.handleTranscriptionSettings(args, message);
    }
  }

  async handleManualTranscription(message) {
    // Check if message has a quoted message
    if (!message.hasQuotedMsg) {
      await message.reply(i18n.t('quoteVoiceMessage'));
      return;
    }

    try {
      const quotedMsg = await message.getQuotedMessage();

      // Check if quoted message is a voice message
      if (!quotedMsg.hasMedia || quotedMsg.type !== 'ptt') {
        await message.reply(i18n.t('notVoiceMessage'));
        return;
      }

      // Transcribe the quoted message
      await this.transcribeMessage(quotedMsg);
    } catch (error) {
      console.error('[TranscriptionPlugin] Error handling manual transcription:', error);
      await message.reply(i18n.t('transcribeFailed'));
    }
  }

  async handleTranscriptionSettings(args, message) {
    const chatId = message.from;

    if (args.length === 0) {
      // Show current settings
      const globalEnabled = storage.getGlobalTranscription();
      const chatSpecific = storage.getChatTranscription(chatId);
      const currentStatus = storage.isTranscriptionEnabled(chatId);

      let statusText = i18n.t('settingsTitle');
      statusText += i18n.t('settingsGlobal', globalEnabled);
      statusText += i18n.t('settingsChat', chatSpecific);
      statusText += i18n.t('settingsCurrent', currentStatus);
      statusText += i18n.t('settingsUsage');

      await message.reply(statusText);
      return;
    }

    const subCommand = args[0].toLowerCase();

    if (subCommand === 'global') {
      if (args.length < 2) {
        await message.reply(i18n.t('settingsUsageError'));
        return;
      }

      const setting = args[1].toLowerCase();
      if (setting === 'on') {
        storage.setGlobalTranscription(true);
        await message.reply(i18n.t('globalEnabled'));
      } else if (setting === 'off') {
        storage.setGlobalTranscription(false);
        await message.reply(i18n.t('globalDisabled'));
      } else {
        await message.reply(i18n.t('settingsUsageError'));
      }
    } else if (subCommand === 'on') {
      storage.setTranscriptionForChat(chatId, true);
      await message.reply(i18n.t('chatEnabled'));
    } else if (subCommand === 'off') {
      storage.setTranscriptionForChat(chatId, false);
      await message.reply(i18n.t('chatDisabled'));
    } else {
      await message.reply(i18n.t('settingsInvalidOption'));
    }
  }

  async transcribeMessage(message) {
    try {
      console.log(`[TranscriptionPlugin] Processing voice message ${message.id._serialized}`);

      // Download the audio file
      const media = await message.downloadMedia();

      if (!media) {
        console.error('[TranscriptionPlugin] Failed to download media');
        await message.reply(i18n.t('downloadFailed'));
        return;
      }

      // Save to temporary file
      const tempFileName = `audio_${message.id._serialized.replace(/[^a-zA-Z0-9]/g, '_')}.ogg`;
      const tempFilePath = path.join(config.storage.tempAudioPath, tempFileName);

      // Write the audio file
      await fs.writeFile(tempFilePath, media.data, { encoding: 'base64' });

      console.log(`[TranscriptionPlugin] Saved audio to ${tempFilePath}`);

       // Use message tracker to handle transcription (handles race conditions)
       await messageTracker.transcribe(message.id._serialized, message, tempFilePath, this.client);
    } catch (error) {
      console.error('[TranscriptionPlugin] Error transcribing message:', error);
      await message.reply(i18n.t('transcribeFailed'));
    }
  }

  async initialize(client) {
    this.client = client;
    console.log('[TranscriptionPlugin] Setting up revoke event listener');
    client.on('message_revoke_everyone', async (message) => {
      console.log('[TranscriptionPlugin] Revoke event triggered');
      await messageTracker.handleRevoke(message, client);
    });
  }
}
