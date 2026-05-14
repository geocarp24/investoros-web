import { spawn } from 'node:child_process';

const FPS = 30;
export const XFADE_OVERLAP = 0.6;   // 2026-05-07: bumped from 0.3 → 0.6 for smoother cinematic transitions (Jorge feedback "muy robotico")

// Probe a media file's duration (seconds) via ffprobe. Used by Template #2 PiP to align scene cuts to the avatar's actual speech rate.
export function probeMediaDuration(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1', filePath], { stdio: ['ignore','pipe','pipe'] });
    let out = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`ffprobe exit=${code}`));
      const sec = parseFloat(out.trim());
      if (!Number.isFinite(sec) || sec <= 0) return reject(new Error(`ffprobe parse failed: ${out.trim()}`));
      resolve(sec);
    });
    proc.on('error', reject);
  });
}

// IG/TikTok-style karaoke captions via libass `subtitles` filter, fed an ASS file with `\kf` (fill karaoke) tags.
// Subtitles filter reads the ASS PrimaryColour/SecondaryColour to do word-by-word color sweep automatically.
// Path needs single-colon escape inside filter chain (drives libass through the filter graph).
function buildCaptionSubtitles(captionFile) {
  if (!captionFile) return '';
  const escaped = String(captionFile).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  return `,subtitles='${escaped}'`;
}
const TRANSITION_MAP = {
  crossfade: 'fade',
  wipeleft:  'wipeleft',
  slideup:   'slideup',
  cut:       'fade',
  none:      null,
};

