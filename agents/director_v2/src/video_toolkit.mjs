// video_toolkit.mjs — Director v2 bridge to claude-code-video-toolkit (Modal cloud GPU).
//
// Spawns Python tools at $TOOLKIT_PATH (default: ~/.openclaw/workspace/claude-code-video-toolkit).
// Each function returns a path to a generated artifact (MP3 / PNG / MP4) ready for ffmpeg.
//
// Required env (set by GHA workflow from Doppler/secrets):
//   MODAL_QWEN3_TTS_ENDPOINT_URL     Voiceover (Qwen3-TTS)
//   MODAL_FLUX2_ENDPOINT_URL         Image gen (FLUX.2)
//   MODAL_MUSIC_GEN_ENDPOINT_URL     Music gen (ACE-Step)
//   MODAL_SADTALKER_ENDPOINT_URL     Talking head (avatar from photo + audio)
//   MODAL_LTX2_ENDPOINT_URL          Video AI (text-to-video clips, optional)
//   MODAL_IMAGE_EDIT_ENDPOINT_URL    Image edit (Qwen-Edit, optional)
//   MODAL_UPSCALE_ENDPOINT_URL       Upscale (RealESRGAN, optional)
//
// Optional:
//   TOOLKIT_PATH                     override default toolkit clone location

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { stat } from 'node:fs/promises';

export class VideoToolkitError extends Error {
  constructor(msg) { super(msg); this.name = 'VideoToolkitError'; }
}

const DEFAULT_TOOLKIT = join(homedir(), '.openclaw', 'workspace', 'claude-code-video-toolkit');

function toolkitPath() {
  return process.env.TOOLKIT_PATH || DEFAULT_TOOLKIT;
}

function runPython(scriptName, args, { timeoutMs = 600_000 } = {}) {
  return new Promise((resolve, reject) => {
    const cwd = toolkitPath();
    const scriptPath = join(cwd, 'tools', scriptName);
    const proc = spawn('python3', [scriptPath, ...args, '--cloud', 'modal'], {
      cwd,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { err += d.toString(); });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new VideoToolkitError(`${scriptName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout: out, stderr: err });
      else reject(new VideoToolkitError(`${scriptName} exit=${code}: ${(err || out).trim().slice(-300)}`));
    });
    proc.on('error', e => { clearTimeout(timer); reject(new VideoToolkitError(`spawn failed: ${e.message}`)); });
  });
}

async function assertOutput(path) {
  try { await stat(path); }
  catch { throw new VideoToolkitError(`expected output not produced: ${path}`); }
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voiceover (Qwen3-TTS via Modal)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateVoiceover({ text, outputPath, speaker = 'Ryan', tone = 'warm', refAudio = null, refText = null }) {
  if (!process.env.MODAL_QWEN3_TTS_ENDPOINT_URL) throw new VideoToolkitError('MODAL_QWEN3_TTS_ENDPOINT_URL missing');
  if (!text || !outputPath) throw new VideoToolkitError('text + outputPath required');
  const args = ['--text', text, '--output', outputPath];
  if (refAudio && refText) {
    args.push('--ref-audio', refAudio, '--ref-text', refText);
  } else {
    args.push('--speaker', speaker, '--tone', tone);
  }
  await runPython('qwen3_tts.py', args, { timeoutMs: 300_000 });
  return assertOutput(outputPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Image generation (FLUX.2 via Modal)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateImage({ prompt, outputPath, width = 1080, height = 1920 }) {
  if (!process.env.MODAL_FLUX2_ENDPOINT_URL) throw new VideoToolkitError('MODAL_FLUX2_ENDPOINT_URL missing');
  if (!prompt || !outputPath) throw new VideoToolkitError('prompt + outputPath required');
  await runPython('flux2.py', ['--prompt', prompt, '--width', String(width), '--height', String(height), '--output', outputPath], { timeoutMs: 300_000 });
  return assertOutput(outputPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Music generation (ACE-Step via Modal)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMusic({ preset = 'corporate-bg', durationSec = 60, outputPath }) {
  if (!process.env.MODAL_MUSIC_GEN_ENDPOINT_URL) throw new VideoToolkitError('MODAL_MUSIC_GEN_ENDPOINT_URL missing');
  if (!outputPath) throw new VideoToolkitError('outputPath required');
  await runPython('music_gen.py', ['--preset', preset, '--duration', String(durationSec), '--output', outputPath], { timeoutMs: 600_000 });
  return assertOutput(outputPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Talking head (SadTalker via Modal) — animates a still photo to lip-sync the audio.
// Lower-quality alternative to HeyGen but $0.30/clip vs $1.60/clip.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateTalkingHead({ imagePath, audioPath, outputPath, expression = 'natural' }) {
  if (!process.env.MODAL_SADTALKER_ENDPOINT_URL) throw new VideoToolkitError('MODAL_SADTALKER_ENDPOINT_URL missing');
  if (!imagePath || !audioPath || !outputPath) throw new VideoToolkitError('imagePath + audioPath + outputPath required');
  await runPython('sadtalker.py', ['--image', imagePath, '--audio', audioPath, '--output', outputPath, '--expression', expression], { timeoutMs: 600_000 });
  return assertOutput(outputPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI video clip (LTX-2 via Modal) — text or image to short video.
// Optional, requires HF_TOKEN + Gemma 3 license.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateVideoClip({ prompt, durationSec = 5, outputPath, startFrame = null }) {
  if (!process.env.MODAL_LTX2_ENDPOINT_URL) throw new VideoToolkitError('MODAL_LTX2_ENDPOINT_URL missing (LTX-2 not deployed)');
  if (!prompt || !outputPath) throw new VideoToolkitError('prompt + outputPath required');
  const args = ['--prompt', prompt, '--duration', String(durationSec), '--output', outputPath];
  if (startFrame) args.push('--start-frame', startFrame);
  await runPython('ltx2.py', args, { timeoutMs: 600_000 });
  return assertOutput(outputPath);
}

// Returns true if Modal endpoints are configured for the given mode.
// modes: 'voiceover' | 'image' | 'music' | 'talking_head' | 'video_clip'
export function isAvailable(mode) {
  const map = {
    voiceover:    'MODAL_QWEN3_TTS_ENDPOINT_URL',
    image:        'MODAL_FLUX2_ENDPOINT_URL',
    music:        'MODAL_MUSIC_GEN_ENDPOINT_URL',
    talking_head: 'MODAL_SADTALKER_ENDPOINT_URL',
    video_clip:   'MODAL_LTX2_ENDPOINT_URL',
  };
  const envName = map[mode];
  return Boolean(envName && process.env[envName]);
}
