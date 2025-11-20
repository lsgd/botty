import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { i18n } from '../../src/utils/i18n.js';

describe('I18n', () => {
  let originalLanguage;

  before(() => {
    originalLanguage = i18n.currentLanguage;
  });

  after(() => {
    i18n.setLanguage(originalLanguage);
  });

  describe('setLanguage', () => {
    it('should set language to English', () => {
      i18n.setLanguage('en');
      assert.strictEqual(i18n.currentLanguage, 'en');
    });

    it('should set language to German', () => {
      i18n.setLanguage('de');
      assert.strictEqual(i18n.currentLanguage, 'de');
    });

    it('should set language to Italian', () => {
      i18n.setLanguage('it');
      assert.strictEqual(i18n.currentLanguage, 'it');
    });

    it('should fall back to English for unsupported language', () => {
      i18n.setLanguage('fr');
      assert.strictEqual(i18n.currentLanguage, 'en');
    });
  });

  describe('t (translate)', () => {
    it('should translate simple keys in English', () => {
      i18n.setLanguage('en');
      const result = i18n.t('botReady');
      assert.strictEqual(result, '✅ WhatsApp Bot is ready!');
    });

    it('should translate simple keys in German', () => {
      i18n.setLanguage('de');
      const result = i18n.t('botReady');
      assert.strictEqual(result, '✅ WhatsApp Bot ist bereit!');
    });

    it('should translate simple keys in Italian', () => {
      i18n.setLanguage('it');
      const result = i18n.t('botReady');
      assert.strictEqual(result, '✅ Il bot WhatsApp è pronto!');
    });

    it('should translate function keys with parameters in English', () => {
      i18n.setLanguage('en');
      const result = i18n.t('unknownCommand', 'test');
      assert.ok(result.includes('test'));
      assert.ok(result.includes('Unknown command'));
    });

    it('should translate function keys with parameters in German', () => {
      i18n.setLanguage('de');
      const result = i18n.t('unknownCommand', 'test');
      assert.ok(result.includes('test'));
      assert.ok(result.includes('Unbekannter Befehl'));
    });

    it('should return key if translation not found', () => {
      i18n.setLanguage('en');
      const result = i18n.t('nonExistentKey');
      assert.strictEqual(result, 'nonExistentKey');
    });

    it('should handle transcription result formatting', () => {
      i18n.setLanguage('en');
      const result = i18n.t('transcriptionResult', 'Hello world');
      assert.ok(result.includes('Hello world'));
      assert.ok(result.includes('Transcription'));
    });

    it('should handle settings with boolean parameters', () => {
      i18n.setLanguage('en');
      const resultEnabled = i18n.t('settingsGlobal', true);
      assert.ok(resultEnabled.includes('Enabled'));

      const resultDisabled = i18n.t('settingsGlobal', false);
      assert.ok(resultDisabled.includes('Disabled'));
    });
  });

  describe('Plugin translations', () => {
    it('should provide transcription plugin name in English', () => {
      i18n.setLanguage('en');
      assert.strictEqual(i18n.t('transcriptionPluginName'), 'Voice Transcription');
    });

    it('should provide transcription plugin name in German', () => {
      i18n.setLanguage('de');
      assert.strictEqual(i18n.t('transcriptionPluginName'), 'Sprachnachrichten-Transkription');
    });
  });
});
