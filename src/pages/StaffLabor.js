import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

const blankStaff = { name: '', role: '', hourly_rate: '', phone: '' }
const blankLog = { staff_id: '', log_date: new Date().toISOString().split('T')[0], hours_worked: '8', overtime_hours: '0' }

export default function StaffLabor() {
  const { user } = useAuth()
  const [staff, setStaff] = useState([])
  const [logs, setLogs] = useState([])
  const [staffForm, setStaffForm] = useState(blankStaff)
  const [logForm, setLogForm] = useState(blankLog)
  const [tab, setTab] = useState('log')
  const [saving, setSaving] = useState(false)
  const [editStaffId, setEditStaffId] = useState(null)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [staffRes, logsRes] = await Promise.all([
      supabase.from('staff').select('*').eq('user_id', user.id).order('name'),
      supabase.from('labor_log').select('*').eq('user_id', user.id).order('log_date', { ascending: false }).limit(30)
    ])
    setStaff(staffRes.data || [])
    setLogs(logsRes.data || [])
  }

  const saveStaff = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = { ...staffForm, user_id: user.id, hourly_rate: parseFloat(staffForm.hourly_rate) || 0 }
    if (editStaffId) {
      await supabase.from('staff').update(payload).eq('id', editStaffId)
    } else {
      await supabase.from('staff').insert(payload)
    }
    setStaffForm(blankStaff); setEditStaffId(null); setSaving(false); loadAll()
  }

  const saveLog = async (e) => {
    e.preventDefault(); setSaving(true)
    const member = staff.find(s => s.id === logForm.staff_id)
    await supabase.from('labor_log').insert({
      ...logForm, user_id: user.id,
      staff_name: member?.name || '',
      hours_worked: parseFloat(logForm.hours_worked) || 0,
      overtime_hours: parseFloat(logForm.overtime_hours) || 0
    })
    setLogForm(blankLog); setSaving(false); loadAll()
  }

  const delStaff = async (id) => {
    if (!window.confirm('Remove this staff member?')) return
    await supabase.from('staff').delete().eq('id', id); loadAll()
  }

  const delLog = async (id) => {
    await supabase.from('labor_log').delete().eq('id', id); loadAll()
  }

  const editStaff = (m) => {
    setStaffForm({ name: m.name, role: m.role, hourly_rate: m.hourly_rate, phone: m.phone || '' })
    setEditStaffId(m.id); setTab('staff')
  }

  // Stats
  const totalHours = logs.reduce((a, l) => a + (l.hours_worked || 0), 0)
  const totalOT = logs.reduce((a, l) => a + (l.overtime_hours || 0), 0)
  const totalCost = logs.reduce((a, l) => {
    const member = staff.find(s => s.name === l.staff_name)
    const rate = member?.hourly_rate || 0
    return a + (l.hours_worked * rate) + (l.overtime_hours * rate * 1.5)
  }, 0)

  // Per staff breakdown
  const staffBreakdown = staff.map(m => {
    const memberLogs = logs.filter(l => l.staff_name === m.name)
    const hours = memberLogs.reduce((a, l) => a + (l.hours_worked || 0), 0)
    const ot = memberLogs.reduce((a, l) => a + (l.overtime_hours || 0), 0)
    const cost = hours * m.hourly_rate + ot * m.hourly_rate * 1.5
    return { ...m, totalHours: hours, totalOT: ot, totalCost: cost }
  })

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>👩‍🍳 Staff & Labor</div>
        <div style={s.badge}>WORKFORCE</div>
      </div>

      <div style={s.kpiStrip}>
        <KPI label="ACTIVE STAFF" value={staff.filter(m => m.active).length} color="#7DBFAD" />
        <KPI label="HOURS LOGGED (30D)" value={totalHours.toFixed(0)} color="#F0C040" />
        <KPI label="OVERTIME HOURS" value={totalOT.toFixed(0)} color={totalOT > 20 ? '#F08070' : '#90D0A0'} />
        <KPI label="LABOR COST (30D)" value={`UGX ${fmt(totalCost)}`} color="#C8862A" />
      </div>

      <div style={s.tabs}>
        {[['log', 'Log Hours'], ['roster', 'Staff Roster'], ['staff', editStaffId ? 'Edit Staff' : 'Add Staff']].map(([id, label]) => (
          <button key={id} style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'log' && (
        <div style={s.grid2}>
          <div style={s.card}>
            <div style={s.cardTitle}>+ LOG HOURS WORKED</div>
            {staff.length === 0 ? (
              <div style={s.warn}>Add staff members first using the "Add Staff" tab.</div>
            ) : (
              <form onSubmit={saveLog}>
                <div style={{ marginBottom: 14 }}>
                  <label style={s.label}>STAFF MEMBER</label>
                  <select style={s.input} value={logForm.staff_id} onChange={e => setLogForm({ ...logForm, staff_id: e.target.value })} required>
                    <option value="">Select staff member...</option>
                    {staff.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role} (UGX {fmt(m.hourly_rate)}/hr)</option>)}
                  </select>
                </div>
                <F label="DATE" type="date" value={logForm.log_date} onChange={v => setLogForm({ ...logForm, log_date: v })} />
                <div style={s.twoCol}>
                  <F label="REGULAR HOURS" type="number" value={logForm.hours_worked} onChange={v => setLogForm({ ...logForm, hours_worked: v })} />
                  <F label="OVERTIME HOURS" type="number" value={logForm.overtime_hours} onChange={v => setLogForm({ ...logForm, overtime_hours: v })} />
                </div>
                {logForm.staff_id && (
                  <div style={s.costPreview}>
                    {(() => {
                      const m = staff.find(s => s.id === logForm.staff_id)
                      const cost = (parseFloat(logForm.hours_worked) || 0) * (m?.hourly_rate || 0) + (parseFloat(logForm.overtime_hours) || 0) * (m?.hourly_rate || 0) * 1.5
                      return <>Est. cost: <strong style={{ color: '#F0C040' }}>UGX {fmt(cost)}</strong></>
                    })()}
                  </div>
                )}
                <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving...' : '+ Log Hours'}</button>
              </form>
            )}
          </div>
          <div style={s.card}>
            <div style={s.cardTitle}>RECENT HOURS LOG</div>
            {logs.length === 0 ? <div style={s.empty}>No hours logged yet.</div> : (
              <table style={s.table}>
                <thead><tr>{['Date', 'Staff', 'Hours', 'OT', 'Cost', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {logs.map(l => {
                    const member = staff.find(s => s.name === l.staff_name)
                    const rate = member?.hourly_rate || 0
                    const cost = l.hours_worked * rate + l.overtime_hours * rate * 1.5
                    return (
                      <tr key={l.id}>
                        <td style={s.td}>{l.log_date}</td>
                        <td style={s.td}>{l.staff_name}</td>
                        <td style={s.td}>{l.hours_worked}h</td>
                        <td style={{ ...s.td, color: l.overtime_hours > 0 ? '#F0B070' : 'inherit' }}>{l.overtime_hours}h</td>
                        <td style={s.td}>UGX {fmt(cost)}</td>
                        <td style={s.td}><button style={s.delBtn} onClick={() => delLog(l.id)}>✕</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'roster' && (
        <div>
          <div style={s.grid2}>
            {staffBreakdown.map(m => (
              <div key={m.id} style={s.staffCard}>
                <div style={s.staffTop}>
                  <div style={s.avatar}>{m.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#FDF6EC' }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(253,246,236,0.5)' }}>{m.role}</div>
                    {m.phone && <div style={{ fontSize: 11, color: 'rgba(253,246,236,0.35)', marginTop: 2 }}>{m.phone}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={s.editBtn} onClick={() => editStaff(m)}>Edit</button>
                    <button style={s.delBtn} onClick={() => delStaff(m.id)}>✕</button>
                  </div>
                </div>
                <div style={s.staffStats}>
                  <div style={s.staffStat}><div style={s.statLabel}>RATE</div><div style={s.statVal}>UGX {fmt(m.hourly_rate)}/hr</div></div>
                  <div style={s.staffStat}><div style={s.statLabel}>HRS (30D)</div><div style={s.statVal}>{m.totalHours}h</div></div>
                  <div style={s.staffStat}><div style={s.statLabel}>OT HRS</div><div style={{ ...s.statVal, color: m.totalOT > 0 ? '#F0B070' : 'inherit' }}>{m.totalOT}h</div></div>
                  <div style={s.staffStat}><div style={s.statLabel}>COST (30D)</div><div style={{ ...s.statVal, color: '#C8862A' }}>UGX {fmt(m.totalCost)}</div></div>
                </div>
              </div>
            ))}
            {staff.length === 0 && <div style={{ ...s.card, textAlign: 'center', color: 'rgba(253,246,236,0.3)', fontSize: 13, padding: 30 }}>No staff added yet.</div>}
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div style={s.card}>
          <div style={s.cardTitle}>{editStaffId ? '✏️ EDIT STAFF MEMBER' : '+ ADD STAFF MEMBER'}</div>
          <form onSubmit={saveStaff}>
            <div style={s.twoCol}>
              <F label="FULL NAME" value={staffForm.name} onChange={v => setStaffForm({ ...staffForm, name: v })} placeholder="e.g. Amara Nakato" required />
              <F label="ROLE / POSITION" value={staffForm.role} onChange={v => setStaffForm({ ...staffForm, role: v })} placeholder="e.g. Head Baker" />
              <F label="HOURLY RATE (UGX)" type="number" value={staffForm.hourly_rate} onChange={v => setStaffForm({ ...staffForm, hourly_rate: v })} placeholder="e.g. 5000" />
              <F label="PHONE / WHATSAPP" value={staffForm.phone} onChange={v => setStaffForm({ ...staffForm, phone: v })} placeholder="+256 700 000 000" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving...' : editStaffId ? 'Update Staff' : '+ Add Staff Member'}</button>
              {editStaffId && <button type="button" style={s.btnSec} onClick={() => { setStaffForm(blankStaff); setEditStaffId(null) }}>Cancel</button>}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const KPI = ({ label, value, color }) => (
  <div style={s.kpi}>
    <div style={s.kpiLabel}>{label}</div>
    <div style={{ ...s.kpiVal, color: color || '#FDF6EC' }}>{value}</div>
  </div>
)

const F = ({ label, type = 'text', value, onChange, placeholder, required }) => (
  <div>
    <label style={s.label}>{label}</label>
    <input style={s.input} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
  </div>
)

const fmt = (n) => Number(Math.round(n) || 0).toLocaleString()

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  badge: { fontSize: 10, background: 'rgba(200,134,42,0.2)', color: '#C8862A', padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  kpiStrip: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 },
  kpi: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 10, padding: '12px 14px' },
  kpiLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5 },
  kpiVal: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900 },
  tabs: { display: 'flex', gap: 4, background: 'rgba(26,14,8,0.5)', borderRadius: 10, padding: 4, marginBottom: 16, border: '1px solid rgba(200,134,42,0.2)' },
  tab: { flex: 1, padding: '8px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'transparent', color: 'rgba(253,246,236,0.45)', fontFamily: "'DM Sans', sans-serif" },
  tabActive: { background: '#C8862A', color: '#1A0E08' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 14 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' },
  label: { display: 'block', fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5, marginTop: 10 },
  input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 7, color: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' },
  btn: { padding: '10px 20px', background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  btnSec: { padding: '10px 16px', background: 'rgba(200,134,42,0.15)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  costPreview: { background: 'rgba(26,14,8,0.4)', border: '1px solid rgba(200,134,42,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'rgba(253,246,236,0.6)', marginTop: 8, marginBottom: 12 },
  warn: { background: 'rgba(200,134,42,0.1)', border: '1px solid rgba(200,134,42,0.3)', color: '#F0B070', borderRadius: 8, padding: '12px 16px', fontSize: 13 },
  staffCard: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 16, marginBottom: 12 },
  staffTop: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(200,134,42,0.25)', color: '#C8862A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 },
  staffStats: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, background: 'rgba(26,14,8,0.3)', borderRadius: 8, padding: 12 },
  staffStat: { textAlign: 'center' },
  statLabel: { fontSize: 8, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 3 },
  statVal: { fontSize: 13, fontWeight: 600, color: '#FDF6EC', fontFamily: "'DM Mono', monospace" },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, borderBottom: '1px solid rgba(200,134,42,0.2)' },
  td: { padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(253,246,236,0.8)', fontFamily: "'DM Mono', monospace" },
  editBtn: { background: 'rgba(200,134,42,0.2)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', marginRight: 4 },
  delBtn: { background: 'rgba(214,79,59,0.1)', color: '#F08070', border: '1px solid rgba(214,79,59,0.2)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer' },
  empty: { color: 'rgba(253,246,236,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 24, fontSize: 13 },
}
