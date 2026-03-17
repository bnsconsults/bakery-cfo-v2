import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

const blank = { name: '', stock: '', unit: 'kg', reorder_level: '', cost_per_unit: '', expiry_date: '', supplier_id: '' }

const COMMON_INGREDIENTS = [
  { name: 'Wheat Flour', unit: 'kg', cost: 3500, category: 'Flours' },
  { name: 'Cake Flour', unit: 'kg', cost: 4500, category: 'Flours' },
  { name: 'Self-Raising Flour', unit: 'kg', cost: 4800, category: 'Flours' },
  { name: 'Whole Wheat Flour', unit: 'kg', cost: 5000, category: 'Flours' },
  { name: 'Cornflour', unit: 'kg', cost: 6000, category: 'Flours' },
  { name: 'Semolina', unit: 'kg', cost: 4000, category: 'Flours' },
  { name: 'Oats', unit: 'kg', cost: 7000, category: 'Flours' },
  { name: 'Sugar', unit: 'kg', cost: 4000, category: 'Sweeteners' },
  { name: 'Icing Sugar', unit: 'kg', cost: 5500, category: 'Sweeteners' },
  { name: 'Brown Sugar', unit: 'kg', cost: 5000, category: 'Sweeteners' },
  { name: 'Caster Sugar', unit: 'kg', cost: 5200, category: 'Sweeteners' },
  { name: 'Honey', unit: 'kg', cost: 18000, category: 'Sweeteners' },
  { name: 'Golden Syrup', unit: 'kg', cost: 12000, category: 'Sweeteners' },
  { name: 'Butter', unit: 'kg', cost: 18000, category: 'Dairy & Fats' },
  { name: 'Margarine', unit: 'kg', cost: 9000, category: 'Dairy & Fats' },
  { name: 'Shortening', unit: 'kg', cost: 11000, category: 'Dairy & Fats' },
  { name: 'Vegetable Oil', unit: 'L', cost: 7000, category: 'Dairy & Fats' },
  { name: 'Coconut Oil', unit: 'L', cost: 15000, category: 'Dairy & Fats' },
  { name: 'Milk', unit: 'L', cost: 3000, category: 'Dairy & Fats' },
  { name: 'Fresh Cream', unit: 'L', cost: 12000, category: 'Dairy & Fats' },
  { name: 'Whipping Cream', unit: 'L', cost: 14000, category: 'Dairy & Fats' },
  { name: 'Cream Cheese', unit: 'kg', cost: 35000, category: 'Dairy & Fats' },
  { name: 'Condensed Milk', unit: 'kg', cost: 8000, category: 'Dairy & Fats' },
  { name: 'Evaporated Milk', unit: 'L', cost: 6500, category: 'Dairy & Fats' },
  { name: 'Yoghurt', unit: 'L', cost: 5000, category: 'Dairy & Fats' },
  { name: 'Eggs', unit: 'doz', cost: 6000, category: 'Eggs' },
  { name: 'Egg Whites', unit: 'L', cost: 8000, category: 'Eggs' },
  { name: 'Egg Yolks', unit: 'L', cost: 8000, category: 'Eggs' },
  { name: 'Yeast (Dry)', unit: 'kg', cost: 15000, category: 'Leavening' },
  { name: 'Yeast (Fresh)', unit: 'kg', cost: 8000, category: 'Leavening' },
  { name: 'Baking Powder', unit: 'kg', cost: 12000, category: 'Leavening' },
  { name: 'Baking Soda', unit: 'kg', cost: 8000, category: 'Leavening' },
  { name: 'Cream of Tartar', unit: 'kg', cost: 20000, category: 'Leavening' },
  { name: 'Salt', unit: 'kg', cost: 1500, category: 'Leavening' },
  { name: 'Vanilla Extract', unit: 'ml', cost: 25000, category: 'Flavourings' },
  { name: 'Vanilla Essence', unit: 'ml', cost: 12000, category: 'Flavourings' },
  { name: 'Almond Extract', unit: 'ml', cost: 22000, category: 'Flavourings' },
  { name: 'Lemon Extract', unit: 'ml', cost: 18000, category: 'Flavourings' },
  { name: 'Orange Extract', unit: 'ml', cost: 18000, category: 'Flavourings' },
  { name: 'Rose Water', unit: 'ml', cost: 10000, category: 'Flavourings' },
  { name: 'Cinnamon', unit: 'kg', cost: 20000, category: 'Flavourings' },
  { name: 'Nutmeg', unit: 'kg', cost: 35000, category: 'Flavourings' },
  { name: 'Cardamom', unit: 'kg', cost: 40000, category: 'Flavourings' },
  { name: 'Ginger (Ground)', unit: 'kg', cost: 15000, category: 'Flavourings' },
  { name: 'Mixed Spice', unit: 'kg', cost: 25000, category: 'Flavourings' },
  { name: 'Cocoa Powder', unit: 'kg', cost: 22000, category: 'Chocolate' },
  { name: 'Dark Chocolate', unit: 'kg', cost: 45000, category: 'Chocolate' },
  { name: 'Milk Chocolate', unit: 'kg', cost: 40000, category: 'Chocolate' },
  { name: 'White Chocolate', unit: 'kg', cost: 42000, category: 'Chocolate' },
  { name: 'Chocolate Chips', unit: 'kg', cost: 38000, category: 'Chocolate' },
  { name: 'Raisins', unit: 'kg', cost: 14000, category: 'Fruits & Nuts' },
  { name: 'Sultanas', unit: 'kg', cost: 15000, category: 'Fruits & Nuts' },
  { name: 'Dates', unit: 'kg', cost: 12000, category: 'Fruits & Nuts' },
  { name: 'Dried Apricots', unit: 'kg', cost: 20000, category: 'Fruits & Nuts' },
  { name: 'Almonds', unit: 'kg', cost: 35000, category: 'Fruits & Nuts' },
  { name: 'Walnuts', unit: 'kg', cost: 30000, category: 'Fruits & Nuts' },
  { name: 'Cashew Nuts', unit: 'kg', cost: 28000, category: 'Fruits & Nuts' },
  { name: 'Groundnuts', unit: 'kg', cost: 8000, category: 'Fruits & Nuts' },
  { name: 'Desiccated Coconut', unit: 'kg', cost: 16000, category: 'Fruits & Nuts' },
  { name: 'Fondant', unit: 'kg', cost: 20000, category: 'Decorating' },
  { name: 'Marzipan', unit: 'kg', cost: 25000, category: 'Decorating' },
  { name: 'Food Colouring (Red)', unit: 'ml', cost: 5000, category: 'Decorating' },
  { name: 'Food Colouring (Blue)', unit: 'ml', cost: 5000, category: 'Decorating' },
  { name: 'Food Colouring (Yellow)', unit: 'ml', cost: 5000, category: 'Decorating' },
  { name: 'Sprinkles', unit: 'kg', cost: 18000, category: 'Decorating' },
  { name: 'Edible Glitter', unit: 'g', cost: 15000, category: 'Decorating' },
  { name: 'Sugar Paste', unit: 'kg', cost: 22000, category: 'Decorating' },
  { name: 'Strawberry Jam', unit: 'kg', cost: 10000, category: 'Fillings' },
  { name: 'Apricot Jam', unit: 'kg', cost: 9000, category: 'Fillings' },
  { name: 'Lemon Curd', unit: 'kg', cost: 12000, category: 'Fillings' },
  { name: 'Caramel Sauce', unit: 'kg', cost: 14000, category: 'Fillings' },
  { name: 'Peanut Butter', unit: 'kg', cost: 15000, category: 'Fillings' },
  { name: 'Nutella', unit: 'kg', cost: 30000, category: 'Fillings' },
  { name: 'Cake Boxes', unit: 'pcs', cost: 1500, category: 'Packaging' },
  { name: 'Cupcake Cases', unit: 'pcs', cost: 200, category: 'Packaging' },
  { name: 'Baking Paper', unit: 'pcs', cost: 500, category: 'Packaging' },
  { name: 'Bread Bags', unit: 'pcs', cost: 300, category: 'Packaging' },
  { name: 'Ribbon', unit: 'pcs', cost: 800, category: 'Packaging' },
]

