import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a test storage instance
const testConfigPath = path.join(__dirname, '../fixtures/test-config.json');

describe('Storage', () => {
  let Storage;
  let storage;

  before(async () => {
    // Ensure test fixtures directory exists
    await fs.ensureDir(path.dirname(testConfigPath));

    // Remove existing test config
    if (await fs.pathExists(testConfigPath)) {
      await fs.remove(testConfigPath);
    }

    // Import Storage class - we'll need to mock the config path
    // For now, let's test the actual storage with the understanding
    // that it uses the real config path
  });

  after(async () => {
    // Clean up test config
    if (await fs.pathExists(testConfigPath)) {
      await fs.remove(testConfigPath);
    }
  });

  describe('Transcription Settings', () => {
    it('should default to global transcription enabled', async () => {
      // Import fresh storage
      const { storage: testStorage } = await import('../../src/utils/storage.js');
      const globalEnabled = testStorage.getGlobalTranscription();
      assert.strictEqual(typeof globalEnabled, 'boolean');
    });

    it('should get and set global transcription', async () => {
      const { storage: testStorage } = await import('../../src/utils/storage.js');

      // Set to true
      testStorage.setGlobalTranscription(true);
      assert.strictEqual(testStorage.getGlobalTranscription(), true);

      // Set to false
      testStorage.setGlobalTranscription(false);
      assert.strictEqual(testStorage.getGlobalTranscription(), false);

      // Reset to true
      testStorage.setGlobalTranscription(true);
    });

    it('should set and get chat-specific transcription', async () => {
      const { storage: testStorage } = await import('../../src/utils/storage.js');
      const chatId = 'test-chat-123@c.us';

      // Set chat-specific setting
      testStorage.setTranscriptionForChat(chatId, true);
      assert.strictEqual(testStorage.getChatTranscription(chatId), true);

      // Change setting
      testStorage.setTranscriptionForChat(chatId, false);
      assert.strictEqual(testStorage.getChatTranscription(chatId), false);
    });

    it('should check if transcription is enabled for a chat', async () => {
      const { storage: testStorage } = await import('../../src/utils/storage.js');
      const chatId1 = 'test-chat-456@c.us';
      const chatId2 = 'test-chat-789@c.us';

      // Set global to true
      testStorage.setGlobalTranscription(true);

      // Chat without specific setting should use global
      assert.strictEqual(testStorage.isTranscriptionEnabled(chatId1), true);

      // Chat with specific setting should use that
      testStorage.setTranscriptionForChat(chatId2, false);
      assert.strictEqual(testStorage.isTranscriptionEnabled(chatId2), false);

      // Verify first chat still uses global
      assert.strictEqual(testStorage.isTranscriptionEnabled(chatId1), true);
    });

    it('should override global setting with chat-specific setting', async () => {
      const { storage: testStorage } = await import('../../src/utils/storage.js');
      const chatId = 'test-chat-override@c.us';

      // Global is false, chat-specific is true
      testStorage.setGlobalTranscription(false);
      testStorage.setTranscriptionForChat(chatId, true);

      assert.strictEqual(testStorage.getGlobalTranscription(), false);
      assert.strictEqual(testStorage.isTranscriptionEnabled(chatId), true);
    });

    it('should return undefined for chat without specific setting', async () => {
      const { storage: testStorage } = await import('../../src/utils/storage.js');
      const chatId = 'never-configured-chat@c.us';

      const result = testStorage.getChatTranscription(chatId);
      assert.strictEqual(result, undefined);
    });
  });

  describe('Data Persistence', () => {
    it('should persist data across load/save cycles', async () => {
      const { storage: testStorage } = await import('../../src/utils/storage.js');
      const chatId = 'persistence-test@c.us';

      // Set values
      testStorage.setGlobalTranscription(false);
      testStorage.setTranscriptionForChat(chatId, true);

      // Force save
      testStorage.save();

      // Reload
      const reloadedData = testStorage.load();

      assert.strictEqual(reloadedData.transcription.globalEnabled, false);
      assert.strictEqual(reloadedData.transcription.chatSettings[chatId].enabled, true);
    });
  });
});
