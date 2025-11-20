import fs from 'fs/promises';
import pkg from 'whatsapp-web.js';
import { FrameExtractor } from './frame-extractor.js';
import { detectKeyframes, ensureReadableMovie } from './keyframe-detector.js';
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

    this.keyframes = await detectKeyframes(this.options.moviePath);
    if (this.keyframes.length === 0) {
      throw new Error('ProfileCinema: No keyframes found in movie');
    }

    if (this.stateStore.isComplete(this.keyframes.length)) {
      console.log('[ProfileCinema] Movie already finished. Sticking to last frame.');
    }

    await this.stateStore.save();
    this.ready = true;
  }

  async handleIncomingMessage(message) {
    if (!this.ready || message.fromMe) {
      return;
    }

    const shouldAdvance = this.stateStore.registerMessage(this.options.messageInterval);
    if (shouldAdvance) {
      this.queueFrameAdvance();
    }

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
    if (this.stateStore.isComplete(this.keyframes.length)) {
      return;
    }

    const currentIndex = this.stateStore.state.currentKeyframeIndex;
    const nextIndex = Math.min(currentIndex + 1, this.keyframes.length - 1);
    if (nextIndex === currentIndex) {
      return;
    }

    const target = this.keyframes[nextIndex];
    const frame = await this.frameExtractor.extract(target.time ?? target);
    try {
      const media = await MessageMedia.fromFilePath(frame.filePath);
      const selfId = this.client.info?.wid?._serialized || this.client.info?.me?._serialized;
      if (!selfId) {
        throw new Error('Unable to resolve self WhatsApp ID');
      }

      await this.client.setProfilePicture(selfId, media);
      this.stateStore.advanceTo(nextIndex, target.time ?? target);
      await this.stateStore.save();
      console.log(`[ProfileCinema] Updated profile to frame ${nextIndex + 1}/${this.keyframes.length}`);
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
    await this.updateQueue;
  }
}
