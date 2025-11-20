import { config } from '../../config.js';
import { AuthMiddleware } from '../../middleware/auth.js';
import { ProfileMovieManager } from './profile-movie-manager.js';

export class ProfileCinemaPlugin {
  constructor() {
    this.name = 'Profile Cinema';
    this.description = 'Rotates the profile picture through frames of a movie file';
    this.commands = [
      {
        command: 'cinema-progress',
        description: 'Show current movie frame progress'
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
    return this.enabled;
  }

  async onMessage(message) {
    if (!this.enabled || !this.manager) {
      return;
    }
    await this.manager.handleIncomingMessage(message);
  }

  async onCommand(command, args, message) {
    if (command !== 'cinema-progress') {
      return false;
    }

    if (!AuthMiddleware.isAuthorized(message)) {
      await AuthMiddleware.sendUnauthorizedMessage(message);
      return true;
    }

    if (!this.enabled || !this.manager) {
      await message.reply('❌ Profile Cinema is currently disabled.');
      return true;
    }

    const status = this.manager.getStatus();
    if (!status) {
      await message.reply('⏳ Profile Cinema is still preparing keyframes...');
      return true;
    }

    const text = this.buildProgressText(status);
    await message.reply(text);
    return true;
  }

  buildProgressText(status) {
    const percentage = status.totalKeyframes > 1
      ? Math.round((status.currentFrame / (status.totalKeyframes - 1)) * 100)
      : 100;

    const timestamp = typeof status.lastTimestampSeconds === 'number'
      ? this.formatTimestamp(status.lastTimestampSeconds)
      : 'Not yet started';

    return [
      '🎬 *Profile Cinema*',
      '',
      `Frame: ${status.currentFrame + 1}/${status.totalKeyframes} (${percentage}%)`,
      `Messages processed: ${status.totalMessages}`,
      `Interval: every ${status.messageInterval} message(s)`,
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
