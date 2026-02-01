import { config } from '../../config.js';
import { AuthMiddleware } from '../../middleware/auth.js';
import { storage } from '../../utils/storage.js';
import { ProfileMovieManager } from './profile-movie-manager.js';
import { responseHelper } from '../../utils/response-helper.js';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

export class ProfileCinemaPlugin {
  constructor() {
    this.name = 'Profile Cinema';
    this.description = 'Rotates the profile picture through frames of a movie file';
    this.commands = [
      {
        command: 'cinema-progress',
        description: 'Show current movie frame progress'
      },
      {
        command: 'cinema-seek',
        description: 'Set the current frame timestamp (e.g., !cinema-seek 120 or !cinema-seek 00:02:00)'
      },
      {
        command: 'cinema-frame',
        description: 'Get the current frame as an image'
      }
    ];
    this.manager = null;
    this.enabled = false;
  }

  async initialize(client) {
    if (!config.profileMovie.enabled) {
      console.log('[ProfileCinema] Disabled (no PROFILE_MOVIE_PATH provided)');
      return;
    }

    this.manager = new ProfileMovieManager(client, config.profileMovie);
    try {
      await this.manager.initialize();
      this.enabled = true;
      console.log('[ProfileCinema] ✅ Ready');
    } catch (error) {
      console.error('[ProfileCinema] Failed to start:', error.message);
    }
  }

  shouldHandle() {
    return this.isEnabled;
  }

  get isEnabled() {
    return this.enabled && storage.isPluginEnabled(this.name);
  }

  async onMessage(message) {
    if (!this.isEnabled || !this.manager) {
      return;
    }
    await this.manager.handleIncomingMessage(message);
  }

  async onCommand(command, args, message) {
    if (!AuthMiddleware.isAuthorized(message)) {
      await AuthMiddleware.sendUnauthorizedMessage(message);
      return true;
    }

    if (!this.isEnabled || !this.manager) {
      await responseHelper.reply(message, '❌ Profile Cinema is currently disabled.');
      return true;
    }

    if (command === 'cinema-progress') {
      return await this.handleProgress(message);
    }

    if (command === 'cinema-seek') {
      return await this.handleSeek(args, message);
    }

    if (command === 'cinema-frame') {
      return await this.handleFrame(message);
    }

    return false;
  }

  async handleProgress(message) {
    const status = this.manager.getStatus();
    const text = this.buildProgressText(status);
    await responseHelper.reply(message, text);
    return true;
  }

  async handleSeek(args, message) {
    if (args.length === 0) {
      await responseHelper.reply(message, [
        '❌ *Usage:* `!cinema-seek <timestamp>`',
        '',
        'Examples:',
        '  `!cinema-seek 120` → Seek to second 120',
        '  `!cinema-seek 00:02:00` → Seek to 2 minutes'
      ].join('\n'));
      return true;
    }

    const input = args[0];
    let targetSeconds = this.parseTimestamp(input);

    if (targetSeconds === null || isNaN(targetSeconds) || targetSeconds < 0) {
      await responseHelper.reply(message, '❌ Invalid timestamp. Use seconds (e.g., 120) or HH:MM:SS format.');
      return true;
    }

    const duration = this.manager.duration;
    if (targetSeconds > duration) {
      targetSeconds = duration;
    }

    // Update the state
    await this.manager.seekTo(targetSeconds);

    const formattedTime = this.formatTimestamp(targetSeconds);
    await responseHelper.reply(message, `✅ Seeked to ${formattedTime} (${targetSeconds}s / ${duration}s)`);
    return true;
  }

  async handleFrame(message) {
    try {
      const currentTime = this.manager.stateStore.state.currentTimeSeconds;
      const frameData = await this.manager.frameExtractor.extract(currentTime);

      const media = MessageMedia.fromFilePath(frameData.filePath);
      if (!media.mimetype) {
        media.mimetype = 'image/jpeg';
      }

      const formattedTime = this.formatTimestamp(currentTime);
      const caption = `🎬 Frame at ${formattedTime}`;

      // Send to the original chat (not redirected)
      await message.reply(media, null, { caption });

      // Cleanup
      await this.manager.frameExtractor.cleanup(frameData.filePath);
      return true;
    } catch (error) {
      console.error('[ProfileCinema] Error getting frame:', error);
      await responseHelper.reply(message, '❌ Failed to extract current frame.');
      return true;
    }
  }

  parseTimestamp(input) {
    // Try HH:MM:SS or MM:SS format
    if (input.includes(':')) {
      const parts = input.split(':').map(p => parseInt(p, 10));
      if (parts.some(isNaN)) return null;

      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
      return null;
    }

    // Try plain seconds
    return parseFloat(input);
  }

  buildProgressText(status) {
    const percentage = status.duration > 1
      ? Math.round((status.currentTimeSeconds / status.duration) * 100)
      : 100;

    const timestamp = status.currentTimeSeconds > 0
      ? this.formatTimestamp(status.currentTimeSeconds)
      : 'Not yet started';

    return [
      '🎬 *Profile Cinema*',
      '',
      `Timestamp: ${timestamp}`,
      `Messages processed: ${status.totalMessages}`,
      `Update delay: ${status.messageInterval}-${status.messageInterval * 1.5}s (debounce)`,
      `Status: ${status.completed ? 'Completed – holding final frame' : 'In progress'}`,
      `Last timestamp: ${timestamp}`
    ].join('\n');
  }

  formatTimestamp(seconds) {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  }

  async destroy() {
    await this.manager?.destroy();
  }
}
