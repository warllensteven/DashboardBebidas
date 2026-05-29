'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Invoice, Payment, PaymentMethod } from '@/types'
import {
  Search, FileText, X, CreditCard, Plus,
  Loader2, ChevronDown, ChevronUp
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function HistorialPage() {
  const supabase = createClient()

  const [invoices, setInvoices]     = useState<Invoice[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [selected, setSelected]     = useState<Invoice | null>(null)
  const [payments, setPayments]     = useState<Payment[]>([])
  const [showPayModal, setShowPayModal] = useState(false)
  const [newPayments, setNewPayments] = useState([
    { method: 'efectivo' as PaymentMethod, amount: '', reference: '' }
  ])
  const [saving, setSaving]         = useState(false)

  useEffect(() => { loadInvoices() }, [])

  async function loadInvoices() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*, clients(*), invoice_items(*, products(*)), payments(*)')
      .order('created_at', { ascending: false })
    setInvoices(data || [])
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
    const { data } = await supabase
      .from('payments').select('*').eq('invoice_id', inv.id)
    setPayments(data || [])
    const pending = inv.total - inv.amount_paid
    setNewPayments([{ method: 'efectivo', amount: String(pending > 0 ? pending : ''), reference: '' }])
    setShowPayModal(true)
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
      const { error } = await supabase.from('payments').insert(rows)
      if (error) throw error
      toast.success('Pago registrado')
      setShowPayModal(false)
      loadInvoices()
    } catch {
      toast.error('Error al registrar pago')
    } finally {
      setSaving(false)
    }
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
    const { error } = await supabase.from('invoices')
      .update({ status: 'cancelado' }).eq('id', inv.id)
    if (error) return toast.error('Error al cancelar')
    toast.success(`Factura #${inv.invoice_number} cancelada`)
    setSelected(null)
    loadInvoices()
  }

  // ── Filtros ───────────────────────────────────────────────
  const filtered = invoices.filter(inv => {
    const matchSearch =
      String(inv.invoice_number).includes(search) ||
      (inv.clients?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (inv.clients?.cedula || '').includes(search)
    const matchStatus = statusFilter ? inv.status === statusFilter : true
    const matchFrom   = dateFrom ? new Date(inv.created_at) >= new Date(dateFrom) : true
    const matchTo     = dateTo   ? new Date(inv.created_at) <= new Date(dateTo + 'T23:59:59') : true
    return matchSearch && matchStatus && matchFrom && matchTo
  })

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      pendiente: 'badge-yellow', pagado_parcial: 'badge-blue',
      pagado: 'badge-green', cancelado: 'badge-red',
    }
    const label: Record<string, string> = {
      pendiente: 'Pendiente', pagado_parcial: 'Parcial',
      pagado: 'Pagado', cancelado: 'Cancelado',
    }
    return <span className={map[status]}>{label[status]}</span>
  }

  function methodLabel(m: string) {
    const map: Record<string, string> = {
      efectivo: 'Efectivo', nequi: 'Nequi',
      banco: 'Banco', combinado: 'Combinado'
    }
    return map[m] || m
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <FileText className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-slate-800">Historial de facturas</h1>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="N° factura, cliente, cédula..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado_parcial">Parcial</option>
            <option value="pagado">Pagado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <input type="date" className="input" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)} placeholder="Desde" />
          <input type="date" className="input" value={dateTo}
            onChange={e => setDateTo(e.target.value)} placeholder="Hasta" />
        </div>
      </div>

      {/* Resultados */}
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
          {filtered.map(inv => (
            <div key={inv.id} className="card overflow-hidden">

              {/* Fila resumen — clickeable */}
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
                  <p className="text-xs text-slate-400">
                    {inv.clients?.cedula && `CC: ${inv.clients.cedula}`}
                    {inv.clients?.phone && ` · ${inv.clients.phone}`}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-slate-800">${inv.total.toLocaleString('es-CO')}</p>
                  <p className="text-xs text-emerald-600">Pagado: ${inv.amount_paid.toLocaleString('es-CO')}</p>
                </div>

                <div className="flex-shrink-0">{statusBadge(inv.status)}</div>

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
                        Productos
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
                                <td className="text-right font-semibold">
                                  ${item.subtotal.toLocaleString('es-CO')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                          <span className="text-sm font-bold text-slate-700">Total</span>
                          <span className="text-sm font-bold text-blue-600">
                            ${inv.total.toLocaleString('es-CO')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pagos y acciones */}
                    <div className="space-y-4">
                      {/* Pagos registrados */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Pagos registrados
                        </p>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          {payments.length === 0 ? (
                            <p className="text-sm text-slate-400 px-4 py-3">Sin pagos registrados</p>
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
                                    <td>{methodLabel(p.method)}</td>
                                    <td className="text-slate-400 text-xs">{p.reference || '—'}</td>
                                    <td className="text-right font-semibold text-emerald-600">
                                      ${p.amount.toLocaleString('es-CO')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {/* Saldo */}
                          <div className="flex justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                            <span className="text-sm text-slate-500">Saldo pendiente</span>
                            <span className={`text-sm font-bold ${
                              inv.total - inv.amount_paid > 0 ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                              ${(inv.total - inv.amount_paid).toLocaleString('es-CO')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Notas */}
                      {inv.notes && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notas</p>
                          <p className="text-sm text-slate-600 bg-white rounded-xl border border-slate-200 px-4 py-3">
                            {inv.notes}
                          </p>
                        </div>
                      )}

                      {/* Acciones */}
                      {inv.status !== 'cancelado' && (
                        <div className="flex gap-2">
                          {inv.status !== 'pagado' && (
                            <button
                              onClick={() => openPayModal(inv)}
                              className="btn-primary btn btn-sm flex-1"
                            >
                              <CreditCard className="w-3 h-3" /> Registrar pago
                            </button>
                          )}
                          <button
                            onClick={() => cancelInvoice(inv)}
                            className="btn-danger btn btn-sm flex-1"
                          >
                            <X className="w-3 h-3" /> Cancelar factura
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal pago */}
      {showPayModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                Pago — Factura #{selected.invoice_number}
              </h2>
              <button onClick={() => setShowPayModal(false)} className="btn-ghost btn btn-sm">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total factura</span>
                  <span className="font-semibold">${selected.total.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ya pagado</span>
                  <span className="text-emerald-600 font-semibold">${selected.amount_paid.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                  <span className="font-medium text-slate-700">Saldo pendiente</span>
                  <span className="font-bold text-amber-600">
                    ${(selected.total - selected.amount_paid).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-700">Nuevo pago</p>
                  <button
                    onClick={() => setNewPayments(p => [...p, { method: 'efectivo', amount: '', reference: '' }])}
                    className="btn-ghost btn btn-sm"
                  >
                    <Plus className="w-3 h-3" /> Agregar
                  </button>
                </div>
                {newPayments.map((p, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select className="input w-32" value={p.method}
                      onChange={e => setNewPayments(prev => prev.map((x, idx) =>
                        idx === i ? { ...x, method: e.target.value as PaymentMethod } : x))}>
                      <option value="efectivo">Efectivo</option>
                      <option value="nequi">Nequi</option>
                      <option value="banco">Banco</option>
                    </select>
                    <input type="number" className="input flex-1" placeholder="Monto"
                      value={p.amount}
                      onChange={e => setNewPayments(prev => prev.map((x, idx) =>
                        idx === i ? { ...x, amount: e.target.value } : x))} />
                    <input className="input flex-1" placeholder="Ref."
                      value={p.reference}
                      onChange={e => setNewPayments(prev => prev.map((x, idx) =>
                        idx === i ? { ...x, reference: e.target.value } : x))} />
                    {newPayments.length > 1 && (
                      <button onClick={() => setNewPayments(p => p.filter((_, idx) => idx !== i))}
                        className="btn-ghost btn btn-sm text-red-400">
                        <X className="w-4 h-4" />
                      </button>
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
    </div>
  )
}