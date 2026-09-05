import fs from 'fs-extra';
import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';
import { getClient, getModel } from '../../utils/ai.js';

export class TranscriptionService {
  static async transcribe(audioPath, messageId) {
    logger.info('TranscriptionService', 'Starting transcription', { messageId });

    try {
      // Check file size
      const stats = await fs.stat(audioPath);
      const fileSizeMB = stats.size / (1024 * 1024);

      if (fileSizeMB > config.transcription.maxFileSizeMB) {
        throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds maximum ${config.transcription.maxFileSizeMB}MB`);
      }

      logger.debug('TranscriptionService', 'File size checked', { messageId, fileSizeMB: fileSizeMB.toFixed(2) });

      // Create a clearable timeout promise
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Transcription timeout')), config.transcription.timeoutMs);
      });

      // Create transcription promise
      const transcriptionParams = {
        file: fs.createReadStream(audioPath),
        model: getModel('transcription'),
        response_format: 'json',
        temperature: config.ai.temperature
      };

      // Only include language if specified (auto-detect otherwise)
      if (config.transcription.defaultLanguage) {
        transcriptionParams.language = config.transcription.defaultLanguage;
      }

      const transcriptionPromise = getClient('transcription').audio.transcriptions.create(transcriptionParams);

      // Race between transcription and timeout
      let transcription;
      try {
        transcription = await Promise.race([transcriptionPromise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }

      logger.info('TranscriptionService', 'Transcription completed', { messageId });

      return transcription.text;
    } catch (error) {
      logger.error('TranscriptionService', 'Transcription failed', { messageId, error: error.message });
      throw error;
    } finally {
      // Always clean up the audio file
      try {
        await fs.unlink(audioPath);
        logger.debug('TranscriptionService', 'Cleaned up audio file', { path: audioPath });
      } catch (cleanupError) {
        logger.error('TranscriptionService', 'Failed to clean up audio file', {
          path: audioPath,
          error: cleanupError.message
        });
      }
    }
  }
}
