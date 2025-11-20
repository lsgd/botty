import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-transcribe',
    temperature: 0
  },

  // WhatsApp Configuration
  whatsapp: {
    authPath: join(__dirname, '../data/.wwebjs_auth'),
    cachePath: join(__dirname, '../data/.wwebjs_cache'),
    puppeteerArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  },

  // Authorization
  auth: {
    authorizedNumbers: process.env.AUTHORIZED_NUMBERS
      ? process.env.AUTHORIZED_NUMBERS.split(',').map(n => n.trim())
      : []
  },

  // Storage
  storage: {
    configPath: join(__dirname, '../data/config.json'),
    tempAudioPath: join(__dirname, '../data/temp')
  },

  scheduler: {
    timezone: process.env.BOT_TIMEZONE || 'Europe/Berlin',
    birthday: {
      checkHour: Number.parseInt(process.env.BIRTHDAY_CHECK_HOUR || '6', 10),
      windowStartHour: Number.parseInt(process.env.BIRTHDAY_WINDOW_START || '7', 10),
      windowEndHour: Number.parseInt(process.env.BIRTHDAY_WINDOW_END || '9', 10)
    },
    reminders: {
      checkHour: Number.parseInt(process.env.REMINDER_CHECK_HOUR || '6', 10),
      sendHour: Number.parseInt(process.env.REMINDER_SEND_HOUR || '7', 10),
      sendMinute: Number.parseInt(process.env.REMINDER_SEND_MINUTE || '7', 10)
    }
  },

  profileMovie: {
    enabled: Boolean(process.env.PROFILE_MOVIE_PATH),
    moviePath: process.env.PROFILE_MOVIE_PATH,
    messageInterval: Number.parseInt(process.env.PROFILE_MESSAGE_INTERVAL || '25', 10),
    progressStorePath: join(__dirname, '../data/profile-movie-progress.json'),
    maxUploadKilobytes: Number.parseInt(process.env.PROFILE_FRAME_MAX_KB || '100', 10)
  },

  // Transcription Settings
  transcription: {
    maxFileSizeMB: 25,
    timeoutMs: 300000, // 5 minutes
    defaultLanguage: null // Auto-detect
  },

  // Bot Language (for messages)
  language: process.env.BOT_LANGUAGE || 'en' // en, de, or it
};
