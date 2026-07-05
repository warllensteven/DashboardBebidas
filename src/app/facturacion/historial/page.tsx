'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Invoice, Payment, PaymentMethod, DeliveryMan, Product } from '@/types'
import {
  Search, FileText, X, CreditCard, Plus,
  Loader2, ChevronDown, ChevronUp, Bike,
  CheckCircle, Clock, Pencil, Trash2, Save
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function HistorialPage() {
  const supabase = createClient()

  const [invoices, setInvoices]         = useState<Invoice[]>([])
  const [products, setProducts]         = useState<Product[]>([])
  const [deliveryMen, setDeliveryMen]   = useState<DeliveryMan[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deliveryFilter, setDeliveryFilter] = useState('')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [selected, setSelected]         = useState<Invoice | null>(null)
  const [payments, setPayments]         = useState<Payment[]>([])
  const [showPayModal, setShowPayModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [newPayments, setNewPayments]   = useState([
    { method: 'efectivo' as PaymentMethod, amount: '', reference: '' }
  ])
  const [saving, setSaving]             = useState(false)

  // Edit state
  const [editCart, setEditCart]         = useState<{ product_id: string; name: string; quantity: number; unit_price: number; item_id?: string }[]>([])
  const [editProductSearch, setEditProductSearch] = useState('')
  const [showEditProductSearch, setShowEditProductSearch] = useState(false)
  const [editDeliveryManId, setEditDeliveryManId] = useState('')
  const [editDeliverySearch, setEditDeliverySearch] = useState('')
  const [showEditDeliverySearch, setShowEditDeliverySearch] = useState(false)
  const [editDelivered, setEditDelivered] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: invs }, { data: prods }, { data: dlv }] = await Promise.all([
      supabase.from('invoices')
        .select('*, clients(*), invoice_items(*, products(*)), payments(*), delivery_men(*)')
        .order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('active', true).order('name'),
      supabase.from('delivery_men').select('*').eq('active', true).order('name'),
    ])
    setInvoices(invs || [])
    setProducts(prods || [])
    setDeliveryMen(dlv || [])
    setLoading(false)
  }

  async function openDetail(inv: Invoice) {
    if (selected?.id === inv.id) { setSelected(null); return }
    setSelected(inv)
    const { data } = await supabase
      .from('payments').select('*').eq('invoice_id', inv.id).order('created_at')
    setPayments(data || [])
  }

  async function openPayModal(inv: Invoice) {
    setSelected(inv)
    const { data } = await supabase.from('payments').select('*').eq('invoice_id', inv.id)
    setPayments(data || [])
    const pending = inv.total - inv.amount_paid
    setNewPayments([{ method: 'efectivo', amount: String(pending > 0 ? pending : ''), reference: '' }])
    setShowPayModal(true)
  }

  function openEditModal(inv: Invoice) {
    setSelected(inv)
    setEditCart(
      (inv.invoice_items || []).map(item => ({
        item_id: item.id,
        product_id: item.product_id,
        name: item.products?.name || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))
    )
    setEditDeliveryManId(inv.delivery_man_id || '')
    setEditDelivered(inv.delivered)
    setShowEditModal(true)
  }

  async function handleSaveEdit() {
    if (!selected) return
    if (editCart.length === 0) return toast.error('La factura debe tener al menos un producto')
    setSaving(true)

    try {
      // Obtener items originales para restaurar stock
      const { data: originalItems } = await supabase
        .from('invoice_items').select('*, products(stock)')
        .eq('invoice_id', selected.id)

      // Restaurar stock de items originales
      for (const item of originalItems || []) {
        await supabase.from('products')
          .update({ stock: (item.products?.stock || 0) + item.quantity })
          .eq('id', item.product_id)
      }

      // Eliminar items originales
      await supabase.from('invoice_items').delete().eq('invoice_id', selected.id)

      // Insertar nuevos items (trigger descuenta stock)
      const newItems = editCart.map(i => ({
        invoice_id: selected.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }))
      await supabase.from('invoice_items').insert(newItems)

      // Actualizar domiciliario y entregado
      await supabase.from('invoices').update({
        delivery_man_id: editDeliveryManId || null,
        delivered: editDelivered,
      }).eq('id', selected.id)

      toast.success('Factura actualizada')
      setShowEditModal(false)
      setSelected(null)
      loadData()
    } catch {
      toast.error('Error al actualizar factura')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddPayment() {
    if (!selected) return
    const valid = newPayments.filter(p => parseFloat(p.amount) > 0)
    if (valid.length === 0) return toast.error('Ingresa un monto válido')
    setSaving(true)
    try {
      const rows = valid.map(p => ({
        invoice_id: selected.id,
        amount: parseFloat(p.amount),
        method: valid.length > 1 ? 'combinado' as PaymentMethod : p.method,
        reference: p.reference || null,
      }))
      await supabase.from('payments').insert(rows)
      toast.success('Pago registrado')
      setShowPayModal(false)
      loadData()
    } catch {
      toast.error('Error al registrar pago')
    } finally {
      setSaving(false)
    }
  }

  async function toggleDelivered(inv: Invoice) {
    const { error } = await supabase.from('invoices')
      .update({ delivered: !inv.delivered }).eq('id', inv.id)
    if (error) return toast.error('Error al actualizar')
    toast.success(inv.delivered ? 'Marcado como no entregado' : 'Marcado como entregado')
    loadData()
  }

  async function cancelInvoice(inv: Invoice) {
    if (!confirm(`¿Cancelar la factura #${inv.invoice_number}?`)) return
    for (const item of inv.invoice_items || []) {
      await supabase.from('products')
        .update({ stock: (item.products?.stock || 0) + item.quantity })
        .eq('id', item.product_id)
      await supabase.from('stock_movements').insert({
        product_id: item.product_id, type: 'entrada',
        quantity: item.quantity,
        reason: `Cancelación factura #${inv.invoice_number}`,
        invoice_id: inv.id,
      })
    }
    await supabase.from('invoices').update({ status: 'cancelado' }).eq('id', inv.id)
    toast.success(`Factura #${inv.invoice_number} cancelada`)
    setSelected(null)
    loadData()
  }

  // Edit cart helpers
  function addToEditCart(p: Product) {
    setEditCart(prev => {
      const exists = prev.find(i => i.product_id === p.id)
      if (exists) return prev.map(i =>
        i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i
      )
      return [...prev, { product_id: p.id, name: p.name, quantity: 1, unit_price: p.price }]
    })
    setEditProductSearch('')
    setShowEditProductSearch(false)
  }

  function updateEditQty(pid: string, qty: number) {
    if (qty <= 0) setEditCart(prev => prev.filter(i => i.product_id !== pid))
    else setEditCart(prev => prev.map(i => i.product_id === pid ? { ...i, quantity: qty } : i))
  }

  function updateEditPrice(pid: string, price: number) {
    setEditCart(prev => prev.map(i => i.product_id === pid ? { ...i, unit_price: price } : i))
  }

  // Filtros
  const filtered = invoices.filter(inv => {
    const matchSearch =
      String(inv.invoice_number).includes(search) ||
      (inv.clients?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (inv.clients?.cedula || '').includes(search)
    const matchStatus   = statusFilter ? inv.status === statusFilter : true
    const matchDelivery = deliveryFilter ? inv.delivery_man_id === deliveryFilter : true
    const matchFrom     = dateFrom ? new Date(inv.created_at) >= new Date(dateFrom) : true
    const matchTo       = dateTo ? new Date(inv.created_at) <= new Date(dateTo + 'T23:59:59') : true
    return matchSearch && matchStatus && matchDelivery && matchFrom && matchTo
  })

  function statusBadge(inv: Invoice) {
    const map: Record<string, string> = {
      pendiente: 'badge-yellow', pagado_parcial: 'badge-blue',
      pagado: 'badge-green', cancelado: 'badge-red',
    }
    const label: Record<string, string> = {
      pendiente: 'Pendiente', pagado_parcial: 'Parcial',
      pagado: 'Pagado', cancelado: 'Cancelado',
    }
    return <span className={map[inv.status]}>{label[inv.status]}</span>
  }

  function rowColor(inv: Invoice) {
    if (inv.status === 'cancelado') return 'opacity-50'
    if (inv.status === 'pagado') return 'border-l-4 border-l-emerald-400'
    if (inv.status === 'pagado_parcial') return 'border-l-4 border-l-blue-400'
    if (inv.status === 'pendiente') return 'border-l-4 border-l-amber-400'
    return ''
  }

  const editSubtotal = editCart.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const editTotalUnits = editCart.reduce((s, i) => s + i.quantity, 0)
  const filteredEditProducts = products.filter(p =>
    p.name.toLowerCase().includes(editProductSearch.toLowerCase())
  )
  const filteredEditDelivery = deliveryMen.filter(d =>
    d.name.toLowerCase().includes(editDeliverySearch.toLowerCase())
  )
  const selectedEditDelivery = deliveryMen.find(d => d.id === editDeliveryManId)

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <FileText className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-slate-800">Historial de facturas</h1>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="N° factura, cliente, cédula..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado_parcial">Parcial</option>
            <option value="pagado">Pagado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <select className="input" value={deliveryFilter} onChange={e => setDeliveryFilter(e.target.value)}>
            <option value="">Todos los domiciliarios</option>
            {deliveryMen.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-slate-400 px-1">{filtered.length} facturas encontradas</p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card card-body text-center py-16">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No se encontraron facturas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => {
            const totalUnits = (inv.invoice_items || []).reduce((s, i) => s + i.quantity, 0)
            return (
              <div key={inv.id} className={`card overflow-hidden ${rowColor(inv)}`}>
                {/* Fila resumen */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => openDetail(inv)}
                >
                  <div className="flex-shrink-0">
                    <p className="font-mono font-bold text-blue-600 text-lg">#{inv.invoice_number}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(inv.created_at).toLocaleDateString('es-CO', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">
                      {inv.clients?.name || <span className="text-slate-400">Sin cliente</span>}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {inv.is_delivery && (
                        <span className="text-xs text-blue-500 flex items-center gap-1">
                          <Bike className="w-3 h-3" />
                          {inv.delivery_men?.name || 'Sin asignar'}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{totalUnits} uds</span>
                      {inv.delivered && (
                        <span className="text-xs text-emerald-500 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Entregado
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-slate-800">${inv.total.toLocaleString('es-CO')}</p>
                    <p className="text-xs text-emerald-600">Pagado: ${inv.amount_paid.toLocaleString('es-CO')}</p>
                  </div>

                  <div className="flex-shrink-0">{statusBadge(inv)}</div>

                  <div className="flex-shrink-0 text-slate-400">
                    {selected?.id === inv.id
                      ? <ChevronUp className="w-4 h-4" />
                      : <ChevronDown className="w-4 h-4" />
                    }
                  </div>
                </div>

                {/* Detalle expandible */}
                {selected?.id === inv.id && (
                  <div className="border-t border-slate-100 p-4 space-y-4 animate-fade-in bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {/* Productos */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Productos ({totalUnits} unidades)
                        </p>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Producto</th>
                                <th className="text-center">Cant.</th>
                                <th className="text-right">Precio</th>
                                <th className="text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inv.invoice_items?.map(item => (
                                <tr key={item.id}>
                                  <td className="font-medium">{item.products?.name || '—'}</td>
                                  <td className="text-center">{item.quantity}</td>
                                  <td className="text-right">${item.unit_price.toLocaleString('es-CO')}</td>
                                  <td className="text-right font-semibold">${item.subtotal.toLocaleString('es-CO')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                            <span className="text-sm font-bold text-slate-700">Total</span>
                            <span className="text-sm font-bold text-blue-600">${inv.total.toLocaleString('es-CO')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pagos y acciones */}
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Pagos registrados
                          </p>
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            {payments.length === 0 ? (
                              <p className="text-sm text-slate-400 px-4 py-3">Sin pagos</p>
                            ) : (
                              <table className="table">
                                <thead>
                                  <tr>
                                    <th>Método</th>
                                    <th>Referencia</th>
                                    <th className="text-right">Monto</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {payments.map(p => (
                                    <tr key={p.id}>
                                      <td className="capitalize">{p.method}</td>
                                      <td className="text-slate-400 text-xs">{p.reference || '—'}</td>
                                      <td className="text-right font-semibold text-emerald-600">
                                        ${p.amount.toLocaleString('es-CO')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            <div className="flex justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                              <span className="text-sm text-slate-500">Saldo pendiente</span>
                              <span className={`text-sm font-bold ${inv.total - inv.amount_paid > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                ${(inv.total - inv.amount_paid).toLocaleString('es-CO')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {inv.notes && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notas</p>
                            <p className="text-sm text-slate-600 bg-white rounded-xl border border-slate-200 px-4 py-3">{inv.notes}</p>
                          </div>
                        )}

                        {/* Acciones */}
                        {inv.status !== 'cancelado' && (
                          <div className="grid grid-cols-2 gap-2">
                            {inv.status !== 'pagado' && (
                              <button onClick={() => openPayModal(inv)} className="btn-primary btn btn-sm">
                                <CreditCard className="w-3 h-3" /> Pago
                              </button>
                            )}
                            <button onClick={() => openEditModal(inv)} className="btn-secondary btn btn-sm">
                              <Pencil className="w-3 h-3" /> Editar
                            </button>
                            <button onClick={() => toggleDelivered(inv)}
                              className={`btn btn-sm ${inv.delivered ? 'btn-secondary' : 'btn-primary'}`}>
                              {inv.delivered
                                ? <><Clock className="w-3 h-3" /> Sin entregar</>
                                : <><CheckCircle className="w-3 h-3" /> Entregar</>
                              }
                            </button>
                            <button onClick={() => cancelInvoice(inv)} className="btn-danger btn btn-sm">
                              <X className="w-3 h-3" /> Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal pago */}
      {showPayModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Pago — Factura #{selected.invoice_number}</h2>
              <button onClick={() => setShowPayModal(false)} className="btn-ghost btn btn-sm"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total</span>
                  <span className="font-semibold">${selected.total.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pagado</span>
                  <span className="text-emerald-600 font-semibold">${selected.amount_paid.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                  <span className="font-medium">Saldo</span>
                  <span className="font-bold text-amber-600">${(selected.total - selected.amount_paid).toLocaleString('es-CO')}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Nuevo pago</p>
                  <button onClick={() => setNewPayments(p => [...p, { method: 'efectivo', amount: '', reference: '' }])}
                    className="btn-ghost btn btn-sm"><Plus className="w-3 h-3" /> Agregar</button>
                </div>
                {newPayments.map((p, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select className="input w-32" value={p.method}
                      onChange={e => setNewPayments(prev => prev.map((x, idx) => idx === i ? { ...x, method: e.target.value as PaymentMethod } : x))}>
                      <option value="efectivo">Efectivo</option>
                      <option value="nequi">Nequi</option>
                      <option value="banco">Banco</option>
                    </select>
                    <input type="number" className="input flex-1" placeholder="Monto" value={p.amount}
                      onChange={e => setNewPayments(prev => prev.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} />
                    <input className="input flex-1" placeholder="Ref." value={p.reference}
                      onChange={e => setNewPayments(prev => prev.map((x, idx) => idx === i ? { ...x, reference: e.target.value } : x))} />
                    {newPayments.length > 1 && (
                      <button onClick={() => setNewPayments(p => p.filter((_, idx) => idx !== i))}
                        className="btn-ghost btn btn-sm text-red-400"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowPayModal(false)} className="btn-secondary btn">Cancelar</button>
              <button onClick={handleAddPayment} disabled={saving} className="btn-primary btn">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar factura */}
      {showEditModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Editar factura #{selected.invoice_number}</h2>
              <button onClick={() => setShowEditModal(false)} className="btn-ghost btn btn-sm"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Productos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">Productos</p>
                  <span className="text-xs text-slate-400">{editTotalUnits} uds · ${editSubtotal.toLocaleString('es-CO')}</span>
                </div>
                <div className="space-y-2 mb-3">
                  {editCart.map(item => (
                    <div key={item.product_id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <p className="flex-1 text-sm font-medium truncate">{item.name}</p>
                      <input type="number" min="1" value={item.quantity}
                        onChange={e => updateEditQty(item.product_id, parseInt(e.target.value))}
                        className="input w-16 text-center py-1 text-sm" />
                      <span className="text-slate-400 text-xs">×</span>
                      <input type="number" min="0" value={item.unit_price}
                        onChange={e => updateEditPrice(item.product_id, parseFloat(e.target.value))}
                        className="input w-24 text-center py-1 text-sm" />
                      <button onClick={() => setEditCart(prev => prev.filter(i => i.product_id !== item.product_id))}
                        className="btn-ghost btn btn-sm text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input className="input pl-9" placeholder="Agregar producto..."
                    value={editProductSearch}
                    onChange={e => { setEditProductSearch(e.target.value); setShowEditProductSearch(true) }}
                    onFocus={() => setShowEditProductSearch(true)} />
                  {showEditProductSearch && editProductSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredEditProducts.map(p => (
                        <button key={p.id} onClick={() => addToEditCart(p)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between text-sm">
                          <span>{p.name}</span>
                          <span className="text-blue-600">${p.price.toLocaleString('es-CO')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Domiciliario */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Domiciliario</p>
                {selectedEditDelivery ? (
                  <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                    <p className="font-medium text-slate-800">{selectedEditDelivery.name}</p>
                    <button onClick={() => setEditDeliveryManId('')} className="btn-ghost btn btn-sm">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input className="input" placeholder="Buscar domiciliario..."
                      value={editDeliverySearch}
                      onChange={e => { setEditDeliverySearch(e.target.value); setShowEditDeliverySearch(true) }}
                      onFocus={() => setShowEditDeliverySearch(true)} />
                    {showEditDeliverySearch && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredEditDelivery.map(d => (
                          <button key={d.id}
                            onClick={() => { setEditDeliveryManId(d.id); setEditDeliverySearch(''); setShowEditDeliverySearch(false) }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">{d.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Entregado */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Estado de entrega</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-slate-600">{editDelivered ? 'Entregado' : 'Sin entregar'}</span>
                  <div onClick={() => setEditDelivered(!editDelivered)}
                    className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${editDelivered ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow mt-1 transition-transform ${editDelivered ? 'translate-x-5' : 'translate-x-1'}`} />
                  </div>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowEditModal(false)} className="btn-secondary btn">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={saving} className="btn-primary btn">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar cambios</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}