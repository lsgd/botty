import fs from 'fs/promises';
import path from 'path';

const DEFAULT_STATE = {
  movieFingerprint: null,
  currentKeyframeIndex: 0,
  messageSinceLastFrame: 0,
  totalMessages: 0,
  lastTimestamp: null
};

export class ProfileMovieState {
  constructor(storePath) {
    this.storePath = storePath;
    this.state = { ...DEFAULT_STATE };
  }

  async load() {
    try {
      const data = await fs.readFile(this.storePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.state = { ...DEFAULT_STATE, ...parsed };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      await this.save();
    }
  }

  async save() {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    await fs.writeFile(this.storePath, JSON.stringify(this.state, null, 2));
  }

  updateFingerprint(fingerprint) {
    if (!fingerprint) {
      return false;
    }

    if (this.state.movieFingerprint === fingerprint) {
      return false;
    }

    this.state = {
      ...DEFAULT_STATE,
      movieFingerprint: fingerprint
    };
    return true;
  }

  registerMessage(interval) {
    const effectiveInterval = Math.max(1, Number(interval) || 1);
    this.state.totalMessages += 1;
    this.state.messageSinceLastFrame += 1;

    if (this.state.messageSinceLastFrame >= effectiveInterval) {
      this.state.messageSinceLastFrame = 0;
      return true;
    }
    return false;
  }

  advanceTo(index, timestamp) {
    this.state.currentKeyframeIndex = index;
    this.state.lastTimestamp = timestamp;
  }

  isComplete(totalKeyframes) {
    if (totalKeyframes === 0) {
      return true;
    }
    return this.state.currentKeyframeIndex >= totalKeyframes - 1;
  }

  getStatus(totalKeyframes, interval) {
    return {
      currentFrame: Math.min(this.state.currentKeyframeIndex, Math.max(0, totalKeyframes - 1)),
      totalKeyframes,
      completed: this.isComplete(totalKeyframes),
      lastTimestampSeconds: this.state.lastTimestamp,
      totalMessages: this.state.totalMessages,
      messageInterval: Math.max(1, Number(interval) || 1)
    };
  }
}
