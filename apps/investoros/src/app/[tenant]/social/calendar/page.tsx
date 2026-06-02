/**
 * /[tenant]/social/calendar — Social Media Content Calendar
 *
 * CC: deploy to apps/investoros/src/app/[tenant]/social/calendar/page.tsx
 *
 * Shows posts from Geo_Posts (tblBbSbpzzANl74y0) in a monthly calendar.
 * Posts with Status="Visual Listo" have Schedule + Publish Now buttons.
 * This UI is what Meta needs to see for App Review.
 */

'use client';
import { useState, useEffect } from 'react';

interface Post {
  id: string;
  title: string;
  caption: string;
  status: string;
  theme: string;
  visual_url: string;
  scheduled_for?: string;
  pillar: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Idea':         '#94a3b8',
  'Oraculo OK':   '#60a5fa',
  'Visual Listo': '#f59e0b',
  'Programado':   '#a78bfa',
  'Publicado':    '#22c55e',
  'Rechazada':    '#ef4444',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function SocialCalendar({ params }: { params: { tenant: string } }) {
  const [posts,     setPosts]     = useState<Post[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [today]                   = useState(new Date());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [selected,  setSelected]  = useState<Post | null>(null);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('14:00');
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState('');

  useEffect(() => {
    async function loadPosts() {
      try {
        const r = await fetch(`/api/${params.tenant}/social/posts`);
        const d = await r.json();
        setPosts(d.posts || []);
      } catch {
        // fallback: empty
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, [params.tenant]);

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function postsOnDay(day: number): Post[] {
    return posts.filter(p => {
      if (!p.scheduled_for) return false;
      const d = new Date(p.scheduled_for);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day;
    });
  }

  async function handleSchedule(post: Post) {
    if (!schedDate) { setToast('Pick a date first'); return; }
    setSaving(true);
    try {
      const scheduledFor = new Date(`${schedDate}T${schedTime}:00`).toISOString();
      const r = await fetch(`/api/${params.tenant}/social/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, scheduledFor, tableId: 'tblBbSbpzzANl74y0' }),
      });
      if (!r.ok) throw new Error('Schedule failed');
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, scheduled_for: scheduledFor, status: 'Programado' } : p));
      setToast(`✅ "${post.title}" scheduled for ${schedDate} at ${schedTime}`);
      setSelected(null);
    } catch (e) {
      setToast(`❌ ${String(e)}`);
    } finally {
      setSaving(false);
      setTimeout(() => setToast(''), 4000);
    }
  }

  async function handlePublishNow(post: Post) {
    setSaving(true);
    try {
      const r = await fetch(`/api/${params.tenant}/social/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, tableId: 'tblBbSbpzzANl74y0' }),
      });
      if (!r.ok) throw new Error('Publish failed');
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'Publicado' } : p));
      setToast(`✅ "${post.title}" published to Facebook!`);
      setSelected(null);
    } catch (e) {
      setToast(`❌ ${String(e)}`);
    } finally {
      setSaving(false);
      setTimeout(() => setToast(''), 4000);
    }
  }

  const unscheduled = posts.filter(p => p.status === 'Visual Listo' && !p.scheduled_for);

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#1a1a1a', color: '#fff', padding: '12px 20px', borderRadius: 10, zIndex: 9999, fontSize: 14 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Social Calendar</h1>
          <p style={{ fontSize: 14, color: '#666', margin: '4px 0 0' }}>{params.tenant}</p>
        </div>
        <a
          href={`/${params.tenant}/social/calendar`}
          style={{ background: '#1877f2', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
        >
          + New Post
        </a>
      </div>

      {/* Ready to schedule banner */}
      {unscheduled.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14 }}>
          <strong>⚡ {unscheduled.length} post(s) ready to schedule</strong> — images generated by Sofia, waiting for a date.
        </div>
      )}

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); }}
          style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 16 }}>‹</button>
        <span style={{ fontSize: 18, fontWeight: 600, minWidth: 160, textAlign: 'center' }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); }}
          style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 16 }}>›</button>
      </div>

      {/* Calendar grid */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          {DAYS.map(d => <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{d}</div>)}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: 80, background: '#fafafa', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayPosts = postsOnDay(day);
            const isToday = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
            return (
              <div key={day} style={{ minHeight: 80, padding: '6px', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', background: isToday ? '#eff6ff' : '#fff' }}>
                <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? '#1877f2' : '#374151', marginBottom: 4 }}>{day}</div>
                {dayPosts.map(p => (
                  <div key={p.id}
                    onClick={() => setSelected(p)}
                    style={{ background: STATUS_COLORS[p.status] || '#94a3b8', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#fff', marginBottom: 2, cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {p.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Unscheduled posts list */}
      {unscheduled.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Ready to Schedule ({unscheduled.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {unscheduled.map(post => (
              <div key={post.id}
                onClick={() => { setSelected(post); setSchedDate(''); }}
                style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                {post.visual_url && (
                  <img src={post.visual_url.split('|')[0]} alt={post.title}
                    style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                )}
                <div style={{ padding: '10px 12px' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: '#1a1a1a' }}>{post.title}</p>
                  <p style={{ fontSize: 11, color: '#666', margin: 0 }}>{post.pillar}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <span style={{ background: STATUS_COLORS[post.status] || '#94a3b8', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>{post.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 440, width: '90%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selected.title}</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>{selected.caption?.slice(0, 100)}...</p>

            {selected.visual_url && (
              <img src={selected.visual_url.split('|')[0]} alt={selected.title}
                style={{ width: '100%', borderRadius: 8, marginBottom: 20, maxHeight: 180, objectFit: 'cover' }} />
            )}

            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Date</label>
            <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }} />

            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Time (CT)</label>
            <select value={schedTime} onChange={e => setSchedTime(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }}>
              {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(t => (
                <option key={t} value={t}>{t} CT {t === '14:00' ? '(recommended)' : ''}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handleSchedule(selected)} disabled={saving || !schedDate}
                style={{ flex: 1, background: saving ? '#999' : '#1877f2', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Scheduling...' : '📅 Schedule'}
              </button>
              <button onClick={() => handlePublishNow(selected)} disabled={saving}
                style={{ flex: 1, background: saving ? '#999' : '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? '...' : '⚡ Publish Now'}
              </button>
              <button onClick={() => setSelected(null)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '12px 16px', cursor: 'pointer', fontSize: 14 }}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading posts...</div>}
    </div>
  );
}
