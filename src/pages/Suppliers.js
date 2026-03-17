import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

const blankSupplier = { name: '', contact_name: '', phone: '', email: '', address: '', payment_terms: '', notes: '' }

export default function Suppliers() {
  const { user } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [orders, setOrders] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [tab, setTab] = useState('orders')
  const [form, setForm] = useState(blankSupplier)
  const [saving, setSaving] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderItems, setOrderItems] = useState([])

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [suppRes, ordersRes, ingRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('user_id', user.id).order('name'),
      supabase.from('purchase_orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('ingredients').select('*').eq('user_id', user.id)
    ])
    setSuppliers(suppRes.data || [])
    setOrders(ordersRes.data || [])
    setLowStock((ingRes.data || []).filter(i => i.stock <= i.reorder_level))
  }

  const saveSupplier = async (e) => {
    e.preventDefault(); setSaving(true)
    await supabase.from('suppliers').insert({ ...form, user_id: user.id })
    setForm(blankSupplier); setSaving(false); loadAll(); setTab('suppliers')
  }

  const createAutoOrder = async () => {
    if (lowStock.length === 0 || suppliers.length === 0) return
    setSaving(true)
    const total = lowStock.reduce((a, i) => a + ((i.reorder_level * 3) * i.cost_per_unit), 0)
    const { data: order } = await supabase.from('purchase_orders').insert({
      user_id: user.id, supplier_name: 'Multiple Suppliers',
      order_date: new Date().toISOString().split('T')[0],
      expected_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft', total_amount: total
    }).select().single()

    if (order) {
      for (const ing of lowStock) {
        const qty = ing.reorder_level * 3
        await supabase.from('purchase_order_items').insert({
          user_id: user.id, order_id: order.id, ingredient_id: ing.id,
          ingredient_name: ing.name, quantity: qty, unit: ing.unit,
          unit_price: ing.cost_per_unit, total: qty * ing.cost_per_unit
        })
      }
      await loadOrderItems(order.id)
      setSelectedOrder(order)
    }
    setSaving(false); loadAll(); setTab('orders')
  }

  const loadOrderItems = async (orderId) => {
    const { data } = await supabase.from('purchase_order_items').select('*').eq('order_id', orderId).eq('user_id', user.id)
    setOrderItems(data || [])
  }

  const updateOrderStatus = async (orderId, status) => {
    await supabase.from('purchase_orders').update({ status }).eq('id', orderId)
    if (status === 'received') {
      const items = orderItems.length > 0 ? orderItems : []
      for (const item of items) {
        if (item.ingredient_id) {
          const { data: ing } = await supabase.from('ingredients').select('stock').eq('id', item.ingredient_id).single()
          if (ing) await supabase.from('ingredients').update({ stock: ing.stock + item.quantity }).eq('id', item.ingredient_id)
        }
      }
    }
    loadAll()
  }

  const viewOrder = async (order) => {
    setSelectedOrder(order)
    await loadOrderItems(order.id)
    setTab('order-detail')
  }

  const pendingOrders = orders.filter(o => o.status === 'sent' || o.status === 'draft')
  const receivedOrders = orders.filter(o => o.status === 'received')

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>🛒 Suppliers & Orders</div>
        <div style={s.badge}>PURCHASING</div>
      </div>

      {lowStock.length > 0 && (
        <div style={s.alert}>
          ⚠️ <strong>{lowStock.length} items need restocking:</strong> {lowStock.map(i => i.name).join(', ')}
          <button style={s.autoOrderBtn} onClick={createAutoOrder} disabled={saving}>
            {saving ? '...' : '+ Auto-create Purchase Order'}
          </button>
        </div>
      )}

      <div style={s.tabs}>
        {[['orders', `Orders (${orders.length})`], ['suppliers', `Suppliers (${suppliers.length})`], ['new-supplier', '+ Add Supplier'], ...(selectedOrder ? [['order-detail', 'Order Detail']] : [])].map(([id, label]) => (
          <button key={id} style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ORDERS */}
      {tab === 'orders' && (
        <div>
          {orders.length === 0 ? (
            <div style={s.emptyState}>
              <div style={{ fontSize: 13, color: 'rgba(253,246,236,0.4)', textAlign: 'center', padding: '30px 0' }}>
                No purchase orders yet. When ingredients run low, auto-create an order from the alert above.
              </div>
            </div>
          ) : (
            <table style={s.table}>
              <thead><tr>{['Date', 'Supplier', 'Items', 'Total', 'Status', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td style={s.td}>{o.order_date}</td>
                    <td style={s.td}>{o.supplier_name}</td>
                    <td style={s.td}>—</td>
                    <td style={s.td}>UGX {fmt(o.total_amount)}</td>
                    <td style={s.td}><span style={{ ...s.statusBadge, ...getStatusStyle(o.status) }}>{o.status}</span></td>
                    <td style={s.td}>
                      <button style={s.viewBtn} onClick={() => viewOrder(o)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ORDER DETAIL */}
      {tab === 'order-detail' && selectedOrder && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={s.cardTitle}>PURCHASE ORDER — {selectedOrder.order_date}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedOrder.status === 'draft' && (
                <button style={s.sendBtn} onClick={() => updateOrderStatus(selectedOrder.id, 'sent')}>Mark as Sent</button>
              )}
              {selectedOrder.status === 'sent' && (
                <button style={{ ...s.sendBtn, background: 'rgba(90,158,111,0.3)', color: '#90D0A0' }} onClick={() => updateOrderStatus(selectedOrder.id, 'received')}>
                  ✅ Mark as Received (updates stock)
                </button>
              )}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={{ ...s.statusBadge, ...getStatusStyle(selectedOrder.status) }}>{selectedOrder.status}</span>
            <span style={{ fontSize: 12, color: 'rgba(253,246,236,0.5)', marginLeft: 10 }}>Supplier: {selectedOrder.supplier_name}</span>
          </div>
          <table style={s.table}>
            <thead><tr>{['Ingredient', 'Qty', 'Unit', 'Unit Price', 'Total'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {orderItems.map(item => (
                <tr key={item.id}>
                  <td style={s.td}>{item.ingredient_name}</td>
                  <td style={s.td}>{item.quantity}</td>
                  <td style={s.td}>{item.unit}</td>
                  <td style={s.td}>UGX {fmt(item.unit_price)}</td>
                  <td style={s.td}>UGX {fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, fontSize: 16, fontFamily: "'DM Mono', monospace", color: '#F0C040' }}>
            Total: UGX {fmt(selectedOrder.total_amount)}
          </div>
        </div>
      )}

      {/* SUPPLIERS LIST */}
      {tab === 'suppliers' && (
        <div>
          {suppliers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(253,246,236,0.3)', fontSize: 13 }}>No suppliers yet. Add your first supplier!</div>
          ) : suppliers.map(sup => (
            <div key={sup.id} style={s.supplierCard}>
              <div style={s.suppAvatar}>{sup.name[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#FDF6EC' }}>{sup.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(253,246,236,0.5)', marginTop: 2 }}>
                  {sup.contact_name && `${sup.contact_name} · `}{sup.phone}
                </div>
              </div>
              {sup.payment_terms && <div style={s.termsTag}>{sup.payment_terms}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ADD SUPPLIER */}
      {tab === 'new-supplier' && (
        <div style={s.card}>
          <div style={s.cardTitle}>+ ADD SUPPLIER</div>
          <form onSubmit={saveSupplier}>
            <F label="SUPPLIER NAME" value={form.name} onChange={v => setForm({ ...form, name: v })} required placeholder="e.g. Mukwano Industries" />
            <F label="CONTACT PERSON" value={form.contact_name} onChange={v => setForm({ ...form, contact_name: v })} placeholder="e.g. John Mukasa" />
            <F label="PHONE / WHATSAPP" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+256 700 000 000" />
            <F label="EMAIL" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="supplier@example.com" />
            <F label="ADDRESS" value={form.address} onChange={v => setForm({ ...form, address: v })} placeholder="e.g. Nkrumah Road, Kampala" />
            <F label="PAYMENT TERMS" value={form.payment_terms} onChange={v => setForm({ ...form, payment_terms: v })} placeholder="e.g. 30 days net / Cash on delivery" />
            <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving...' : '+ Add Supplier'}</button>
          </form>
        </div>
      )}
    </div>
  )
}

const getStatusStyle = (status) => {
  if (status === 'received') return { background: 'rgba(90,158,111,0.2)', color: '#90D0A0', border: '1px solid rgba(90,158,111,0.3)' }
  if (status === 'sent') return { background: 'rgba(125,191,173,0.2)', color: '#7DBFAD', border: '1px solid rgba(125,191,173,0.3)' }
  return { background: 'rgba(200,134,42,0.15)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)' }
}

const F = ({ label, type = 'text', value, onChange, placeholder, required }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={s.label}>{label}</label>
    <input style={s.input} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
  </div>
)

const fmt = (n) => Number(Math.round(n) || 0).toLocaleString()

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  badge: { fontSize: 10, background: 'rgba(200,134,42,0.2)', color: '#C8862A', padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  alert: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(224,140,58,0.12)', border: '1px solid rgba(224,140,58,0.3)', color: '#F0B070', borderRadius: 10, padding: '10px 16px', fontSize: 13, marginBottom: 16, gap: 12 },
  autoOrderBtn: { background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" },
  tabs: { display: 'flex', gap: 4, background: 'rgba(26,14,8,0.5)', borderRadius: 10, padding: 4, marginBottom: 16, border: '1px solid rgba(200,134,42,0.2)' },
  tab: { padding: '8px 14px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'transparent', color: 'rgba(253,246,236,0.45)', fontFamily: "'DM Sans', sans-serif" },
  tabActive: { background: '#C8862A', color: '#1A0E08' },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 14 },
  label: { display: 'block', fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5 },
  input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 7, color: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' },
  btn: { width: '100%', padding: '11px', background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4, fontFamily: "'DM Sans', sans-serif" },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, borderBottom: '1px solid rgba(200,134,42,0.2)' },
  td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(253,246,236,0.8)', fontFamily: "'DM Mono', monospace" },
  statusBadge: { fontSize: 9, padding: '3px 10px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  viewBtn: { background: 'rgba(200,134,42,0.15)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' },
  sendBtn: { background: 'rgba(200,134,42,0.2)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  supplierCard: { display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 10, padding: '14px 16px', marginBottom: 10 },
  suppAvatar: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(200,134,42,0.25)', color: '#C8862A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 },
  termsTag: { fontSize: 10, background: 'rgba(125,191,173,0.15)', color: '#7DBFAD', padding: '3px 10px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  emptyState: { background: 'rgba(61,43,31,0.4)', border: '1px solid rgba(200,134,42,0.1)', borderRadius: 12, padding: 20 },
}
