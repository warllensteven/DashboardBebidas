'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, PurchaseOrder, PurchaseOrderItem } from '@/types'
import {
  Truck, Plus, Search, Trash2, Loader2,
  X, ChevronDown, ChevronUp, Save
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProveedoresPage() {
  const supabase = createClient()

  const [orders, setOrders]       = useState<PurchaseOrder[]>([])
  const [products, setProducts]   = useState<Product[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  // Form nueva orden
  const [notes, setNotes]         = useState('')
  const [items, setItems]         = useState<{ product_id: string; name: string; quantity: number; unit_cost: string }[]>([])
  const [productSearch, setProductSearch]         = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: ords }, { data: prods }] = await Promise.all([
      supabase.from('purchase_orders')
        .select('*, purchase_order_items(*, products(name, stock))')
        .order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('active', true).order('name'),
    ])
    setOrders(ords || [])
    setProducts(prods || [])
    setLoading(false)
  }

  function addItem(p: Product) {
    setItems(prev => {
      const exists = prev.find(i => i.product_id === p.id)
      if (exists) return prev.map(i =>
        i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i
      )
      return [...prev, { product_id: p.id, name: p.name, quantity: 1, unit_cost: '' }]
    })
    setProductSearch('')
    setShowProductSearch(false)
  }

  function updateQty(pid: string, qty: number) {
    if (qty <= 0) setItems(prev => prev.filter(i => i.product_id !== pid))
    else setItems(prev => prev.map(i => i.product_id === pid ? { ...i, quantity: qty } : i))
  }

  function updateCost(pid: string, cost: string) {
    setItems(prev => prev.map(i => i.product_id === pid ? { ...i, unit_cost: cost } : i))
  }

  async function handleSave() {
    if (items.length === 0) return toast.error('Agrega al menos un producto')
    setSaving(true)

    try {
      // Crear orden
      const { data: order, error: ordErr } = await supabase
        .from('purchase_orders')
        .insert({ notes: notes || null })
        .select().single()
      if (ordErr) throw new Error('Error creando orden')

      // Insertar items
      const rows = items.map(i => ({
        purchase_order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_cost: i.unit_cost ? parseFloat(i.unit_cost) : null,
      }))
      const { error: itemsErr } = await supabase.from('purchase_order_items').insert(rows)
      if (itemsErr) throw new Error('Error insertando items')

      // Actualizar stock de cada producto
      for (const item of items) {
        const product = products.find(p => p.id === item.product_id)
        if (!product) continue
        await supabase.from('products')
          .update({ stock: product.stock + item.quantity })
          .eq('id', item.product_id)

        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          type: 'entrada',
          quantity: item.quantity,
          reason: `Pedido proveedor — orden #${order.id.slice(0, 8)}`,
        })
      }

      toast.success('Entrada de mercancía registrada')
      setShowForm(false)
      setItems([])
      setNotes('')
      loadData()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function deleteOrder(order: PurchaseOrder) {
    if (!confirm('¿Eliminar esta entrada? El stock NO se revertirá automáticamente.')) return
    await supabase.from('purchase_orders').delete().eq('id', order.id)
    toast.success('Entrada eliminada')
    loadData()
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  const filtered = orders.filter(o => {
    const matchFrom = dateFrom ? o.created_at >= `${dateFrom}T00:00:00` : true
    const matchTo   = dateTo   ? o.created_at <= `${dateTo}T23:59:59`   : true
    return matchFrom && matchTo
  })

  const totalUnitsToday = orders
    .filter(o => o.created_at.startsWith(new Date().toISOString().split('T')[0]))
    .reduce((s, o) => s + (o.purchase_order_items || []).reduce((ss, i) => ss + i.quantity, 0), 0)

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Truck className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Entradas de mercancía</h1>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary btn">
          <Plus className="w-4 h-4" /> Nueva entrada
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Entradas hoy</p>
          <p className="text-2xl font-bold text-slate-800">
            {orders.filter(o => o.created_at.startsWith(new Date().toISOString().split('T')[0])).length}
          </p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Unidades recibidas hoy</p>
          <p className="text-2xl font-bold text-emerald-600">{totalUnitsToday}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex gap-3 flex-wrap">
        <div>
          <label className="label">Desde</label>
          <input type="date" className="input w-44"
            value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input type="date" className="input w-44"
            value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo('') }}
            className="btn-ghost btn btn-sm mt-5">
            <X className="w-4 h-4" /> Limpiar
          </button>
        )}
      </div>

      {/* Lista de órdenes */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card card-body text-center py-16">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay entradas registradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => {
            const totalUnits = (order.purchase_order_items || []).reduce((s, i) => s + i.quantity, 0)
            const isOpen = selected === order.id
            return (
              <div key={order.id} className="card overflow-hidden">
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelected(isOpen ? null : order.id)}
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">
                      {(order.purchase_order_items || []).length} producto(s) · {totalUnits} unidades
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(order.created_at).toLocaleDateString('es-CO', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                    {order.notes && (
                      <p className="text-xs text-slate-500 mt-0.5">{order.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge-green">{totalUnits} uds</span>
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />
                    }
                  </div>
                </div>

                {/* Detalle */}
                {isOpen && (
                  <div className="border-t border-slate-100 p-4 animate-fade-in bg-slate-50/50">
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th className="text-center">Cantidad</th>
                            <th className="text-right">Costo unit.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(order.purchase_order_items || []).map(item => (
                            <tr key={item.id}>
                              <td className="font-medium">{(item.products as any)?.name || '—'}</td>
                              <td className="text-center">
                                <span className="badge-blue">{item.quantity} uds</span>
                              </td>
                              <td className="text-right text-slate-500">
                                {item.unit_cost ? `$${item.unit_cost.toLocaleString('es-CO')}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={() => deleteOrder(order)} className="btn-danger btn btn-sm">
                      <Trash2 className="w-3 h-3" /> Eliminar entrada
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva entrada */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Nueva entrada de mercancía</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost btn btn-sm">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Productos agregados */}
              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.product_id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <p className="flex-1 text-sm font-medium truncate">{item.name}</p>
                      <input type="number" min="1" value={item.quantity}
                        onChange={e => updateQty(item.product_id, parseInt(e.target.value))}
                        className="input w-20 text-center py-1 text-sm" />
                      <span className="text-xs text-slate-400">uds</span>
                      <input type="number" min="0" value={item.unit_cost}
                        onChange={e => updateCost(item.product_id, e.target.value)}
                        className="input w-28 text-center py-1 text-sm"
                        placeholder="Costo" />
                      <button onClick={() => setItems(prev => prev.filter(i => i.product_id !== item.product_id))}
                        className="btn-ghost btn btn-sm text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Buscador productos */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="Buscar producto para agregar..."
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowProductSearch(true) }}
                  onFocus={() => setShowProductSearch(true)}
                  onBlur={() => setTimeout(() => setShowProductSearch(false), 150)}
                />
                {showProductSearch && productSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-400">Sin resultados</p>
                    ) : filteredProducts.map(p => (
                      <button key={p.id} onClick={() => addItem(p)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-sm">
                        <span>{p.name}</span>
                        <span className="text-slate-400">Stock actual: {p.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notas */}
              <div>
                <label className="label">Notas (opcional)</label>
                <textarea className="input" rows={2} value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ej: Llegaron 120 six packs de Águila..." />
              </div>

              {/* Resumen */}
              {items.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-3 text-sm">
                  <p className="font-medium text-blue-800">
                    {items.length} producto(s) · {items.reduce((s, i) => s + i.quantity, 0)} unidades totales
                  </p>
                  <p className="text-blue-600 text-xs mt-0.5">
                    El stock se actualizará automáticamente al guardar
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary btn">Cancelar</button>
              <button onClick={handleSave} disabled={saving || items.length === 0} className="btn-primary btn">
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  : <><Save className="w-4 h-4" /> Registrar entrada</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}