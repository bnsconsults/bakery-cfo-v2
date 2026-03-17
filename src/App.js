import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './components/AuthContext'
import { supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import Today from './pages/Today'
import Recipes from './pages/Recipes'
import Production from './pages/Production'
import Suppliers from './pages/Suppliers'

const ADMIN_EMAIL = 'nabasingabeth@gmail.com'
const TRIAL_DAYS = 7

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1A0E08; font-family: 'DM Sans', sans-serif; color: #FDF6EC; }
  input, select, button, textarea { font-family: 'DM Sans', sans-serif; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #C8862A !important; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(200,134,42,0.3); border-radius: 99px; }
  option { background: #2A1A10; color: #FDF6EC; }
`

const NAV = [
  { id: 'today',      icon: '🏠', label: 'Today',            section: 'DAILY'      },
  { id: 'recipes',    icon: '🍞', label: 'Recipe Costing',   section: 'KITCHEN'    },
  { id: 'production', icon: '📋', label: 'Production Plan',  section: 'KITCHEN'    },
  { id: 'inventory',  icon: '📦', label: 'Inventory',        section: 'KITCHEN'    },
  { id: 'suppliers',  icon: '🛒', label: 'Suppliers',        section: 'BUSINESS'   },
  { id: 'staff',      icon: '👩‍🍳', label: 'Staff & Labor',   section: 'BUSINESS'   },
  { id: 'cashflow',   icon: '💳', label: 'Cash Flow',        section: 'FINANCE'    },
  { id: 'reports',    icon: '📊', label: 'Reports',          section: 'FINANCE'    },
]

function Inner() {
  const { user, loading, signOut } = useAuth()
  const [page, setPage] = useState('today')
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [subLoading, setSubLoading] = useState(true)
  const isAdmin = user?.email === ADMIN_EMAIL

  useEffect(() => {
    if (user) { loadProfile(); checkSubscription() }
    else setSubLoading(false)
  }, [user])

  const loadProfile = async () => {
    const { data } = await supabase.from('bakery_profile').select('*').eq('user_id', user.id).single()
    setProfile(data)
  }

  const checkSubscription = async () => {
    if (user.email === ADMIN_EMAIL) { setSubscription({ status: 'active' }); setSubLoading(false); return }
    const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).single()
    if (data) { setSubscription(data) }
    else {
      const exp = new Date(); exp.setDate(exp.getDate() + TRIAL_DAYS)
      const newSub = { user_id: user.id, email: user.email, status: 'trial', expires_at: exp.toISOString() }
      await supabase.from('subscriptions').insert(newSub)
      setSubscription(newSub)
    }
    setSubLoading(false)
  }

  if (loading || subLoading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 32 }}>🧁</div>
      <div style={{ color: 'rgba(253,246,236,0.4)', fontSize: 14 }}>Loading Bakery CFO...</div>
    </div>
  )

  if (!user) return <AuthPage />

  const hasAccess = () => {
    if (isAdmin) return true
    if (!subscription) return false
    if (subscription.status === 'active' || subscription.status === 'trial')
      return new Date(subscription.expires_at) > new Date()
    return false
  }

  const daysLeft = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0

  if (!hasAccess()) return <Paywall user={user} signOut={signOut} />

  const sections = [...new Set(NAV.map(n => n.section))]
  const onTrial = subscription?.status === 'trial'

  const renderPage = () => {
    switch (page) {
      case 'today':      return <Today onNavigate={setPage} />
      case 'recipes':    return <Recipes />
      case 'production': return <Production />
      case 'suppliers':  return <Suppliers />
      default: return (
        <div style={comingSoon}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🔨</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: '#F0C040', marginBottom: 8 }}>Coming Soon</div>
          <div style={{ fontSize: 13, color: 'rgba(253,246,236,0.4)', lineHeight: 1.7 }}>This module is being built and will be available shortly.</div>
        </div>
      )
    }
  }

  return (
    <div style={st.app}>
      <div style={st.sidebar}>
        <div style={st.brand}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🧁</div>
          <div style={st.brandName}>Bakery CFO</div>
          <div style={st.brandSub}>V2 · COMMAND CENTER</div>
          <div style={st.bakeryName}>{profile?.bakery_name || 'My Bakery'}</div>
          {onTrial && <div style={st.trialBadge}>{daysLeft}d trial left</div>}
          {!onTrial && !isAdmin && <div style={st.activeBadge}>✅ Active</div>}
          {isAdmin && <div style={st.adminBadge}>👑 Admin</div>}
        </div>

        {sections.map(sec => (
          <div key={sec} style={st.navSection}>
            <div style={st.navLabel}>{sec}</div>
            {NAV.filter(n => n.section === sec).map(n => (
              <div key={n.id} style={{ ...st.navItem, ...(page === n.id ? st.navActive : {}) }} onClick={() => setPage(n.id)}>
                <span style={{ width: 18, textAlign: 'center', fontSize: 14 }}>{n.icon}</span>
                <span>{n.label}</span>
              </div>
            ))}
          </div>
        ))}

        <div style={st.footer}>
          <div style={st.userEmail}>{user.email}</div>
          <button onClick={signOut} style={st.signOutBtn}>Sign Out</button>
          <div style={{ fontSize: 9, color: 'rgba(253,246,236,0.2)', marginTop: 6, textAlign: 'center' }}>Bakery CFO V2 · Uganda 🇺🇬</div>
        </div>
      </div>

      <div style={st.main}>
        {onTrial && daysLeft <= 3 && (
          <div style={st.trialBanner}>
            ⚠️ Trial expires in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>. Send UGX 50,000 via Mobile Money to continue.
          </div>
        )}
        <div style={st.topbar}>
          <div style={st.pageTitle}>{NAV.find(n => n.id === page)?.label || 'Today'}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={st.liveTag}>🟢 LIVE</div>
            <button style={st.todayBtn} onClick={() => setPage('today')}>🏠 Today</button>
          </div>
        </div>
        <div style={st.content}>{renderPage()}</div>
      </div>
    </div>
  )
}

function Paywall({ user, signOut }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A0E08', padding: 20 }}>
      <div style={{ background: '#3D2B1F', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 20, padding: '36px 32px', maxWidth: 460, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧁</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: '#F0C040', marginBottom: 6 }}>Bakery CFO</div>
        <div style={{ fontSize: 12, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginBottom: 20 }}>TRIAL EXPIRED</div>
        <div style={{ fontSize: 13, color: 'rgba(253,246,236,0.6)', marginBottom: 24, lineHeight: 1.7 }}>Your free trial has ended. Subscribe to keep accessing your bakery data.</div>
        <div style={{ background: 'rgba(26,14,8,0.6)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 14, padding: '20px', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: '#F0C040', marginBottom: 4 }}>UGX 50,000<span style={{ fontSize: 14, color: 'rgba(253,246,236,0.5)' }}>/month</span></div>
          <div style={{ fontSize: 12, color: 'rgba(253,246,236,0.5)' }}>Full access to all modules</div>
        </div>
        <div style={{ background: 'rgba(200,134,42,0.08)', border: '1px solid rgba(200,134,42,0.2)', borderRadius: 10, padding: 16, textAlign: 'left', marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 10 }}>HOW TO SUBSCRIBE</div>
          {['Send UGX 50,000 via MTN or Airtel Money', 'Number: +256 XXX XXX XXX', 'WhatsApp your payment confirmation', 'We activate within 1 hour'].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 13, color: 'rgba(253,246,236,0.7)' }}>
              <span style={{ background: '#C8862A', color: '#1A0E08', borderRadius: '50%', width: 20, height: 20, minWidth: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{i + 1}</span>
              {step}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(253,246,236,0.3)', marginBottom: 14 }}>Signed in as {user.email}</div>
        <button onClick={signOut} style={{ background: 'transparent', color: 'rgba(253,246,236,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 20px', fontSize: 12, cursor: 'pointer' }}>Sign Out</button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <style>{globalCSS}</style>
      <Inner />
    </AuthProvider>
  )
}

const st = {
  app: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebar: { width: 220, minWidth: 220, background: '#2A1A10', borderRight: '1px solid rgba(200,134,42,0.2)', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  brand: { padding: '20px 16px 16px', borderBottom: '1px solid rgba(200,134,42,0.2)' },
  brandName: { fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 900, color: '#F0C040' },
  brandSub: { fontSize: 8, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginTop: 1 },
  bakeryName: { fontSize: 11, color: 'rgba(253,246,236,0.5)', marginTop: 6 },
  trialBadge: { display: 'inline-block', marginTop: 6, background: 'rgba(125,191,173,0.2)', color: '#7DBFAD', border: '1px solid rgba(125,191,173,0.3)', borderRadius: 20, padding: '2px 9px', fontSize: 9, fontFamily: "'DM Mono', monospace" },
  activeBadge: { display: 'inline-block', marginTop: 6, background: 'rgba(90,158,111,0.2)', color: '#90D0A0', border: '1px solid rgba(90,158,111,0.3)', borderRadius: 20, padding: '2px 9px', fontSize: 9, fontFamily: "'DM Mono', monospace" },
  adminBadge: { display: 'inline-block', marginTop: 6, background: 'rgba(240,192,64,0.2)', color: '#F0C040', border: '1px solid rgba(240,192,64,0.3)', borderRadius: 20, padding: '2px 9px', fontSize: 9, fontFamily: "'DM Mono', monospace" },
  navSection: { padding: '10px 8px 0' },
  navLabel: { fontSize: 8, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 2, padding: '0 8px', marginBottom: 2 },
  navItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, color: 'rgba(253,246,236,0.55)', marginBottom: 1, border: '1px solid transparent' },
  navActive: { background: 'rgba(200,134,42,0.2)', color: '#F0C040', borderColor: 'rgba(200,134,42,0.3)' },
  footer: { marginTop: 'auto', padding: 12, borderTop: '1px solid rgba(200,134,42,0.15)' },
  userEmail: { fontSize: 9, color: 'rgba(253,246,236,0.3)', wordBreak: 'break-all', marginBottom: 8 },
  signOutBtn: { width: '100%', padding: '7px', background: 'rgba(214,79,59,0.1)', color: '#F08070', border: '1px solid rgba(214,79,59,0.2)', borderRadius: 6, cursor: 'pointer', fontSize: 11 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  trialBanner: { background: 'rgba(200,134,42,0.15)', borderBottom: '1px solid rgba(200,134,42,0.3)', padding: '9px 24px', fontSize: 12, color: '#F0C040', flexShrink: 0 },
  topbar: { background: 'rgba(26,14,8,0.95)', borderBottom: '1px solid rgba(200,134,42,0.2)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  pageTitle: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: '#FDF6EC' },
  liveTag: { fontSize: 10, color: '#90D0A0', fontFamily: "'DM Mono', monospace" },
  todayBtn: { background: 'rgba(200,134,42,0.2)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  content: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
}

const comingSoon = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, textAlign: 'center' }
