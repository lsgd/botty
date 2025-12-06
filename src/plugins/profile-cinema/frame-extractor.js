import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import ffmpeg from 'ffmpeg-static';
import { runProcess } from './process-utils.js';
import ffprobe from 'ffprobe-static';

const ffmpegPath = typeof ffmpeg === 'string' ? ffmpeg : ffmpeg?.path;

const ATTEMPTS = [
  { width: 512, quality: 3 },
  { width: 420, quality: 5 },
  { width: 360, quality: 7 },
  { width: 280, quality: 9 },
  { width: 220, quality: 12 }
];

export class FrameExtractor {
  constructor(moviePath, maxBytes) {
    this.moviePath = moviePath;
    this.maxBytes = maxBytes;
  }

  async extract(timestampSeconds) {
    const timestamp = Math.max(0, Number(timestampSeconds) || 0).toFixed(3);
    let lastError;

    const tempFile = path.join(os.tmpdir(), `profile-frame-${randomUUID()}.jpg`);

    for (const attempt of ATTEMPTS) {
      try {
        await this.renderFrame(tempFile, timestamp, attempt.width, attempt.quality);
        const stats = await fs.stat(tempFile);
        if (stats.size <= this.maxBytes) {
          return { filePath: tempFile, size: stats.size };
        }
        await fs.rm(tempFile, { force: true });
      } catch (error) {
        lastError = error;
        await fs.rm(tempFile, { force: true });
      }
    }

    throw lastError ?? new Error('Unable to create profile frame under size limit');
  }

  async renderFrame(outputPath, timestamp, width, quality) {
    const scaleExpr = `scale=min(${width}\\,iw):-2`;
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-ss', timestamp,
      '-i', this.moviePath,
      '-frames:v', '1',
      '-vf', `${scaleExpr}`,
      '-q:v', String(quality),
      '-update', '1',
      '-y',
      outputPath
    ];

    await runProcess(ffmpegPath, args, {
      onStderr: (data) => console.log(`[FFmpeg] ${data}`)
    });
  }

  async cleanup(filePath) {
    if (!filePath) return;
    await fs.rm(filePath, { force: true });
  }
}

const ffprobePath = typeof ffprobe === 'string' ? ffprobe : ffprobe?.path;

export async function ensureReadableMovie(moviePath) {
  await fs.access(moviePath);
}

export async function getMovieDuration(moviePath) {
  await ensureReadableMovie(moviePath);

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    moviePath
  ];

  const stdout = await runProcess(ffprobePath, args);
  const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
  const duration = Number.parseFloat(lines[0]);

  return duration;
}
