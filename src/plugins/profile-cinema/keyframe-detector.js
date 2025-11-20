import fs from 'fs/promises';
import ffprobe from 'ffprobe-static';
import { runProcess } from './process-utils.js';

const ffprobePath = typeof ffprobe === 'string' ? ffprobe : ffprobe?.path;

export async function ensureReadableMovie(moviePath) {
  await fs.access(moviePath);
}

export async function detectKeyframes(moviePath) {
  await ensureReadableMovie(moviePath);

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-select_streams', 'v:0',
    '-skip_frame', 'nokey',
    '-show_entries', 'frame=pkt_pts_time',
    '-of', 'csv=p=0',
    moviePath
  ];

  const stdout = await runProcess(ffprobePath, args);
  const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
  const keyframes = lines
    .map((line, index) => ({
      time: Number.parseFloat(line),
      index
    }))
    .filter(frame => Number.isFinite(frame.time));

  return keyframes;
}
