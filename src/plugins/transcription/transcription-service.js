import OpenAI from 'openai';
import fs from 'fs-extra';
import { config } from '../../config.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export class TranscriptionService {
  static async transcribe(audioPath, messageId) {
    console.log(`[Transcription] Starting transcription for message ${messageId}`);

    try {
      // Check file size
      const stats = await fs.stat(audioPath);
      const fileSizeMB = stats.size / (1024 * 1024);

      if (fileSizeMB > config.transcription.maxFileSizeMB) {
        throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds maximum ${config.transcription.maxFileSizeMB}MB`);
      }

      console.log(`[Transcription] File size: ${fileSizeMB.toFixed(2)}MB`);

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Transcription timeout')), config.transcription.timeoutMs);
      });

      // Create transcription promise
      const transcriptionParams = {
        file: fs.createReadStream(audioPath),
        model: config.openai.model,
        response_format: 'json',
        temperature: config.openai.temperature
      };

      // Only include language if specified (auto-detect otherwise)
      if (config.transcription.defaultLanguage) {
        transcriptionParams.language = config.transcription.defaultLanguage;
      }

      const transcriptionPromise = openai.audio.transcriptions.create(transcriptionParams);

      // Race between transcription and timeout
      const transcription = await Promise.race([transcriptionPromise, timeoutPromise]);

      console.log(`[Transcription] Completed for message ${messageId}`);

      return transcription.text;
    } catch (error) {
      console.error(`[Transcription] Failed for message ${messageId}:`, error.message);
      throw error;
    } finally {
      // Always clean up the audio file
      try {
        await fs.unlink(audioPath);
        console.log(`[Transcription] Cleaned up audio file: ${audioPath}`);
      } catch (cleanupError) {
        console.error(`[Transcription] Failed to clean up audio file:`, cleanupError);
      }
    }
  }
}
