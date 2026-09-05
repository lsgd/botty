import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import OpenAI from 'openai';
import { config } from '../../src/config.js';
import { getClient, getModel } from '../../src/utils/ai.js';

function buildFakeAIConfig() {
  return {
    provider: 'openai',
    temperature: 0,
    openai: {
      apiKey: 'test-openai-api-key',
      transcriptionModel: 'gpt-4o-transcribe',
      chatModel: 'gpt-4o'
    },
    openrouter: {
      apiKey: 'test-openrouter-api-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      httpReferer: undefined,
      appTitle: undefined,
      transcriptionModel: 'openai/whisper-large-v3',
      chatModel: 'openai/gpt-4o'
    }
  };
}

describe('AI provider client and model resolution', () => {
  let originalAiConfig;

  before(() => {
    originalAiConfig = config.ai;
  });

  after(() => {
    config.ai = originalAiConfig;
  });

  beforeEach(() => {
    config.ai = buildFakeAIConfig();
  });

  describe('getModel', () => {
    it('should resolve OpenAI models for transcription and chat', () => {
      config.ai.provider = 'openai';

      assert.strictEqual(getModel('transcription'), 'gpt-4o-transcribe');
      assert.strictEqual(getModel('chat'), 'gpt-4o');
    });

    it('should respect custom OpenAI model overrides', () => {
      config.ai.provider = 'openai';
      config.ai.openai.transcriptionModel = 'whisper-1';
      config.ai.openai.chatModel = 'gpt-4o-mini';

      assert.strictEqual(getModel('transcription'), 'whisper-1');
      assert.strictEqual(getModel('chat'), 'gpt-4o-mini');
    });

    it('should resolve OpenRouter models for transcription and chat', () => {
      config.ai.provider = 'openrouter';

      assert.strictEqual(getModel('transcription'), 'openai/whisper-large-v3');
      assert.strictEqual(getModel('chat'), 'openai/gpt-4o');
    });

    it('should respect custom OpenRouter model overrides', () => {
      config.ai.provider = 'openrouter';
      config.ai.openrouter.transcriptionModel = 'openai/gpt-4o-transcribe';
      config.ai.openrouter.chatModel = 'anthropic/claude-3.5-sonnet';

      assert.strictEqual(getModel('transcription'), 'openai/gpt-4o-transcribe');
      assert.strictEqual(getModel('chat'), 'anthropic/claude-3.5-sonnet');
    });

    it('should default to the OpenAI provider', () => {
      assert.strictEqual(config.ai.provider, 'openai');
      assert.strictEqual(getModel('transcription'), 'gpt-4o-transcribe');
      assert.strictEqual(getModel('chat'), 'gpt-4o');
    });
  });

  describe('getClient', () => {
    it('should return an OpenAI client for the openai provider', () => {
      config.ai.provider = 'openai';
      config.ai.openai.apiKey = 'test-openai-api-key';

      const client = getClient('transcription');

      assert.ok(client instanceof OpenAI);
      assert.strictEqual(client.apiKey, 'test-openai-api-key');
      assert.strictEqual(client.baseURL, 'https://api.openai.com/v1');
    });

    it('should return an OpenAI client with the configured base url for openrouter', () => {
      config.ai.provider = 'openrouter';
      config.ai.openrouter.apiKey = 'test-openrouter-api-key';
      config.ai.openrouter.baseUrl = 'https://openrouter.ai/api/v1';

      const client = getClient('transcription');

      assert.ok(client instanceof OpenAI);
      assert.strictEqual(client.apiKey, 'test-openrouter-api-key');
      assert.strictEqual(client.baseURL, 'https://openrouter.ai/api/v1');
    });

    it('should set a custom base url when configured for openrouter', () => {
      config.ai.provider = 'openrouter';
      config.ai.openrouter.baseUrl = 'https://custom.openrouter.example/v1';

      const client = getClient('chat');

      assert.strictEqual(client.baseURL, 'https://custom.openrouter.example/v1');
    });

    it('should apply OpenRouter referer and app title headers when configured', () => {
      config.ai.provider = 'openrouter';
      config.ai.openrouter.baseUrl = 'https://headers.openrouter.example/v1';
      config.ai.openrouter.httpReferer = 'https://example.com';
      config.ai.openrouter.appTitle = 'WhatsApp Bot';

      const client = getClient('transcription');
      const headers = client._options?.defaultHeaders ?? {};

      assert.strictEqual(headers['HTTP-Referer'], 'https://example.com');
      assert.strictEqual(headers['X-OpenRouter-Title'], 'WhatsApp Bot');
    });

    it('should memoize the client for the same use case', () => {
      config.ai.provider = 'openrouter';

      const first = getClient('transcription');
      const second = getClient('transcription');

      assert.strictEqual(first, second);
    });

    it('should return distinct clients for different use cases', () => {
      config.ai.provider = 'openrouter';

      const transcriptionClient = getClient('transcription');
      const chatClient = getClient('chat');

      assert.notStrictEqual(transcriptionClient, chatClient);
    });
  });

  describe('module import', () => {
    it('should not throw when imported without any api key set', async () => {
      config.ai = {
        provider: 'openai',
        openai: {
          apiKey: undefined,
          transcriptionModel: 'gpt-4o-transcribe',
          chatModel: 'gpt-4o'
        },
        openrouter: {
          apiKey: undefined,
          baseUrl: 'https://openrouter.ai/api/v1'
        }
      };

      const mod = await import('../../src/utils/ai.js?no-side-effects');

      assert.strictEqual(typeof mod.getClient, 'function');
      assert.strictEqual(typeof mod.getModel, 'function');
    });
  });
});