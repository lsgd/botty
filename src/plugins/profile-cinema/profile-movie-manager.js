import fs from 'fs/promises';
import pkg from 'whatsapp-web.js';
import { ensureReadableMovie, getMovieDuration, FrameExtractor } from './frame-extractor.js';
import { ProfileMovieState } from './profile-movie-state.js';

const { MessageMedia } = pkg;

export class ProfileMovieManager {
  constructor(client, options) {
    this.client = client;
    this.options = options;
    this.stateStore = new ProfileMovieState(options.progressStorePath);
    this.frameExtractor = new FrameExtractor(options.moviePath, options.maxUploadKilobytes * 1024);
    this.keyframes = [];
    this.ready = false;
    this.updateQueue = Promise.resolve();
    this.updateTimeout = null;
  }

  async initialize() {
    await this.stateStore.load();
    await ensureReadableMovie(this.options.moviePath);

    const stats = await fs.stat(this.options.moviePath);
    const fingerprint = `${stats.size}-${Number(stats.mtimeMs).toFixed(0)}`;
    const reset = this.stateStore.updateFingerprint(fingerprint);
    if (reset) {
      console.log('[ProfileCinema] Movie file changed. Restarting progression.');
    }

    this.duration = await getMovieDuration(this.options.moviePath);
    if (this.duration === 0) {
      throw new Error('ProfileCinema: No duration found in movie');
    }

    if (this.stateStore.isComplete(this.duration)) {
      console.log('[ProfileCinema] Movie already finished. Sticking to last frame.');
    }

    await this.stateStore.save();
    this.ready = true;
  }

  async handleIncomingMessage(message) {
    if (!this.ready) {
      return;
    }

    this.stateStore.registerMessage(this.options.messageInterval);

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    const interval = Math.max(1, Number(this.options.messageInterval) || 10);
    const minDelay = interval * 1000;
    const maxDelay = minDelay * 1.5;
    const delay = Math.floor(minDelay + Math.random() * (maxDelay - minDelay));

    console.log(`[ProfileCinema] Scheduling update in ${(delay / 1000).toFixed(1)}s (Debounce)`);

    this.updateTimeout = setTimeout(() => {
      this.queueFrameAdvance();
      this.updateTimeout = null;
    }, delay);

    await this.stateStore.save();
  }

  queueFrameAdvance() {
    this.updateQueue = this.updateQueue
      .then(() => this.advanceFrameSafely())
      .catch((error) => {
        console.error('[ProfileCinema] Failed to advance frame:', error.message);
      });
  }

  async advanceFrameSafely() {
    if (this.stateStore.isComplete(this.duration)) {
      console.log('[ProfileCinema] Movie completed. Skipping advance.');
      return;
    }

    const currentTimeSeconds = this.stateStore.state.currentTimeSeconds;
    const nextTimeSeconds = Math.min(currentTimeSeconds + 1, this.duration);

    const frame = await this.frameExtractor.extract(nextTimeSeconds);
    try {
      const media = MessageMedia.fromFilePath(frame.filePath);
      if (!media.mimetype) {
        media.mimetype = 'image/jpeg';
      }
      const selfId = this.client.info?.wid?._serialized || this.client.info?.me?._serialized;
      if (!selfId) {
        throw new Error('Unable to resolve self WhatsApp ID');
      }

      await this.client.setProfilePicture(media);
      this.stateStore.advanceTo(nextTimeSeconds);
      await this.stateStore.save();
      console.log(`[ProfileCinema] Updated profile to second ${nextTimeSeconds}/${this.duration}`);
    } finally {
      await this.frameExtractor.cleanup(frame.filePath);
    }
  }

  getStatus() {
    if (!this.ready) {
      return null;
    }
    return this.stateStore.getStatus(this.keyframes.length, this.options.messageInterval);
  }

  async destroy() {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    await this.updateQueue;
  }
}
