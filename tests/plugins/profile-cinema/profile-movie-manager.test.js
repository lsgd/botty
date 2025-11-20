import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import pkg from 'whatsapp-web.js';

import { ProfileMovieManager } from '../../../src/plugins/profile-cinema/profile-movie-manager.js';
import * as KeyframeDetector from '../../../src/plugins/profile-cinema/keyframe-detector.js';

const { MessageMedia } = pkg;

function createTempFilePath(prefix, ext) {
  const filePath = path.join(os.tmpdir(), `${prefix}-${randomUUID()}.${ext}`);
  return filePath;
}

function createStateStub() {
  const state = {
    currentKeyframeIndex: 0,
    messageSinceLastFrame: 0,
    totalMessages: 0,
    lastTimestamp: null
  };

  const stub = {
    state,
    load: mock.fn(async () => {}),
    save: mock.fn(async () => {}),
    updateFingerprint: mock.fn(() => false),
    isComplete: mock.fn((totalKeyframes) => {
      if (totalKeyframes === 0) return true;
      return state.currentKeyframeIndex >= totalKeyframes - 1;
    }),
    registerMessage: mock.fn((interval) => {
      state.totalMessages += 1;
      state.messageSinceLastFrame += 1;
      if (state.messageSinceLastFrame >= interval) {
        state.messageSinceLastFrame = 0;
        return true;
      }
      return false;
    }),
    advanceTo: mock.fn((index, timestamp) => {
      state.currentKeyframeIndex = index;
      state.lastTimestamp = timestamp;
    }),
    getStatus: mock.fn(() => ({ ...state, messageInterval: 5, totalKeyframes: 3, completed: false }))
  };

  return stub;
}

describe('ProfileMovieManager', () => {
  let moviePath;
  let tempFramePath;

  beforeEach(async () => {
    moviePath = createTempFilePath('movie', 'mp4');
    tempFramePath = createTempFilePath('frame', 'jpg');
    await fs.writeFile(moviePath, 'movie-bytes');
    await fs.writeFile(tempFramePath, 'frame-bytes');
    mock.method(KeyframeDetector, 'ensureReadableMovie', async () => {});
    mock.method(MessageMedia, 'fromFilePath', async () => ({ data: 'base64', mimetype: 'image/jpeg' }));
  });

  afterEach(async () => {
    await fs.rm(moviePath, { force: true });
    await fs.rm(tempFramePath, { force: true });
    mock.restoreAll();
  });

  it('advances to the next key frame after reaching the configured interval', async () => {
    const keyframes = [{ time: 1 }, { time: 2 }, { time: 3 }];
    mock.method(KeyframeDetector, 'detectKeyframes', async () => keyframes);

    const client = {
      info: { wid: { _serialized: 'bot@c.us' } },
      setProfilePicture: mock.fn(async () => {})
    };

    const options = {
      moviePath,
      progressStorePath: createTempFilePath('progress', 'json'),
      maxUploadKilobytes: 100,
      messageInterval: 2
    };

    const manager = new ProfileMovieManager(client, options);
    const fakeState = createStateStub();
    const fakeExtractor = {
      extract: mock.fn(async () => ({ filePath: tempFramePath, size: 42 })),
      cleanup: mock.fn(async () => {})
    };

    manager.stateStore = fakeState;
    manager.frameExtractor = fakeExtractor;

    await manager.initialize();

    const message = { from: 'user@c.us', fromMe: false };
    await manager.handleIncomingMessage(message);
    await manager.handleIncomingMessage(message);
    await manager.updateQueue;

    assert.strictEqual(fakeExtractor.extract.mock.callCount(), 1);
    assert.strictEqual(client.setProfilePicture.mock.callCount(), 1);
    assert.deepStrictEqual(fakeState.advanceTo.mock.calls[0].arguments, [1, 2]);
    assert.strictEqual(fakeState.state.currentKeyframeIndex, 1);
  });

  it('does not advance when the movie is already complete', async () => {
    const keyframes = [{ time: 1 }, { time: 2 }];
    mock.method(KeyframeDetector, 'detectKeyframes', async () => keyframes);

    const client = {
      info: { wid: { _serialized: 'bot@c.us' } },
      setProfilePicture: mock.fn(async () => {})
    };

    const options = {
      moviePath,
      progressStorePath: createTempFilePath('progress', 'json'),
      maxUploadKilobytes: 100,
      messageInterval: 1
    };

    const manager = new ProfileMovieManager(client, options);
    const fakeState = createStateStub();
    fakeState.state.currentKeyframeIndex = keyframes.length - 1;
    fakeState.isComplete = mock.fn(() => true);
    fakeState.registerMessage = mock.fn(() => true);

    const fakeExtractor = {
      extract: mock.fn(),
      cleanup: mock.fn()
    };

    manager.stateStore = fakeState;
    manager.frameExtractor = fakeExtractor;

    await manager.initialize();
    await manager.handleIncomingMessage({ from: 'user@c.us', fromMe: false });
    await manager.updateQueue;

    assert.strictEqual(fakeExtractor.extract.mock.callCount(), 0);
    assert.strictEqual(client.setProfilePicture.mock.callCount(), 0);
  });

  it('returns status from the state store when ready', async () => {
    const keyframes = [{ time: 1 }];
    mock.method(KeyframeDetector, 'detectKeyframes', async () => keyframes);

    const client = {
      info: { wid: { _serialized: 'bot@c.us' } },
      setProfilePicture: mock.fn(async () => {})
    };

    const options = {
      moviePath,
      progressStorePath: createTempFilePath('progress', 'json'),
      maxUploadKilobytes: 100,
      messageInterval: 5
    };

    const manager = new ProfileMovieManager(client, options);
    const fakeState = createStateStub();
    fakeState.getStatus = mock.fn(() => ({ currentFrame: 0, totalKeyframes: 1, completed: false }));

    manager.stateStore = fakeState;

    await manager.initialize();
    const status = manager.getStatus();

    assert.deepStrictEqual(status, { currentFrame: 0, totalKeyframes: 1, completed: false });
    assert.strictEqual(fakeState.getStatus.mock.callCount(), 1);
  });
});
