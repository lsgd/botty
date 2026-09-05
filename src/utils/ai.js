import OpenAI from 'openai';
import { config } from '../config.js';

const clients = {};

function buildDefaultHeaders() {
  const defaultHeaders = {};
  const { httpReferer, appTitle } = config.ai.openrouter;
  if (httpReferer) {
    defaultHeaders['HTTP-Referer'] = httpReferer;
  }
  if (appTitle) {
    defaultHeaders['X-OpenRouter-Title'] = appTitle;
  }
  return defaultHeaders;
}

export function getModel(useCase) {
  const providerConfig = config.ai[config.ai.provider];
  return providerConfig[`${useCase}Model`];
}

export function getClient(useCase) {
  const key = `${useCase}:${config.ai.provider}:${config.ai.openrouter.baseUrl}`;
  if (!clients[key]) {
    if (config.ai.provider === 'openrouter') {
      clients[key] = new OpenAI({
        apiKey: config.ai.openrouter.apiKey,
        baseURL: config.ai.openrouter.baseUrl,
        defaultHeaders: buildDefaultHeaders()
      });
    } else {
      clients[key] = new OpenAI({ apiKey: config.ai.openai.apiKey });
    }
  }
  return clients[key];
}