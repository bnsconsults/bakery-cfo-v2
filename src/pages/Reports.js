import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

export default function Reports() {
  const { user } = useAuth()
  const [tab, setTab] = useState('ai')
  const [summaries, setSummaries] = useState([])
  const [recipes, setRecipes] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [sumRes, recRes, ingRes, staffRes] = await Promise.all([
      supabase.from('daily_summary').select('*').eq('user_id', user.id).order('summary_date', { ascending: false }).limit(30),
      supabase.from('recipes').select('*').eq('user_id', user.id),
      supabase.from('ingredients').select('*').eq('user_id', user.id),
      supabase.from('staff').select('*').eq('user_id', user.id)
    ])
    setSummaries(sumRes.data || [])
    setRecipes(recRes.data || [])
    setIngredients(ingRes.data || [])
    setStaff(staffRes.data || [])
    setLoading(false)
  }

  const totalRevenue = summaries.reduce((a, d) => a + (d.total_revenue || 0), 0)
  const totalNet = summaries.reduce((a, d) => a + (d.net_profit || 0), 0)
  const avgMargin = summaries.length > 0 ? (summaries.reduce((a, d) => a + (d.gross_margin || 0), 0) / summaries.length).toFixed(1) : 0
  const lowStock = ingredients.filter(i => i.stock <= i.reorder_level)

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>📊 Reports & AI Assistant</div>
        <div style={s.badge}>INSIGHTS</div>
      </div>

      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(tab === 'ai' ? s.tabActive : {}) }} onClick={() => setTab('ai')}>🤖 AI Assistant</button>
        <button style={{ ...s.tab, ...(tab === 'weekly' ? s.tabActive : {}) }} onClick={() => setTab('weekly')}>📅 Weekly Report</button>
        <button style={{ ...s.tab, ...(tab === 'insights' ? s.tabActive : {}) }} onClick={() => setTab('insights')}>💡 Insights</button>
      </div>

      {tab === 'ai' && (
        <AIAssistant summaries={summaries} recipes={recipes} ingredients={ingredients} staff={staff} userId={user.id} />
      )}

      {tab === 'weekly' && (
        <WeeklyReport summaries={summaries} recipes={recipes} lowStock={lowStock} totalRevenue={totalRevenue} totalNet={totalNet} avgMargin={avgMargin} />
      )}

      {tab === 'insights' && (
        <Insights summaries={summaries} recipes={recipes} ingredients={ingredients} staff={staff} />
      )}
    </div>
  )
}

function AIAssistant({ summaries, recipes, ingredients, staff, userId }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm your Bakery CFO AI assistant. I have access to your bakery data and can help you understand your finances, suggest improvements, and answer questions. What would you like to know?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const buildContext = () => {
    const totalRevenue = summaries.reduce((a, d) => a + (d.total_revenue || 0), 0)
    const totalNet = summaries.reduce((a, d) => a + (d.net_profit || 0), 0)
    const avgMargin = summaries.length > 0 ? (summaries.reduce((a, d) => a + (d.gross_margin || 0), 0) / summaries.length).toFixed(1) : 0
    const lowStock = ingredients.filter(i => i.stock <= i.reorder_level)
    return `You are an AI assistant for a bakery business in Uganda. Here is the current bakery data:
- Days tracked: ${summaries.length}
- Total revenue (last 30 days): UGX ${totalRevenue.toLocaleString()}
- Total net profit: UGX ${totalNet.toLocaleString()}
- Average margin: ${avgMargin}%
- Number of recipes: ${recipes.length}
- Staff members: ${staff.map(s => s.name).join(', ') || 'none'}
- Low stock ingredients: ${lowStock.map(i => i.name).join(', ') || 'none'}
- Recent daily summaries: ${summaries.slice(0, 7).map(d => `${d.summary_date}: revenue UGX ${d.total_revenue?.toLocaleString()}, net UGX ${d.net_profit?.toLocaleString()}, margin ${d.gross_margin?.toFixed(0)}%`).join(' | ')}
Give specific, actionable advice based on this data. Keep answers concise and practical for a Ugandan bakery owner. Use UGX for currency.`
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: buildContext(),
          messages: [...messages, userMsg].filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0).map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Sorry, I could not get a response. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, there was an error. Please try again.' }])
    }
    setLoading(false)
  }

  const QUICK_QUESTIONS = [
    'How is my bakery performing this month?',
    'Which products should I focus on?',
    'Am I spending too much on labor?',
    'What should I restock urgently?',
    'How can I improve my profit margin?',
    'What is my break-even revenue per day?',
  ]

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>🤖 ASK YOUR BAKERY AI</div>
      <div style={s.chatBox}>
        {messages.map((m, i) => (
          <div key={i} style={{ ...s.msg, ...(m.role === 'user' ? s.msgUser : s.msgAI) }}>
            {m.role === 'assistant' && <div style={s.aiLabel}>AI Assistant</div>}
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ ...s.msg, ...s.msgAI }}>
            <div style={s.aiLabel}>AI Assistant</div>
            <div style={{ color: 'rgba(253,246,236,0.4)', fontStyle: 'italic' }}>Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={s.quickQuestions}>
        {QUICK_QUESTIONS.map(q => (
          <button key={q} style={s.quickQ} onClick={() => { setInput(q) }}>{q}</button>
        ))}
      </div>

      <div style={s.inputRow}>
        <input
          style={s.chatInput}
          placeholder="Ask anything about your bakery..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button style={s.sendBtn} onClick={send} disabled={loading || !input.trim()}>
          {loading ? '...' : 'Send →'}
        </button>
      </div>
    </div>
  )
}

