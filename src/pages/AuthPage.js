import { useState } from 'react'
import { useAuth } from '../components/AuthContext'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', bakeryName: '', ownerName: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null); setMsg(null)
    if (mode === 'login') {
      const { error } = await signIn(form.email, form.password)
      if (error) setError(error.message)
    } else {
      const { error } = await signUp(form.email, form.password, form.bakeryName, form.ownerName)
      if (error) setError(error.message)
      else setMsg('Account created! Check your email to confirm, then log in.')
    }
    setLoading(false)
  }

  return (
    <div style={s.wrap}>
      <div style={s.box}>
        <div style={s.logo}>🧁</div>
        <div style={s.brand}>Bakery CFO</div>
        <div style={s.tagline}>Smart operations & finance for bakery owners</div>

        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(mode === 'login' ? s.tabActive : {}) }} onClick={() => setMode('login')}>Log In</button>
          <button style={{ ...s.tab, ...(mode === 'signup' ? s.tabActive : {}) }} onClick={() => setMode('signup')}>Sign Up</button>
        </div>

        <form onSubmit={handle}>
          {mode === 'signup' && (
            <>
              <F label="BAKERY NAME" placeholder="e.g. Nana's Bakery" value={form.bakeryName} onChange={v => setForm({ ...form, bakeryName: v })} required />
              <F label="YOUR NAME" placeholder="e.g. Nana Nakato" value={form.ownerName} onChange={v => setForm({ ...form, ownerName: v })} />
            </>
          )}
          <F label="EMAIL ADDRESS" type="email" placeholder="you@example.com" value={form.email} onChange={v => setForm({ ...form, email: v })} required />
          <F label="PASSWORD" type="password" placeholder="••••••••" value={form.password} onChange={v => setForm({ ...form, password: v })} required />

          {error && <div style={s.error}>{error}</div>}
          {msg && <div style={s.success}>{msg}</div>}

          <button type="submit" style={s.btn} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Log In →' : 'Create My Bakery Account →'}
          </button>
        </form>

        {mode === 'signup' && (
          <div style={s.trial}>🎉 7-day free trial — no payment required to start</div>
        )}

        <div style={s.footer}>The complete financial & operations system built for bakery owners in Uganda 🇺🇬</div>
      </div>
    </div>
  )
}

const F = ({ label, type = 'text', value, onChange, placeholder, required }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={s.label}>{label}</label>
    <input style={s.input} type={type} value={value} placeholder={placeholder} required={required}
      onChange={e => onChange(e.target.value)} />
  </div>
)

const s = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A0E08', padding: 20 },
  box: { background: '#3D2B1F', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 20, padding: '36px 32px', maxWidth: 420, width: '100%' },
  logo: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  brand: { fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: '#F0C040', textAlign: 'center' },
  tagline: { fontSize: 13, color: 'rgba(253,246,236,0.5)', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 },
  tabs: { display: 'flex', background: 'rgba(26,14,8,0.5)', borderRadius: 10, padding: 4, marginBottom: 24, border: '1px solid rgba(200,134,42,0.2)' },
  tab: { flex: 1, padding: '8px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 14, fontWeight: 600, background: 'transparent', color: 'rgba(253,246,236,0.45)', fontFamily: "'DM Sans', sans-serif" },
  tabActive: { background: '#C8862A', color: '#1A0E08' },
  label: { display: 'block', fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5 },
  input: { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 8, color: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", fontSize: 14, boxSizing: 'border-box' },
  btn: { width: '100%', padding: '13px', background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8, fontFamily: "'DM Sans', sans-serif" },
  error: { background: 'rgba(214,79,59,0.15)', border: '1px solid rgba(214,79,59,0.3)', color: '#F08070', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  success: { background: 'rgba(90,158,111,0.15)', border: '1px solid rgba(90,158,111,0.3)', color: '#90D0A0', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  trial: { textAlign: 'center', fontSize: 12, color: '#90D0A0', marginTop: 16 },
  footer: { textAlign: 'center', fontSize: 11, color: 'rgba(253,246,236,0.25)', marginTop: 20, lineHeight: 1.6 },
}
