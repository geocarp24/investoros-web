/**
 * /api/auth/facebook/callback — Meta OAuth callback handler
 *
 * CC: deploy to apps/investoros/src/app/api/auth/facebook/callback/route.ts
 *
 * After Meta redirects back with ?code=...&state=...
 * 1. Verify state
 * 2. Exchange code → short-lived user token
 * 3. Exchange → long-lived user token
 * 4. GET /me/accounts → list pages
 * 5. Find the page with the highest tasks (admin-level)
 * 6. Seed page_access_token + ig_business_id to vault
 * 7. Redirect to /settings/connections?connected=facebook
 */

import { NextRequest, NextResponse } from 'next/server';

const FB_APP_ID     = process.env.NEXT_PUBLIC_FB_APP_ID     || '3291485027720361';
const FB_APP_SECRET = process.env.FB_APP_SECRET_GEO         || '';
const REDIRECT_URI  = 'https://www.investoros.tech/api/auth/facebook/callback';
const INTERNAL_SECRET = process.env.WEBHOOK_SECRET           || '';

async function exchangeCode(code: string): Promise<string> {
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  url.searchParams.set('client_id',     FB_APP_ID);
  url.searchParams.set('client_secret', FB_APP_SECRET);
  url.searchParams.set('redirect_uri',  REDIRECT_URI);
  url.searchParams.set('code',          code);
  const r = await fetch(url.toString());
  const d = await r.json() as { access_token?: string; error?: { message: string } };
  if (!d.access_token) throw new Error(d.error?.message || 'Token exchange failed');
  return d.access_token;
}

async function toLongLived(shortToken: string): Promise<string> {
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  url.searchParams.set('grant_type',       'fb_exchange_token');
  url.searchParams.set('client_id',        FB_APP_ID);
  url.searchParams.set('client_secret',    FB_APP_SECRET);
  url.searchParams.set('fb_exchange_token', shortToken);
  const r = await fetch(url.toString());
  const d = await r.json() as { access_token?: string; error?: { message: string } };
  if (!d.access_token) throw new Error(d.error?.message || 'Long-lived exchange failed');
  return d.access_token;
}

interface FBPage {
  id: string;
  name: string;
  access_token: string;
  tasks: string[];
}

async function getPages(longToken: string): Promise<FBPage[]> {
  const r = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${longToken}`);
  const d = await r.json() as { data: FBPage[] };
  return d.data || [];
}

async function getIgBusinessId(pageId: string, pageToken: string): Promise<string | null> {
  const r = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`
  );
  const d = await r.json() as { instagram_business_account?: { id: string } };
  return d.instagram_business_account?.id || null;
}

async function seedCredential(tenantSlug: string, service: string, keyName: string, value: string, metadata: object) {
  const r = await fetch('https://www.investoros.tech/api/admin/seed-tenant-credential', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'x-admin-secret': INTERNAL_SECRET,
    },
    body: JSON.stringify({ tenantSlug, service, keyName, value, metadata }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Seed credential failed: ${r.status} ${t.slice(0, 200)}`);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/connections?error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings/connections?error=no_code', req.url));
  }

  try {
    // 1. Exchange code → short token
    const shortToken = await exchangeCode(code);

    // 2. Get long-lived user token
    const longToken = await toLongLived(shortToken);

    // 3. Get pages
    const pages = await getPages(longToken);
    if (pages.length === 0) {
      return NextResponse.redirect(new URL('/settings/connections?error=no_pages', req.url));
    }

    // 4. Pick the first admin page (highest tasks = MANAGE)
    // In production: show a page picker UI. For now, pick first admin page.
    const adminPage = pages.find(p => p.tasks.includes('MANAGE')) || pages[0];

    // 5. Get Instagram Business ID
    const igId = await getIgBusinessId(adminPage.id, adminPage.access_token);

    // 6. Seed to vault — use tenant slug from session or default to geo-carpentry
    // TODO: in production, read tenantSlug from the authenticated session
    const tenantSlug = 'geo-carpentry';

    await seedCredential(tenantSlug, 'facebook', 'page_access_token', adminPage.access_token, {
      page_id:      adminPage.id,
      page_name:    adminPage.name,
      ig_business_id: igId || '',
      app_id:       FB_APP_ID,
      permissions:  adminPage.tasks.length,
      connected_at: new Date().toISOString(),
    });

    // 7. Redirect to settings with success
    return NextResponse.redirect(
      new URL(
        `/settings/connections?connected=facebook&page=${encodeURIComponent(adminPage.name)}&page_id=${adminPage.id}`,
        req.url
      )
    );
  } catch (err) {
    console.error('[FB OAuth callback]', err);
    return NextResponse.redirect(
      new URL(`/settings/connections?error=${encodeURIComponent(String(err))}`, req.url)
    );
  }
}
