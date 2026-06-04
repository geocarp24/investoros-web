/**
 * Meta Graph API publisher — Facebook Pages + Instagram Business.
 *
 * Replaces Blotato (deprecated 2026-05-07 by Jorge). All publishing now goes
 * direct to Meta Graph API using the Page Access Token from /me/accounts.
 *
 * Required token scopes (token-side, not code-side):
 *   pages_manage_posts          — FB feed/Reels publishing
 *   pages_read_engagement       — read post insights
 *   instagram_basic             — IG account discovery
 *   instagram_content_publish   — IG Reels/carousel publishing
 *
 * IG container model: container creation is async — must poll status_code=FINISHED
 * before calling /media_publish. FB Reels uses 3-phase upload (start → upload → finish).
 */

const API_VERSION = 'v21.0';
const GRAPH_BASE  = `https://graph.facebook.com/${API_VERSION}`;

// ───────────────────────────────────────────────────────────────────────
// Facebook
// ───────────────────────────────────────────────────────────────────────

/**
 * Publish a single image or carousel post to a Facebook Page feed — PRECISION LIVE.
 *
 * Strategy 2026-06-01 (Jorge approved): publishes LIVE immediately, no scheduling.
 * The cron schedule itself acts as the scheduler — the agent runs at the exact slot
 * desired (e.g. Tue 10:00 UTC) and publishes live in that second.
 *
 * Why not scheduled_publish_time:
 *   Posts created via Graph API with scheduled_publish_time DO NOT appear in
 *   Meta Business Suite Planner UI unless the app passed Meta App Review with
 *   "Social Media Management" use case. Until app review is complete, scheduled
 *   posts are invisible to clients, breaking visibility-first principle.
 *
 * See: memory/feedback_visibility_first_saas.md
 * App Review path: docs/META_APP_REVIEW_GEO.md (to be submitted)
 *
 * Output: post appears IMMEDIATELY in:
 *   - Business Suite → Content → Posts & reels → Published tab ✅
 *   - Public Page feed ✅
 *   - Page Insights ✅
 *   - Mobile FB app feed ✅
 */
export async function publishFacebookPhotoPost({ pageId, pageAccessToken, imageUrls, caption }) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) throw new Error('imageUrls required');

  // Step 1: upload each photo as unpublished → media_fbid
  const photoIds = [];
  for (const url of imageUrls) {
    const r = await fetch(`${GRAPH_BASE}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, published: false, access_token: pageAccessToken }),
    });
    const data = await r.json();
    if (!data.id) throw new Error(`FB photo upload failed: ${JSON.stringify(data).slice(0,200)}`);
    photoIds.push(data.id);
  }

  // Step 2: POST /<page>/feed with attached_media — published LIVE immediately.
  const feed = await fetch(`${GRAPH_BASE}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: caption,
      attached_media: photoIds.map(id => ({ media_fbid: id })),
      access_token: pageAccessToken,
    }),
  });
  return feed.json();
}

/**
 * Publish a Reel to Facebook Page using the 3-phase video_reels endpoint.
 * Phase 1: start (returns video_id + upload_url)
 * Phase 2: upload from a remote file_url (no local stream needed since Cloudinary hosts it)
 * Phase 3: finish with video_state=PUBLISHED (or SCHEDULED with publish_time)
 */