export function buildVideoCommand({ scenes, musicPath, outputPath, width = 1080, height = 1920, globalAvatar = null }) {
  const args = ['-y'];

  for (const s of scenes) {
    if (s.videoPath) {
      // HeyGen-style video clip: native input, no -loop.
      args.push('-i', s.videoPath);
    } else {
      args.push('-loop', '1', '-framerate', String(FPS), '-i', s.imagePaths[0]);
    }
  }
  args.push('-i', musicPath);
  // Template #2 (PiP): single global HeyGen avatar input becomes the last input — its video is overlaid as circle, its audio drives the voice.
  const avatarInputIdx = globalAvatar ? scenes.length + 1 : -1;
  if (globalAvatar) args.push('-i', globalAvatar.videoPath);

  const filterParts = [];
  scenes.forEach((s, i) => {
    const cap = buildCaptionSubtitles(s.captionFile);
    if (s.videoPath) {
      // Video clip: scale/crop to canvas, trim to duration. No zoompan (avatar is the focal element). Caption burned in last so it overlays the avatar.
      filterParts.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${FPS},trim=duration=${s.duration}${cap}[v${i}]`
      );
      return;
    }
    const z0 = s.zoompan?.from ?? 1.0;
    const z1 = s.zoompan?.to   ?? 1.0;
    const frames = Math.max(1, Math.round(FPS * s.duration));
    const zExpr = `min(${z0}+(${z1}-${z0})*on/${frames-1 || 1},${Math.max(z0, z1)})`;
    filterParts.push(
      `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='${zExpr}':d=${frames}:s=${width}x${height}:fps=${FPS}${cap}[v${i}]`
    );
  });

  let lastLabel = 'v0';
  let offset = scenes[0].duration - XFADE_OVERLAP;
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const transition = TRANSITION_MAP[prev.transitionOut] || 'fade';
    const inLabel = `v${i}`;
    const outLabel = i === scenes.length - 1 ? 'vout' : `x${i}`;
    filterParts.push(
      `[${lastLabel}][${inLabel}]xfade=transition=${transition}:duration=${XFADE_OVERLAP}:offset=${offset.toFixed(2)}[${outLabel}]`
    );
    lastLabel = outLabel;
    offset += scenes[i].duration - XFADE_OVERLAP;
  }
  if (scenes.length === 1) lastLabel = 'v0';

  // Template #2 PiP: circular alpha-masked avatar overlaid on the xfade chain at fixed position (top-left).
  // geq filter computes alpha=255 inside the inscribed circle, 0 outside — clean circle without external mask asset.
  // Soft 4px edge feather smooths the circle boundary against the background imagery.
  // Position: top-left corner — avoids covering karaoke captions (lower third) and IG/TikTok bottom UI chrome.
  // Template #3 Voiceover: globalAvatar.audioOnly=true skips the visual overlay — only the avatar audio is used as voice track.
  let videoOutLabel = scenes.length === 1 ? 'v0' : 'vout';
  if (globalAvatar && !globalAvatar.audioOnly) {
    if (globalAvatar.shape === 'split') {
      // Template #5 Magazine Editorial: 70/30 split — FLUX2 imagery dominates top 70%, avatar in bottom 30% (head+shoulders strip).
      // Captions live in the existing bottom band (~y=1660), painted over the avatar strip — editorial pull-quote style.
      const splitRatio = globalAvatar.splitRatio || 0.30;       // bottom 30% → avatar
      const avatarH    = Math.floor(height * splitRatio);
      filterParts.push(
        `[${avatarInputIdx}:v]scale=${width}:${avatarH}:force_original_aspect_ratio=increase,crop=${width}:${avatarH}[avatar_split]`
      );
      filterParts.push(
        `[${videoOutLabel}][avatar_split]overlay=x=0:y=${height - avatarH}:format=auto:eof_action=pass[vfinal]`
      );
      videoOutLabel = 'vfinal';
    } else {
      // Template #2 PiP — circular avatar top-left (default shape).
      const size       = globalAvatar.size       || 360;
      const marginLeft = globalAvatar.marginLeft || 60;
      const marginTop  = globalAvatar.marginTop  || 140;
      const r          = size / 2;
      filterParts.push(
        `[${avatarInputIdx}:v]scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(hypot(X-${r},Y-${r}),${r-2}),255,if(lt(hypot(X-${r},Y-${r}),${r}),255*(${r}-hypot(X-${r},Y-${r}))/2,0))'[avatar_circ]`
      );
      filterParts.push(
        `[${videoOutLabel}][avatar_circ]overlay=x=${marginLeft}:y=${marginTop}:format=auto:eof_action=pass[vfinal]`
      );
      videoOutLabel = 'vfinal';
    }
  }

  // Voice path: PiP uses the global avatar audio as the single voice. Hybrid uses per-scene HeyGen audio with delays.
  const sceneStarts = [];
  let acc = 0;
  scenes.forEach((s, i) => {
    sceneStarts.push(acc);
    acc += s.duration - (i < scenes.length - 1 ? XFADE_OVERLAP : 0);
  });

  let voiceLabel = null;
  if (globalAvatar) {
    filterParts.push(`[${avatarInputIdx}:a]volume=1.5,asetpts=PTS-STARTPTS[vavatar]`);
    voiceLabel = '[vavatar]';
  } else {
    const voiceLabels = [];
    scenes.forEach((s, i) => {
      if (!s.videoPath) return;
      const delayMs = Math.max(0, Math.round(sceneStarts[i] * 1000));
      const fadeOut = Math.min(XFADE_OVERLAP, s.duration / 4);
      const fadeOutStart = Math.max(0, s.duration - fadeOut).toFixed(2);
      filterParts.push(
        `[${i}:a]atrim=duration=${s.duration},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.05,afade=t=out:st=${fadeOutStart}:d=${fadeOut.toFixed(2)},adelay=${delayMs}|${delayMs},volume=1.6[va${i}]`
      );
      voiceLabels.push(`[va${i}]`);
    });
    if (voiceLabels.length === 1) voiceLabel = voiceLabels[0];
    else if (voiceLabels.length > 1) {
      filterParts.push(`${voiceLabels.join('')}amix=inputs=${voiceLabels.length}:duration=longest:dropout_transition=0:normalize=0[vall]`);
      voiceLabel = '[vall]';
    }
  }

  // Music: looped, full volume (sidechain compressor handles dynamic ducking when voice present).
  filterParts.push(`[${scenes.length}:a]volume=0.35,aloop=loop=-1:size=2e+09[amusic]`);

  if (!voiceLabel) {
    filterParts.push(`[amusic]anull[aout]`);
  } else {
    filterParts.push(`${voiceLabel}asplit=2[vsig][vtrigger]`);
    filterParts.push(`[amusic][vtrigger]sidechaincompress=threshold=0.04:ratio=8:attack=10:release=300:makeup=1[mducked]`);
    filterParts.push(`[vsig][mducked]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]`);
  }

  const filterComplex = filterParts.join(';');
  const totalDuration = scenes.reduce((t, s) => t + s.duration, 0) - XFADE_OVERLAP * (scenes.length - 1);

  args.push('-filter_complex', filterComplex);
  args.push('-map', `[${videoOutLabel}]`);
  args.push('-map', '[aout]');
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-level', '4.0', '-movflags', '+faststart');
  args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  args.push('-t', totalDuration.toFixed(2));
  args.push(outputPath);

  return { bin: 'ffmpeg', args };
}

export function runFfmpeg(cmd, { onStderr } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd.bin, cmd.args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderrBuf = '';
    proc.stderr.on('data', chunk => {
      const text = chunk.toString();
      stderrBuf += text;
      if (onStderr) onStderr(text);
    });
    proc.on('close', code => {
      if (code === 0) resolve({ stderr: stderrBuf });
      else {
        const lastLine = stderrBuf.trim().split('\n').pop() || 'ffmpeg failed';
        reject(new Error(`ffmpeg exit=${code}: ${lastLine}`));
      }
    });
    proc.on('error', reject);
  });
}