const CATEGORIES = [...new Set(COMMON_INGREDIENTS.map(i => i.category))]

export default function Inventory() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [nameInput, setNameInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const nameRef = useRef(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    const [ingRes, suppRes] = await Promise.all([
      supabase.from('ingredients').select('*').eq('user_id', user.id).order('name'),
      supabase.from('suppliers').select('*').eq('user_id', user.id)
    ])
    setItems(ingRes.data || [])
    setSuppliers(suppRes.data || [])
  }

  const handleNameChange = (val) => {
    setNameInput(val)
    setForm({ ...form, name: val })
    if (val.length >= 2) {
      const matches = COMMON_INGREDIENTS.filter(ci =>
        ci.name.toLowerCase().includes(val.toLowerCase())
      )
      setSuggestions(matches.slice(0, 6))
      setShowSuggestions(matches.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const pickSuggestion = (ci) => {
    setNameInput(ci.name)
    setForm({ ...form, name: ci.name, unit: ci.unit, cost_per_unit: ci.cost })
    setSuggestions([])
    setShowSuggestions(false)
  }

  const quickAdd = (ci) => {
    setNameInput(ci.name)
    setForm({ ...form, name: ci.name, unit: ci.unit, cost_per_unit: ci.cost })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => nameRef.current?.focus(), 300)
  }

  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = {
      ...form, user_id: user.id,
      stock: parseFloat(form.stock) || 0,
      reorder_level: parseFloat(form.reorder_level) || 0,
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
      supplier_id: form.supplier_id || null,
      expiry_date: form.expiry_date || null
    }
    if (editId) {
      await supabase.from('ingredients').update(payload).eq('id', editId)
    } else {
      await supabase.from('ingredients').insert(payload)
    }
    setForm(blank); setNameInput(''); setEditId(null); setSaving(false); load()
  }

  const edit = (item) => {
    setForm({ name: item.name, stock: item.stock, unit: item.unit, reorder_level: item.reorder_level, cost_per_unit: item.cost_per_unit, expiry_date: item.expiry_date || '', supplier_id: item.supplier_id || '' })
    setNameInput(item.name)
    setEditId(item.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const del = async (id) => {
    if (!window.confirm('Delete this ingredient?')) return
    await supabase.from('ingredients').delete().eq('id', id); load()
  }

  const lowStock = items.filter(i => i.stock <= i.reorder_level)
  const expiringSoon = items.filter(i => {
    if (!i.expiry_date) return false
    return Math.round((new Date(i.expiry_date) - new Date()) / 86400000) < 14
  })
  const totalValue = items.reduce((a, i) => a + (i.stock * i.cost_per_unit), 0)

  const filtered = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false
    if (tab === 'low') return i.stock <= i.reorder_level
    if (tab === 'expiring') return expiringSoon.find(e => e.id === i.id)
    return true
  })

  const filteredQuick = activeCategory === 'All'
    ? COMMON_INGREDIENTS
    : COMMON_INGREDIENTS.filter(ci => ci.category === activeCategory)

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>📦 Inventory</div>
        <div style={s.badge}>LIVE STOCK</div>
      </div>

      <div style={s.kpiStrip}>
        <KPI label="TOTAL INGREDIENTS" value={items.length} />
        <KPI label="LOW STOCK" value={lowStock.length} color={lowStock.length > 0 ? '#F08070' : '#90D0A0'} />
        <KPI label="EXPIRING SOON" value={expiringSoon.length} color={expiringSoon.length > 0 ? '#F0B070' : '#90D0A0'} />
        <KPI label="TOTAL VALUE" value={`UGX ${fmt(totalValue)}`} color="#F0C040" />
      </div>

      {lowStock.length > 0 && (
        <div style={s.alert}>⚠️ <strong>Low stock:</strong> {lowStock.map(i => i.name).join(', ')}</div>
      )}
      {expiringSoon.length > 0 && (
        <div style={{ ...s.alert, background: 'rgba(214,79,59,0.12)', border: '1px solid rgba(214,79,59,0.3)', color: '#F08070' }}>
          🕐 <strong>Expiring within 14 days:</strong> {expiringSoon.map(i => i.name).join(', ')}
        </div>
      )}

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardTitle}>{editId ? '✏️ EDIT INGREDIENT' : '+ ADD INGREDIENT'}</div>
          <form onSubmit={save}>
            <div style={s.formGrid}>
              <div style={{ gridColumn: '1 / -1', position: 'relative' }}>
                <label style={s.label}>INGREDIENT NAME</label>
                <input
                  ref={nameRef}
                  style={s.input}
                  value={nameInput}
                  onChange={e => handleNameChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => nameInput.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Type to search (e.g. 'su' → Sugar)..."
                  required
                />
                {showSuggestions && (
                  <div style={s.dropdown}>
                    {suggestions.map(ci => (
                      <div key={ci.name} style={s.dropItem} onMouseDown={() => pickSuggestion(ci)}>
                        <span style={{ color: '#FDF6EC', fontWeight: 600 }}>{ci.name}</span>
                        <span style={{ color: 'rgba(253,246,236,0.4)', fontSize: 11 }}>{ci.unit} · UGX {fmt(ci.cost)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <F label="CURRENT STOCK" type="number" value={form.stock} onChange={v => setForm({ ...form, stock: v })} placeholder="0" required />
              <div>
                <label style={s.label}>UNIT</label>
                <select style={s.input} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  {['kg', 'g', 'L', 'ml', 'doz', 'pcs', 'bags', 'boxes', 'trays'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <F label="REORDER LEVEL" type="number" value={form.reorder_level} onChange={v => setForm({ ...form, reorder_level: v })} placeholder="5" />
              <F label="COST PER UNIT (UGX)" type="number" value={form.cost_per_unit} onChange={v => setForm({ ...form, cost_per_unit: v })} placeholder="0" />
              <F label="EXPIRY DATE" type="date" value={form.expiry_date} onChange={v => setForm({ ...form, expiry_date: v })} />
              {suppliers.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>SUPPLIER</label>
                  <select style={s.input} value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                    <option value="">No supplier</option>
                    {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving...' : editId ? 'Update Ingredient' : '+ Add Ingredient'}</button>
              {editId && <button type="button" style={s.btnSec} onClick={() => { setForm(blank); setNameInput(''); setEditId(null) }}>Cancel</button>}
            </div>
          </form>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>QUICK ADD — {COMMON_INGREDIENTS.length} BAKERY INGREDIENTS</div>
          <div style={{ fontSize: 12, color: 'rgba(253,246,236,0.5)', marginBottom: 10 }}>Click any item to auto-fill the form</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
            {['All', ...CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                style={{ ...s.catBtn, ...(activeCategory === cat ? s.catBtnActive : {}) }}>
                {cat}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <div style={s.quickGrid}>
              {filteredQuick.map(ci => (
                <div key={ci.name} style={s.quickChip} onClick={() => quickAdd(ci)}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#FDF6EC' }}>{ci.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(253,246,236,0.4)' }}>{ci.unit} · ~UGX {fmt(ci.cost)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={s.cardTitle}>ALL INGREDIENTS ({items.length})</div>
          <input style={{ ...s.input, width: 200, padding: '6px 12px' }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={s.filterTabs}>
          {[['all', 'All'], ['low', `Low Stock (${lowStock.length})`], ['expiring', `Expiring (${expiringSoon.length})`]].map(([id, label]) => (
            <button key={id} style={{ ...s.filterTab, ...(tab === id ? s.filterTabActive : {}) }} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={s.empty}>No ingredients found. Add your first ingredient above.</div>
        ) : (
          <table style={s.table}>
            <thead><tr>{['Ingredient', 'Stock', 'Reorder', 'Status', 'Cost/Unit', 'Total Value', 'Expiry', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(i => {
                const low = i.stock <= i.reorder_level
                const daysLeft = i.expiry_date ? Math.round((new Date(i.expiry_date) - new Date()) / 86400000) : null
                const pct = Math.min(100, (i.stock / Math.max(i.reorder_level * 3, 1)) * 100)
                return (
                  <tr key={i.id}>
                    <td style={s.td}><strong style={{ color: '#FDF6EC' }}>{i.name}</strong></td>
                    <td style={s.td}>
                      <div>{i.stock} {i.unit}</div>
                      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 99, height: 4, width: 60, marginTop: 3 }}>
                        <div style={{ height: 4, borderRadius: 99, width: `${pct}%`, background: low ? '#D64F3B' : pct < 60 ? '#E08C3A' : '#5A9E6F' }} />
                      </div>
                    </td>
                    <td style={s.td}>{i.reorder_level} {i.unit}</td>
                    <td style={s.td}>
                      <span style={{ ...s.pill, ...(low ? s.pillRed : s.pillGreen) }}>{low ? '⚠ Low' : '✓ OK'}</span>
                    </td>
                    <td style={s.td}>UGX {fmt(i.cost_per_unit)}/{i.unit}</td>
                    <td style={s.td}>UGX {fmt(i.stock * i.cost_per_unit)}</td>
                    <td style={{ ...s.td, color: daysLeft !== null && daysLeft < 14 ? '#F08070' : 'inherit' }}>
                      {i.expiry_date ? `${i.expiry_date}${daysLeft !== null && daysLeft < 14 ? ` (${daysLeft}d)` : ''}` : '—'}
                    </td>
                    <td style={s.td}>
                      <button style={s.editBtn} onClick={() => edit(i)}>Edit</button>
                      <button style={s.delBtn} onClick={() => del(i.id)}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
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
  alert: { background: 'rgba(224,140,58,0.12)', border: '1px solid rgba(224,140,58,0.3)', color: '#F0B070', borderRadius: 10, padding: '10px 16px', fontSize: 13, marginBottom: 12 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 14 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' },
  label: { display: 'block', fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5, marginTop: 10 },
  input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 7, color: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#2A1A10', border: '1px solid rgba(200,134,42,0.4)', borderRadius: 8, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' },
  dropItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(200,134,42,0.1)', fontSize: 13 },
  btn: { padding: '10px 20px', background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  btnSec: { padding: '10px 16px', background: 'rgba(200,134,42,0.15)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  catBtn: { padding: '3px 10px', border: '1px solid rgba(200,134,42,0.2)', borderRadius: 20, background: 'transparent', color: 'rgba(253,246,236,0.4)', fontSize: 10, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  catBtnActive: { background: 'rgba(200,134,42,0.25)', color: '#F0C040', borderColor: 'rgba(200,134,42,0.5)' },
  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 },
  quickChip: { background: 'rgba(26,14,8,0.5)', border: '1px solid rgba(200,134,42,0.15)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' },
  filterTabs: { display: 'flex', gap: 6, marginBottom: 14 },
  filterTab: { padding: '5px 14px', border: '1px solid rgba(200,134,42,0.2)', borderRadius: 20, background: 'transparent', color: 'rgba(253,246,236,0.5)', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  filterTabActive: { background: 'rgba(200,134,42,0.2)', color: '#C8862A', borderColor: 'rgba(200,134,42,0.4)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, borderBottom: '1px solid rgba(200,134,42,0.2)' },
  td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(253,246,236,0.8)' },
  pill: { fontSize: 9, padding: '2px 8px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  pillRed: { background: 'rgba(214,79,59,0.15)', color: '#F08070', border: '1px solid rgba(214,79,59,0.3)' },
  pillGreen: { background: 'rgba(90,158,111,0.15)', color: '#90D0A0', border: '1px solid rgba(90,158,111,0.3)' },
  editBtn: { background: 'rgba(200,134,42,0.2)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', marginRight: 6 },
  delBtn: { background: 'rgba(214,79,59,0.1)', color: '#F08070', border: '1px solid rgba(214,79,59,0.2)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer' },
  empty: { color: 'rgba(253,246,236,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 24, fontSize: 13 },
}
