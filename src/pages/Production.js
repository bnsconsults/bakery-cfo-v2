import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

export default function Production() {
  const { user } = useAuth()
  const [plans, setPlans] = useState([])
  const [recipes, setRecipes] = useState([])
  const [salesHistory, setSalesHistory] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [date])

  const loadAll = async () => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [plansRes, recipesRes, salesRes] = await Promise.all([
      supabase.from('production_plans').select('*, recipes(name, sell_price, batch_size)').eq('user_id', user.id).eq('plan_date', date),
      supabase.from('recipes').select('*').eq('user_id', user.id).eq('active', true),
      supabase.from('sales_log').select('*').eq('user_id', user.id).gte('sale_date', sevenDaysAgo.toISOString().split('T')[0])
    ])
    setPlans(plansRes.data || [])
    setRecipes(recipesRes.data || [])
    setSalesHistory(salesRes.data || [])
  }

  // Calculate recommended production based on 7-day sales average
  const getRecommendedUnits = (recipeId) => {
    const recipeSales = salesHistory.filter(s => s.recipe_id === recipeId)
    const totalSold = recipeSales.reduce((a, s) => a + (s.units_sold || 0), 0)
    const avgDaily = totalSold / 7
    return Math.ceil(avgDaily * 1.1) // 10% buffer
  }

  const addToPlan = async (recipe, units) => {
    setSaving(true)
    const batches = Math.ceil(units / recipe.batch_size)
    await supabase.from('production_plans').insert({
      user_id: user.id, recipe_id: recipe.id, plan_date: date,
      planned_batches: batches, planned_units: units, status: 'planned'
    })
    setSaving(false)
    loadAll()
  }

  const updateStatus = async (planId, status) => {
    await supabase.from('production_plans').update({ status }).eq('id', planId)
    loadAll()
  }

  const updateActual = async (planId, actual) => {
    await supabase.from('production_plans').update({ actual_units: parseInt(actual) || 0 }).eq('id', planId)
    loadAll()
  }

  const deletePlan = async (planId) => {
    await supabase.from('production_plans').delete().eq('id', planId)
    loadAll()
  }

  const autoGeneratePlan = async () => {
    setSaving(true)
    for (const recipe of recipes) {
      const already = plans.find(p => p.recipe_id === recipe.id)
      if (!already) {
        const recommended = getRecommendedUnits(recipe.id)
        if (recommended > 0) {
          await supabase.from('production_plans').insert({
            user_id: user.id, recipe_id: recipe.id, plan_date: date,
            planned_batches: Math.ceil(recommended / recipe.batch_size),
            planned_units: recommended, status: 'planned'
          })
        }
      }
    }
    setSaving(false)
    loadAll()
  }

  const totalEstRevenue = plans.reduce((a, p) => a + ((p.recipes?.sell_price || 0) * (p.planned_units || 0)), 0)
  const totalPlanned = plans.reduce((a, p) => a + (p.planned_units || 0), 0)

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>📋 Production Planning</div>
        <div style={s.badge}>SMART PLANNING</div>
      </div>

      <div style={s.toolbar}>
        <div>
          <label style={s.label}>PLANNING FOR DATE</label>
          <input style={s.dateInput} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <button style={s.autoBtn} onClick={autoGeneratePlan} disabled={saving || recipes.length === 0}>
          {saving ? 'Generating...' : '✨ Auto-generate from sales history'}
        </button>
      </div>

      {plans.length > 0 && (
        <div style={s.kpiStrip}>
          <KPI label="PRODUCTS TO BAKE" value={plans.length} />
          <KPI label="TOTAL UNITS" value={totalPlanned} />
          <KPI label="EST. REVENUE" value={`UGX ${fmt(totalEstRevenue)}`} color="#F0C040" />
          <KPI label="COMPLETION" value={`${plans.filter(p => p.status === 'done').length}/${plans.length}`} color="#90D0A0" />
        </div>
      )}

      <div style={s.grid2}>
        {/* Current plan */}
        <div style={s.card}>
          <div style={s.cardTitle}>PRODUCTION PLAN — {date}</div>
          {plans.length === 0 ? (
            <div style={s.empty}>
              No plan for this date yet.
              {recipes.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(253,246,236,0.4)' }}>Click "Auto-generate" to create a plan based on your sales history, or add items manually from the right panel.</div>}
            </div>
          ) : plans.map(p => (
            <div key={p.id} style={s.planCard}>
              <div style={s.planTop}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#FDF6EC' }}>{p.recipes?.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(253,246,236,0.5)', marginTop: 2 }}>
                    {p.planned_units} units · {p.planned_batches} batch{p.planned_batches > 1 ? 'es' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select style={s.statusSelect} value={p.status}
                    onChange={e => updateStatus(p.id, e.target.value)}>
                    <option value="planned">Planned</option>
                    <option value="baking">Baking</option>
                    <option value="done">Done</option>
                  </select>
                  <button style={s.delBtn} onClick={() => deletePlan(p.id)}>✕</button>
                </div>
              </div>
              {p.status === 'done' && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ ...s.label, margin: 0 }}>ACTUAL UNITS BAKED:</label>
                  <input style={{ ...s.input, width: 80 }} type="number" defaultValue={p.actual_units || p.planned_units}
                    onBlur={e => updateActual(p.id, e.target.value)} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recommendations */}
        <div style={s.card}>
          <div style={s.cardTitle}>ADD TO PLAN</div>
          {recipes.length === 0 ? (
            <div style={s.empty}>No recipes set up. Go to Recipe Costing to add your products.</div>
          ) : recipes.map(recipe => {
            const recommended = getRecommendedUnits(recipe.id)
            const alreadyPlanned = plans.find(p => p.recipe_id === recipe.id)
            return (
              <div key={recipe.id} style={s.recRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#FDF6EC' }}>{recipe.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(253,246,236,0.5)', marginTop: 2 }}>
                    {recommended > 0
                      ? `Recommended: ${recommended} units (7-day avg)`
                      : 'No sales history yet'}
                  </div>
                </div>
                {alreadyPlanned ? (
                  <div style={s.inPlanTag}>✓ In plan</div>
                ) : (
                  <button style={s.addBtn} onClick={() => addToPlan(recipe, recommended > 0 ? recommended : recipe.batch_size)}>
                    + Add
                  </button>
                )}
              </div>
            )
          })}
        </div>
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

const fmt = (n) => Number(Math.round(n) || 0).toLocaleString()

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  badge: { fontSize: 10, background: 'rgba(200,134,42,0.2)', color: '#C8862A', padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  label: { display: 'block', fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5 },
  dateInput: { background: 'rgba(61,43,31,0.8)', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 8, color: '#F0C040', padding: '8px 12px', fontFamily: "'DM Mono', monospace", fontSize: 13 },
  autoBtn: { background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  kpiStrip: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 },
  kpi: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 10, padding: '12px 14px' },
  kpiLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5 },
  kpiVal: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 14 },
  planCard: { background: 'rgba(26,14,8,0.4)', border: '1px solid rgba(200,134,42,0.15)', borderRadius: 10, padding: '12px', marginBottom: 10 },
  planTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  statusSelect: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 6, color: '#FDF6EC', padding: '4px 8px', fontSize: 11, fontFamily: "'DM Mono', monospace" },
  delBtn: { background: 'rgba(214,79,59,0.1)', color: '#F08070', border: '1px solid rgba(214,79,59,0.2)', borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer' },
  recRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  inPlanTag: { fontSize: 10, background: 'rgba(90,158,111,0.15)', color: '#90D0A0', padding: '3px 10px', borderRadius: 20, fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' },
  addBtn: { background: 'rgba(200,134,42,0.2)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" },
  empty: { color: 'rgba(253,246,236,0.3)', fontStyle: 'italic', fontSize: 13, padding: '16px 0' },
  input: { padding: '7px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 6, color: '#FDF6EC', fontFamily: "'DM Mono', monospace", fontSize: 13 },
}
