/**
 * publisher_helpers.mjs — pure functions extracted from social_media.mjs
 * for testability. Used by processPosts to decide what to publish where.
 *
 * Approved by Jorge 2026-05-08. Sprint A1.2+A1.3.
 */
import { STATUS } from "../_shared/sm_tables.mjs";

const VALID_PLATFORMS = Object.freeze(["FB", "IG"]);
const VALID_FORMATS = Object.freeze(["Post", "Reel", "Video"]);

/**
 * Build the Airtable filterByFormula query for the publisher.
 *
 * Always filters: {visual_url}!='' AND {Status}='Visual Listo'.
 * Optionally narrows by Target_Platform and Format.
 *
 * @param {object} opts
 * @param {"FB"|"IG"|null} [opts.targetPlatform=null]
 * @param {"Post"|"Reel"|"Video"|null} [opts.targetFormat=null]
 * @param {string} [opts.status=STATUS.VISUAL_LISTO]
 * @returns {string} the raw (un-encoded) filter formula
 */
export function buildPublisherFilter({
  targetPlatform = null,
  targetFormat = null,
  status = STATUS.VISUAL_LISTO,
} = {}) {
  if (targetPlatform !== null && !VALID_PLATFORMS.includes(targetPlatform)) {
    throw new Error(`invalid targetPlatform: ${targetPlatform}`);
  }
  if (targetFormat !== null && !VALID_FORMATS.includes(targetFormat)) {
    throw new Error(`invalid targetFormat: ${targetFormat}`);
  }
  const parts = [`{visual_url}!=''`, `{Status}='${status}'`];
  if (targetPlatform) parts.push(`{Target_Platform}='${targetPlatform}'`);
  if (targetFormat) parts.push(`{Format}='${targetFormat}'`);
  return `AND(${parts.join(", ")})`;
}

/**
 * Returns the Airtable field name where the published media ID is stored
 * for the given platform.
 */
export function selectFieldPublishedId(platform) {
  if (platform === "FB") return "Published_FB_ID";
  if (platform === "IG") return "Published_IG_ID";
  throw new Error(`invalid platform: ${platform}`);
}

/**
 * Decide which publish function to call based on platform + format + isVideo.
 *
 * Returns the function name (string). The caller resolves the actual function
 * by name from the imported graph_api module — keeps this helper free of
 * import side effects, making it easily testable.
 *
 * Format rules:
 *   FB + Reel        → publishFacebookReel
 *   FB + Post/Video  → publishFacebookReel if isVideo, else publishFacebookPhotoPost
 *   IG + Reel        → publishInstagramReel
 *   IG + Post/Video  → publishInstagramReel if isVideo, else publishInstagramImage
 */
export function selectPublisherFn(platform, format, isVideo) {
  if (!VALID_PLATFORMS.includes(platform)) throw new Error(`invalid platform: ${platform}`);
  if (!VALID_FORMATS.includes(format)) throw new Error(`invalid format: ${format}`);

  if (platform === "FB") {
    if (format === "Reel" || isVideo) return "publishFacebookReel";
    return "publishFacebookPhotoPost";
  }
  // IG
  if (format === "Reel" || isVideo) return "publishInstagramReel";
  return "publishInstagramImage";
}

/**
 * Detect whether a media URL points to a video (used to switch between
 * photo/reel publishers when format isn't explicitly "Reel").
 */
export function isVideoUrl(url) {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url || "");
}

/**
 * Validate publisher CLI args. Returns { ok, errors }.
 *
 * In production the publisher REQUIRES targetPlatform and targetFormat — each
 * cron entry corresponds to a specific slot, so missing args means the cron is
 * misconfigured.
 *
 * Backwards-compat note: legacy invocations without args were the cause of the
 * 6:05/6:06/6:06 PM bug. The new contract is strict.
 */
export function validatePublisherArgs({ targetPlatform, targetFormat } = {}) {
  const errors = [];
  if (!targetPlatform) errors.push("targetPlatform is required (FB | IG)");
  else if (!VALID_PLATFORMS.includes(targetPlatform)) errors.push(`invalid targetPlatform: ${targetPlatform}`);
  if (!targetFormat) errors.push("targetFormat is required (Post | Reel | Video)");
  else if (!VALID_FORMATS.includes(targetFormat)) errors.push(`invalid targetFormat: ${targetFormat}`);
  return { ok: errors.length === 0, errors };
}

export const _internal = Object.freeze({ VALID_PLATFORMS, VALID_FORMATS });