function WeeklyReport({ summaries, recipes, lowStock, totalRevenue, totalNet, avgMargin }) {
  const last7 = summaries.slice(0, 7)
  const weekRevenue = last7.reduce((a, d) => a + (d.total_revenue || 0), 0)
  const weekNet = last7.reduce((a, d) => a + (d.net_profit || 0), 0)
  const bestDay = last7.reduce((a, d) => d.total_revenue > (a?.total_revenue || 0) ? d : a, null)

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardTitle}>THIS WEEK'S PERFORMANCE</div>
        <div style={s.reportGrid}>
          <ReportStat label="Revenue this week" value={`UGX ${fmt(weekRevenue)}`} color="#F0C040" />
          <ReportStat label="Net profit this week" value={`UGX ${fmt(weekNet)}`} color={weekNet > 0 ? '#90D0A0' : '#F08070'} />
          <ReportStat label="Avg margin (30 days)" value={`${avgMargin}%`} color={parseFloat(avgMargin) >= 30 ? '#90D0A0' : '#F0B070'} />
          <ReportStat label="Best day this week" value={bestDay ? `${bestDay.summary_date} · UGX ${fmt(bestDay.total_revenue)}` : 'No data'} color="#7DBFAD" />
        </div>
      </div>

      {lowStock.length > 0 && (
        <div style={{ ...s.card, border: '1px solid rgba(214,79,59,0.3)' }}>
          <div style={s.cardTitle}>⚠️ ACTION REQUIRED</div>
          <div style={{ fontSize: 13, color: '#F08070', marginBottom: 12 }}>The following ingredients need restocking:</div>
          {lowStock.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
              <span style={{ color: '#FDF6EC' }}>{i.name}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", color: '#F08070' }}>{i.stock} {i.unit} left (reorder at {i.reorder_level})</span>
            </div>
          ))}
        </div>
      )}

      <div style={s.card}>
        <div style={s.cardTitle}>LAST 7 DAYS</div>
        {last7.length === 0 ? (
          <div style={s.empty}>No data yet. Close your first day to see weekly reports.</div>
        ) : (
          <table style={s.table}>
            <thead><tr>{['Date', 'Revenue', 'Net Profit', 'Margin', 'Units'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {last7.map(d => (
                <tr key={d.id}>
                  <td style={s.td}>{d.summary_date}</td>
                  <td style={s.td}>UGX {fmt(d.total_revenue)}</td>
                  <td style={{ ...s.td, color: d.net_profit > 0 ? '#90D0A0' : '#F08070' }}>UGX {fmt(d.net_profit)}</td>
                  <td style={{ ...s.td, color: d.gross_margin >= 30 ? '#90D0A0' : '#F0B070' }}>{d.gross_margin?.toFixed(0)}%</td>
                  <td style={s.td}>{d.units_sold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Insights({ summaries, recipes, ingredients, staff }) {
  const lowStock = ingredients.filter(i => i.stock <= i.reorder_level)
  const avgRevenue = summaries.length > 0 ? summaries.reduce((a, d) => a + d.total_revenue, 0) / summaries.length : 0
  const avgMargin = summaries.length > 0 ? summaries.reduce((a, d) => a + d.gross_margin, 0) / summaries.length : 0
  const totalUnits = summaries.reduce((a, d) => a + (d.units_sold || 0), 0)

  const insights = [
    avgMargin < 30 && { type: 'danger', title: 'Low Profit Margin', body: `Your average margin is ${avgMargin.toFixed(0)}%. Target is 30%+. Review your ingredient costs and selling prices using the Recipe Costing module.` },
    lowStock.length > 0 && { type: 'warning', title: `${lowStock.length} Ingredients Running Low`, body: `${lowStock.map(i => i.name).join(', ')} need restocking. Go to Suppliers to create a purchase order.` },
    recipes.length === 0 && { type: 'info', title: 'Set Up Recipe Costing', body: 'You have no recipes configured. Add your recipes to see exact profit margins per product — this is the most powerful feature of Bakery CFO.' },
    staff.length === 0 && { type: 'info', title: 'Add Your Staff', body: 'Add your team members to track labor costs accurately. Labor is typically 25-35% of revenue for bakeries.' },
    avgRevenue > 0 && avgMargin >= 35 && { type: 'success', title: 'Great Margin!', body: `Your ${avgMargin.toFixed(0)}% average margin is above the 30% target. Keep it up!` },
    summaries.length < 7 && { type: 'info', title: 'Keep Logging Daily', body: `You have ${summaries.length} day${summaries.length !== 1 ? 's' : ''} of data. Log daily for at least 2 weeks to get meaningful insights and forecasts.` },
  ].filter(Boolean)

  return (
    <div>
      {insights.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', color: 'rgba(253,246,236,0.4)', padding: 40 }}>
          No insights yet. Start logging data to see personalized recommendations!
        </div>
      ) : insights.map((insight, i) => (
        <div key={i} style={{ ...s.insightCard, ...getInsightStyle(insight.type) }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{insight.title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.85 }}>{insight.body}</div>
        </div>
      ))}
    </div>
  )
}

const getInsightStyle = (type) => {
  if (type === 'danger') return { borderColor: 'rgba(214,79,59,0.4)', background: 'rgba(214,79,59,0.1)', color: '#F08070' }
  if (type === 'warning') return { borderColor: 'rgba(224,140,58,0.4)', background: 'rgba(224,140,58,0.1)', color: '#F0B070' }
  if (type === 'success') return { borderColor: 'rgba(90,158,111,0.4)', background: 'rgba(90,158,111,0.1)', color: '#90D0A0' }
  return { borderColor: 'rgba(125,191,173,0.4)', background: 'rgba(125,191,173,0.1)', color: '#7DBFAD' }
}

const ReportStat = ({ label, value, color }) => (
  <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
    <div style={{ fontSize: 11, color: 'rgba(253,246,236,0.5)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 600, color }}>{value}</div>
  </div>
)

const fmt = (n) => Number(Math.round(n) || 0).toLocaleString()

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  badge: { fontSize: 10, background: 'rgba(200,134,42,0.2)', color: '#C8862A', padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  tabs: { display: 'flex', gap: 4, background: 'rgba(26,14,8,0.5)', borderRadius: 10, padding: 4, marginBottom: 16, border: '1px solid rgba(200,134,42,0.2)' },
  tab: { flex: 1, padding: '9px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'transparent', color: 'rgba(253,246,236,0.45)', fontFamily: "'DM Sans', sans-serif" },
  tabActive: { background: '#C8862A', color: '#1A0E08' },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 14 },
  chatBox: { background: 'rgba(26,14,8,0.5)', borderRadius: 10, padding: 16, minHeight: 300, maxHeight: 400, overflowY: 'auto', marginBottom: 12, border: '1px solid rgba(200,134,42,0.15)' },
  msg: { marginBottom: 14, padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.6 },
  msgAI: { background: 'rgba(61,43,31,0.8)', border: '1px solid rgba(200,134,42,0.15)', color: '#FDF6EC', marginRight: 40 },
  msgUser: { background: 'rgba(200,134,42,0.2)', border: '1px solid rgba(200,134,42,0.3)', color: '#FDF6EC', marginLeft: 40 },
  aiLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 6 },
  quickQuestions: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  quickQ: { background: 'rgba(26,14,8,0.5)', border: '1px solid rgba(200,134,42,0.2)', color: 'rgba(253,246,236,0.6)', borderRadius: 20, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  inputRow: { display: 'flex', gap: 8 },
  chatInput: { flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 8, color: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", fontSize: 13 },
  sendBtn: { background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  reportGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' },
  insightCard: { border: '1px solid', borderRadius: 12, padding: '16px 18px', marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, borderBottom: '1px solid rgba(200,134,42,0.2)' },
  td: { padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(253,246,236,0.8)', fontFamily: "'DM Mono', monospace" },
  empty: { color: 'rgba(253,246,236,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 24, fontSize: 13 },
}
