import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

export default function Recipes() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [selected, setSelected] = useState(null)
  const [recipeIngredients, setRecipeIngredients] = useState([])
  const [tab, setTab] = useState('list')
  const [form, setForm] = useState({ name: '', category: 'bread', batch_size: 10, sell_price: '', prep_minutes: 30, bake_minutes: 20, notes: '' })
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState(null)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [recRes, ingRes, profRes] = await Promise.all([
      supabase.from('recipes').select('*').eq('user_id', user.id).order('name'),
      supabase.from('ingredients').select('*').eq('user_id', user.id).order('name'),
      supabase.from('bakery_profile').select('*').eq('user_id', user.id).single()
    ])
    setRecipes(recRes.data || [])
    setIngredients(ingRes.data || [])
    setProfile(profRes.data)
  }

  const loadRecipeIngredients = async (recipeId) => {
    const { data } = await supabase.from('recipe_ingredients')
      .select('*, ingredients(name, unit, cost_per_unit)')
      .eq('recipe_id', recipeId).eq('user_id', user.id)
    setRecipeIngredients(data || [])
  }

  const selectRecipe = async (recipe) => {
    setSelected(recipe)
    await loadRecipeIngredients(recipe.id)
    setTab('detail')
  }

  const saveRecipe = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, user_id: user.id, batch_size: parseInt(form.batch_size) || 10, sell_price: parseFloat(form.sell_price) || 0, prep_minutes: parseInt(form.prep_minutes) || 0, bake_minutes: parseInt(form.bake_minutes) || 0 }
    const { data } = await supabase.from('recipes').insert(payload).select().single()
    setSaving(false)
    setForm({ name: '', category: 'bread', batch_size: 10, sell_price: '', prep_minutes: 30, bake_minutes: 20, notes: '' })
    loadAll()
    if (data) { setSelected(data); setRecipeIngredients([]); setTab('detail') }
  }

  const addIngredient = async (ingId, qty) => {
    const ing = ingredients.find(i => i.id === ingId)
    if (!ing) return
    await supabase.from('recipe_ingredients').insert({ recipe_id: selected.id, ingredient_id: ingId, quantity: parseFloat(qty) || 0, unit: ing.unit, user_id: user.id })
    await loadRecipeIngredients(selected.id)
  }

  const removeIngredient = async (id) => {
    await supabase.from('recipe_ingredients').delete().eq('id', id)
    await loadRecipeIngredients(selected.id)
  }

  const updatePrice = async (price) => {
    await supabase.from('recipes').update({ sell_price: parseFloat(price) || 0 }).eq('id', selected.id)
    setSelected({ ...selected, sell_price: parseFloat(price) || 0 })
    loadAll()
  }

  // Cost calculations for selected recipe
  const ingredientCost = recipeIngredients.reduce((a, ri) => {
    return a + (ri.quantity * (ri.ingredients?.cost_per_unit || 0))
  }, 0)
  const costPerUnit = selected ? ingredientCost / (selected.batch_size || 1) : 0
  const sellPrice = selected?.sell_price || 0
  const margin = sellPrice > 0 ? (((sellPrice - costPerUnit) / sellPrice) * 100).toFixed(1) : 0
  const targetMargin = profile?.target_margin || 40
  const recommendedPrice = costPerUnit > 0 ? Math.ceil(costPerUnit / (1 - targetMargin / 100) / 100) * 100 : 0

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>🍞 Recipe Costing</div>
        <div style={s.badge}>COST ENGINE</div>
      </div>

      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(tab === 'list' ? s.tabActive : {}) }} onClick={() => setTab('list')}>All Recipes ({recipes.length})</button>
        <button style={{ ...s.tab, ...(tab === 'new' ? s.tabActive : {}) }} onClick={() => setTab('new')}>+ New Recipe</button>
        {selected && <button style={{ ...s.tab, ...(tab === 'detail' ? s.tabActive : {}) }} onClick={() => setTab('detail')}>{selected.name}</button>}
      </div>

      {/* LIST */}
      {tab === 'list' && (
        <div>
          {recipes.length === 0 ? (
            <div style={s.emptyState}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🍞</div>
              <div style={{ fontSize: 16, color: '#F0C040', marginBottom: 8 }}>No recipes yet</div>
              <div style={{ fontSize: 13, color: 'rgba(253,246,236,0.5)', marginBottom: 16 }}>Add your first recipe to see exact cost and profit per product</div>
              <button style={s.startBtn} onClick={() => setTab('new')}>+ Add First Recipe</button>
            </div>
          ) : (
            <div style={s.recipeGrid}>
              {recipes.map(r => {
                return (
                  <RecipeCard key={r.id} recipe={r} ingredients={ingredients} userId={user.id} targetMargin={targetMargin} onClick={() => selectRecipe(r)} />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* NEW RECIPE */}
      {tab === 'new' && (
        <div style={s.card}>
          <div style={s.cardTitle}>+ CREATE NEW RECIPE</div>
          <form onSubmit={saveRecipe}>
            <div style={s.formGrid}>
              <div style={{ gridColumn: '1 / -1' }}>
                <F label="RECIPE NAME" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Croissant" required />
              </div>
              <div>
                <label style={s.label}>CATEGORY</label>
                <select style={s.input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {['bread', 'pastry', 'cake', 'biscuit', 'drink', 'other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <F label="BATCH SIZE (units)" type="number" value={form.batch_size} onChange={v => setForm({ ...form, batch_size: v })} placeholder="10" />
              <F label="SELLING PRICE (UGX)" type="number" value={form.sell_price} onChange={v => setForm({ ...form, sell_price: v })} placeholder="e.g. 2500" />
              <div>
                <label style={s.label}>PREP TIME (mins)</label>
                <input style={s.input} type="number" value={form.prep_minutes} onChange={e => setForm({ ...form, prep_minutes: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>BAKE TIME (mins)</label>
                <input style={s.input} type="number" value={form.bake_minutes} onChange={e => setForm({ ...form, bake_minutes: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <F label="NOTES" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Any special instructions..." />
              </div>
            </div>
            <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving...' : '+ Create Recipe → Add Ingredients'}</button>
          </form>
        </div>
      )}

      {/* RECIPE DETAIL */}
      {tab === 'detail' && selected && (
        <div>
          <div style={s.grid2}>
            {/* Cost breakdown */}
            <div style={s.card}>
              <div style={s.cardTitle}>COST BREAKDOWN — {selected.name.toUpperCase()}</div>
              {recipeIngredients.length === 0 ? (
                <div style={s.emptySmall}>No ingredients added yet. Add ingredients below to calculate costs.</div>
              ) : recipeIngredients.map(ri => (
                <div key={ri.id} style={s.ingRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#FDF6EC' }}>{ri.ingredients?.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(253,246,236,0.4)' }}>{ri.quantity} {ri.unit} × UGX {fmt(ri.ingredients?.cost_per_unit)}</div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#C8862A' }}>UGX {fmt(ri.quantity * (ri.ingredients?.cost_per_unit || 0))}</div>
                  <button style={s.delBtn} onClick={() => removeIngredient(ri.id)}>✕</button>
                </div>
              ))}

              {recipeIngredients.length > 0 && (
                <div style={s.costSummary}>
                  <div style={s.costRow}><span>Batch cost ({selected.batch_size} units)</span><span>UGX {fmt(ingredientCost)}</span></div>
                  <div style={s.costRow}><span>Cost per unit</span><span>UGX {fmt(costPerUnit)}</span></div>
                  <div style={{ borderTop: '1px solid rgba(200,134,42,0.2)', margin: '8px 0' }} />
                  <div style={s.costRow}>
                    <span>Selling price</span>
                    <input style={{ ...s.input, width: 130, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}
                      type="number" defaultValue={selected.sell_price}
                      onBlur={e => updatePrice(e.target.value)} />
                  </div>
                  <div style={s.costRow}>
                    <span>Gross margin</span>
                    <span style={{ color: parseFloat(margin) >= targetMargin ? '#90D0A0' : '#F08070', fontWeight: 700, fontSize: 18 }}>
                      {margin}%
                    </span>
                  </div>
                  {parseFloat(margin) < targetMargin && (
                    <div style={s.recAlert}>
                      ⚠️ Below {targetMargin}% target margin. Recommended price: <strong style={{ color: '#F0C040' }}>UGX {fmt(recommendedPrice)}</strong>
                    </div>
                  )}
                  {parseFloat(margin) >= targetMargin && (
                    <div style={s.goodAlert}>✅ Great margin! This product is profitable.</div>
                  )}
                </div>
              )}
            </div>

            {/* Add ingredients */}
            <div style={s.card}>
              <div style={s.cardTitle}>ADD INGREDIENTS TO RECIPE</div>
              <AddIngredientForm ingredients={ingredients} onAdd={addIngredient} />
              <div style={{ marginTop: 20, borderTop: '1px solid rgba(200,134,42,0.15)', paddingTop: 14 }}>
                <div style={s.cardTitle}>RECIPE INFO</div>
                <div style={s.infoRow}><span>Batch size</span><span>{selected.batch_size} units</span></div>
                <div style={s.infoRow}><span>Category</span><span>{selected.category}</span></div>
                <div style={s.infoRow}><span>Prep time</span><span>{selected.prep_minutes} min</span></div>
                <div style={s.infoRow}><span>Bake time</span><span>{selected.bake_minutes} min</span></div>
                <div style={s.infoRow}><span>Total time per batch</span><span>{(selected.prep_minutes || 0) + (selected.bake_minutes || 0)} min</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddIngredientForm({ ingredients, onAdd }) {
  const [ingId, setIngId] = useState('')
  const [qty, setQty] = useState('')

  const add = async () => {
    if (!ingId || !qty) return
    await onAdd(ingId, qty)
    setQty('')
  }

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label style={s.label}>INGREDIENT</label>
        <select style={s.input} value={ingId} onChange={e => setIngId(e.target.value)}>
          <option value="">Select ingredient...</option>
          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} (UGX {Number(i.cost_per_unit).toLocaleString()}/{i.unit})</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={s.label}>QUANTITY NEEDED PER BATCH</label>
        <input style={s.input} type="number" placeholder="e.g. 0.5" value={qty} onChange={e => setQty(e.target.value)} />
      </div>
      <button style={s.btn} onClick={add} disabled={!ingId || !qty}>+ Add to Recipe</button>
      {ingredients.length === 0 && (
        <div style={{ fontSize: 12, color: '#F0B070', marginTop: 10 }}>⚠️ No ingredients in inventory. Add ingredients in the Inventory module first.</div>
      )}
    </div>
  )
}

function RecipeCard({ recipe, userId, targetMargin, onClick }) {
  const [costPerUnit, setCostPerUnit] = useState(null)
  useEffect(() => {
    supabase.from('recipe_ingredients').select('quantity, ingredients(cost_per_unit)').eq('recipe_id', recipe.id).eq('user_id', userId).then(({ data }) => {
      if (data && data.length > 0) {
        const total = data.reduce((a, ri) => a + ri.quantity * (ri.ingredients?.cost_per_unit || 0), 0)
        setCostPerUnit(total / (recipe.batch_size || 1))
      }
    })
  }, [recipe.id])

  const margin = costPerUnit && recipe.sell_price > 0
    ? (((recipe.sell_price - costPerUnit) / recipe.sell_price) * 100).toFixed(0)
    : null

  return (
    <div style={s.recipeCard} onClick={onClick}>
      <div style={s.recipeHeader}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#FDF6EC' }}>{recipe.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(253,246,236,0.5)', marginTop: 2, textTransform: 'capitalize' }}>{recipe.category} · {recipe.batch_size} units/batch</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: '#F0C040' }}>UGX {fmt(recipe.sell_price)}</div>
          <div style={{ fontSize: 10, color: 'rgba(253,246,236,0.4)' }}>sell price</div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'rgba(253,246,236,0.5)' }}>
          {costPerUnit !== null ? `Cost/unit: UGX ${fmt(costPerUnit)}` : 'No ingredients added yet'}
        </div>
        {margin !== null && (
          <div style={{ ...s.marginBadge, background: parseInt(margin) >= targetMargin ? 'rgba(90,158,111,0.2)' : 'rgba(214,79,59,0.2)', color: parseInt(margin) >= targetMargin ? '#90D0A0' : '#F08070', border: `1px solid ${parseInt(margin) >= targetMargin ? 'rgba(90,158,111,0.3)' : 'rgba(214,79,59,0.3)'}` }}>
            {margin}% margin
          </div>
        )}
      </div>
    </div>
  )
}

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
  tabs: { display: 'flex', gap: 4, background: 'rgba(26,14,8,0.5)', borderRadius: 10, padding: 4, marginBottom: 16, border: '1px solid rgba(200,134,42,0.2)', flexWrap: 'wrap' },
  tab: { padding: '8px 16px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'transparent', color: 'rgba(253,246,236,0.45)', fontFamily: "'DM Sans', sans-serif" },
  tabActive: { background: '#C8862A', color: '#1A0E08' },
  recipeGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 },
  recipeCard: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 16, cursor: 'pointer' },
  recipeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  marginBadge: { fontSize: 10, padding: '3px 9px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 14 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' },
  label: { display: 'block', fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5, marginTop: 10 },
  input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 7, color: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' },
  btn: { width: '100%', padding: '11px', background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8, fontFamily: "'DM Sans', sans-serif" },
  ingRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  delBtn: { background: 'rgba(214,79,59,0.1)', color: '#F08070', border: '1px solid rgba(214,79,59,0.2)', borderRadius: 5, padding: '3px 7px', fontSize: 10, cursor: 'pointer' },
  costSummary: { background: 'rgba(26,14,8,0.4)', border: '1px solid rgba(200,134,42,0.2)', borderRadius: 10, padding: '14px', marginTop: 14 },
  costRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', color: 'rgba(253,246,236,0.7)', fontFamily: "'DM Mono', monospace" },
  recAlert: { background: 'rgba(214,79,59,0.1)', border: '1px solid rgba(214,79,59,0.25)', color: '#F08070', borderRadius: 7, padding: '8px 12px', fontSize: 12, marginTop: 8 },
  goodAlert: { background: 'rgba(90,158,111,0.1)', border: '1px solid rgba(90,158,111,0.25)', color: '#90D0A0', borderRadius: 7, padding: '8px 12px', fontSize: 12, marginTop: 8 },
  infoRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(253,246,236,0.7)', fontFamily: "'DM Mono', monospace" },
  emptyState: { textAlign: 'center', padding: '40px 20px', color: 'rgba(253,246,236,0.5)' },
  emptySmall: { color: 'rgba(253,246,236,0.3)', fontSize: 12, fontStyle: 'italic', padding: '12px 0' },
  startBtn: { background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
}