export async function publishFacebookReel({ pageId, pageAccessToken, videoUrl, caption, scheduledPublishTime }) {
  // Phase 1: start
  const startRes = await fetch(`${GRAPH_BASE}/${pageId}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_phase: 'start', access_token: pageAccessToken }),
  });
  const start = await startRes.json();
  if (!start.video_id) throw new Error(`FB Reels start failed: ${JSON.stringify(start).slice(0,200)}`);

  // Phase 2: upload by URL (Meta fetches the file from Cloudinary).
  const uploadRes = await fetch(`https://rupload.facebook.com/video-upload/${API_VERSION}/${start.video_id}`, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${pageAccessToken}`,
      'file_url': videoUrl,
    },
  });
  const upload = await uploadRes.json().catch(() => ({}));
  if (!upload.success) throw new Error(`FB Reels upload failed: ${JSON.stringify(upload).slice(0,200)}`);

  // Phase 3: finish
  const finishBody = {
    upload_phase: 'finish',
    video_id: start.video_id,
    video_state: scheduledPublishTime ? 'SCHEDULED' : 'PUBLISHED',
    description: caption,
    access_token: pageAccessToken,
  };
  if (scheduledPublishTime) finishBody.scheduled_publish_time = scheduledPublishTime;
  const finishRes = await fetch(`${GRAPH_BASE}/${pageId}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finishBody),
  });
  const finish = await finishRes.json();
  return { video_id: start.video_id, ...finish };
}

// ───────────────────────────────────────────────────────────────────────
// Instagram
// ───────────────────────────────────────────────────────────────────────

/**
 * Resolve the IG Business Account ID from the FB Page.
 * Cached at runner level — call once per process.
 */
export async function getInstagramUserId({ pageId, pageAccessToken }) {
  const r = await fetch(`${GRAPH_BASE}/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(pageAccessToken)}`);
  const data = await r.json();
  return data?.instagram_business_account?.id || null;
}

/**
 * Wait until an IG container reports status_code=FINISHED. Throws on ERROR.
 */
async function pollContainerReady(containerId, accessToken, { maxSec = 180, intervalSec = 5 } = {}) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxSec) {
    const r = await fetch(`${GRAPH_BASE}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`);
    const data = await r.json();
    if (data.status_code === 'FINISHED') return data;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`IG container ${containerId} ${data.status_code}: ${data.status || ''}`);
    }
    await new Promise(res => setTimeout(res, intervalSec * 1000));
  }
  throw new Error(`IG container ${containerId} poll timeout after ${maxSec}s`);
}

/**
 * Publish a Reel to Instagram via the 2-step container model.
 * Step 1: create REELS container with the Cloudinary video_url.
 * Step 2: poll container until FINISHED.
 * Step 3: media_publish to actually post.
 */
export async function publishInstagramReel({ igUserId, pageAccessToken, videoUrl, caption }) {
  const containerRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'REELS', video_url: videoUrl, caption, access_token: pageAccessToken }),
  });
  const container = await containerRes.json();
  if (!container.id) throw new Error(`IG container create failed: ${JSON.stringify(container).slice(0,200)}`);

  await pollContainerReady(container.id, pageAccessToken);

  const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: pageAccessToken }),
  });
  const published = await publishRes.json();
  if (!published.id) throw new Error(`IG publish failed: ${JSON.stringify(published).slice(0,200)}`);
  return { creation_id: container.id, media_id: published.id };
}

/**
 * Publish a carousel (2-10 images) to Instagram. Each image becomes a child container
 * with is_carousel_item=true; then a parent CAROUSEL container groups them.
 */
export async function publishInstagramCarousel({ igUserId, pageAccessToken, imageUrls, caption }) {
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error(`IG carousel needs 2-10 images, got ${imageUrls.length}`);
  }

  const childIds = [];
  for (const url of imageUrls) {
    const r = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: pageAccessToken }),
    });
    const data = await r.json();
    if (!data.id) throw new Error(`IG carousel child failed: ${JSON.stringify(data).slice(0,200)}`);
    childIds.push(data.id);
  }

  const parentRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption,
      access_token: pageAccessToken,
    }),
  });
  const parent = await parentRes.json();
  if (!parent.id) throw new Error(`IG carousel parent failed: ${JSON.stringify(parent).slice(0,200)}`);

  await pollContainerReady(parent.id, pageAccessToken);

  const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: parent.id, access_token: pageAccessToken }),
  });
  const published = await publishRes.json();
  if (!published.id) throw new Error(`IG carousel publish failed: ${JSON.stringify(published).slice(0,200)}`);
  return { creation_id: parent.id, media_id: published.id };
}

/**
 * Publish a single image to Instagram (regular post, not carousel).
 */
export async function publishInstagramImage({ igUserId, pageAccessToken, imageUrl, caption }) {
  const containerRes = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: pageAccessToken }),
  });
  const container = await containerRes.json();
  if (!container.id) throw new Error(`IG image container failed: ${JSON.stringify(container).slice(0,200)}`);

  await pollContainerReady(container.id, pageAccessToken);

  const publishRes = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: pageAccessToken }),
  });
  const published = await publishRes.json();
  if (!published.id) throw new Error(`IG image publish failed: ${JSON.stringify(published).slice(0,200)}`);
  return { creation_id: container.id, media_id: published.id };
}

/**
 * Resolve Page Access Token from a User Access Token via /me/accounts.
 * The Page Access Token has a longer effective scope on the Page than the user token.
 */
export async function getPageAccessToken({ userAccessToken, pageId }) {
  const r = await fetch(`${GRAPH_BASE}/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(userAccessToken)}`);
  const data = await r.json();
  const page = (data.data || []).find(p => String(p.id) === String(pageId));
  return page?.access_token || null;
}
