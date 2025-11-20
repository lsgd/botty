import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ProfileMovieState } from '../../../src/plugins/profile-cinema/profile-movie-state.js';

const tempDir = path.join(os.tmpdir(), 'profile-cinema-tests');

describe('ProfileMovieState', () => {
  let storePath;
  let state;

  beforeEach(async () => {
    await fs.mkdir(tempDir, { recursive: true });
    storePath = path.join(tempDir, `state-${Date.now()}-${Math.random()}.json`);
    await fs.rm(storePath, { force: true });
    state = new ProfileMovieState(storePath);
    await state.load();
  });

  it('should reset progress when fingerprint changes', async () => {
    const changed = state.updateFingerprint('fingerprint-1');
    assert.strictEqual(changed, true);
    state.advanceTo(5, 123.45);
    state.registerMessage(10);
    await state.save();

    const noChange = state.updateFingerprint('fingerprint-1');
    assert.strictEqual(noChange, false);

    const reset = state.updateFingerprint('fingerprint-2');
    assert.strictEqual(reset, true);
    assert.strictEqual(state.state.currentKeyframeIndex, 0);
    assert.strictEqual(state.state.messageSinceLastFrame, 0);
    assert.strictEqual(state.state.lastTimestamp, null);
  });

  it('should signal when enough messages elapsed', () => {
    for (let i = 0; i < 4; i += 1) {
      const ready = state.registerMessage(5);
      assert.strictEqual(ready, false);
    }
    const trigger = state.registerMessage(5);
    assert.strictEqual(trigger, true);
  });

  it('should report completion status', () => {
    state.advanceTo(4, 42);
    const status = state.getStatus(5, 10);
    assert.strictEqual(status.completed, true);
    assert.strictEqual(status.currentFrame, 4);
    assert.strictEqual(status.lastTimestampSeconds, 42);
    assert.strictEqual(status.messageInterval, 10);
  });
});
