/**
 * /onboard/connect-facebook — Meta OAuth onboarding page
 *
 * CC: deploy to apps/investoros/src/app/onboard/connect-facebook/page.tsx
 *
 * Flow:
 * 1. User clicks "Connect Facebook Page"
 * 2. Redirect to Meta OAuth dialog
 * 3. Callback at /api/auth/facebook/callback exchanges code → token
 * 4. Lists user's Pages → user selects Geo Carpentry page
 * 5. Seeds page_access_token to vault via internal API
 * 6. Redirects to /settings/connections showing "✅ Connected"
 */

'use client';
import { useState } from 'react';

const FB_APP_ID      = '3291485027720361';
const REDIRECT_URI   = 'https://www.investoros.tech/api/auth/facebook/callback';
const SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_manage_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'read_insights',
  'business_management',
].join(',');

export default function ConnectFacebookPage() {
  const [connecting, setConnecting] = useState(false);

  function handleConnect() {
    setConnecting(true);
    // Generate state for CSRF
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('fb_oauth_state', state);

    const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    url.searchParams.set('client_id',     FB_APP_ID);
    url.searchParams.set('redirect_uri',  REDIRECT_URI);
    url.searchParams.set('scope',         SCOPES);
    url.searchParams.set('state',         state);
    url.searchParams.set('response_type', 'code');

    window.location.href = url.toString();
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '48px 40px', maxWidth: 480, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>

        {/* FB Icon */}
        <div style={{ width: 64, height: 64, background: '#1877f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32, color: '#fff', fontWeight: 800 }}>f</div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>Connect Your Facebook Page</h1>
        <p style={{ color: '#666', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          InvestorOS will request permission to manage posts, view insights, and schedule content on your Facebook Page and connected Instagram account.
        </p>

        {/* Permissions list */}
        <div style={{ background: '#f0f7ff', borderRadius: 10, padding: '16px 20px', textAlign: 'left', marginBottom: 32 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1877f2', marginBottom: 10 }}>Permissions requested:</p>
          {[
            '✓ Manage and publish posts to your Page',
            '✓ Read engagement & Page insights',
            '✓ Publish to connected Instagram account',
            '✓ View Instagram insights',
            '✓ List pages you manage',
          ].map((item, i) => (
            <p key={i} style={{ fontSize: 13, color: '#333', margin: '4px 0' }}>{item}</p>
          ))}
        </div>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{
            background: connecting ? '#999' : '#1877f2',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '14px 32px', fontSize: 16, fontWeight: 600,
            cursor: connecting ? 'not-allowed' : 'pointer',
            width: '100%', transition: 'background 0.2s',
          }}
        >
          {connecting ? 'Redirecting to Facebook...' : 'Continue with Facebook'}
        </button>

        <p style={{ fontSize: 12, color: '#999', marginTop: 20, lineHeight: 1.5 }}>
          By connecting, you agree to our{' '}
          <a href="/terms" style={{ color: '#1877f2' }}>Terms of Service</a> and{' '}
          <a href="/privacy" style={{ color: '#1877f2' }}>Privacy Policy</a>.
          You can disconnect at any time from Settings.
        </p>
      </div>
    </div>
  );
}
