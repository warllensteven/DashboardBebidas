'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Invoice, Payment, PaymentMethod } from '@/types'
import {
  ShoppingCart, CheckCircle, XCircle, Clock,
  Loader2, CreditCard, Plus, X, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function CajaPage() {
  const supabase = createClient()

  const [invoices, setInvoices]     = useState<Invoice[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Invoice | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [payments, setPayments]     = useState<Payment[]>([])
  const [newPayments, setNewPayments] = useState([
    { method: 'efectivo' as PaymentMethod, amount: '', reference: '' }
  ])
  const [saving, setSaving]         = useState(false)
  const [filter, setFilter]         = useState<'todos' | 'pendiente' | 'pagado_parcial' | 'pagado' | 'cancelado'>('todos')

  useEffect(() => { loadInvoices() }, [])

  async function loadInvoices() {
    setLoading(true)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('invoices')
      .select('*, clients(*), invoice_items(*, products(*)), payments(*)')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })

    setInvoices(data || [])
    setLoading(false)
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
    if (!confirm(`¿Cancelar la factura #${inv.invoice_number}? Se restaurará el stock.`)) return

    // Restaurar stock de cada item
    for (const item of inv.invoice_items || []) {
      await supabase.from('products')
        .update({ stock: (item.products?.stock || 0) + item.quantity })
        .eq('id', item.product_id)

      await supabase.from('stock_movements').insert({
        product_id: item.product_id,
        type: 'entrada',
        quantity: item.quantity,
        reason: `Cancelación factura #${inv.invoice_number}`,
        invoice_id: inv.id,
      })
    }

    const { error } = await supabase
      .from('invoices').update({ status: 'cancelado' }).eq('id', inv.id)
    if (error) return toast.error('Error al cancelar')
    toast.success(`Factura #${inv.invoice_number} cancelada`)
    loadInvoices()
  }

  // ── Estadísticas del día ──────────────────────────────────
  const stats = {
    total:    invoices.filter(i => i.status !== 'cancelado').reduce((s, i) => s + i.total, 0),
    cobrado:  invoices.filter(i => i.status !== 'cancelado').reduce((s, i) => s + i.amount_paid, 0),
    pendiente: invoices.filter(i => i.status !== 'cancelado').reduce((s, i) => s + (i.total - i.amount_paid), 0),
    count:    invoices.filter(i => i.status !== 'cancelado').length,
  }

  const filtered = invoices.filter(i => filter === 'todos' ? true : i.status === filter)

  function statusBadge(status: string) {
    const cfg: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
      pendiente:      { cls: 'badge-yellow', label: 'Pendiente',  icon: <Clock className="w-3 h-3" /> },
      pagado_parcial: { cls: 'badge-blue',   label: 'Parcial',    icon: <CreditCard className="w-3 h-3" /> },
      pagado:         { cls: 'badge-green',  label: 'Pagado',     icon: <CheckCircle className="w-3 h-3" /> },
      cancelado:      { cls: 'badge-red',    label: 'Cancelado',  icon: <XCircle className="w-3 h-3" /> },
    }
    const c = cfg[status] || cfg.pendiente
    return <span className={c.cls}>{c.icon} {c.label}</span>
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Caja / Ventas del día</h1>
        </div>
        <button onClick={loadInvoices} className="btn-secondary btn btn-sm">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Stats del día */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Ventas hoy</p>
          <p className="text-2xl font-bold text-slate-800">{stats.count}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Total facturado</p>
          <p className="text-xl font-bold text-slate-800">${stats.total.toLocaleString('es-CO')}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Total cobrado</p>
          <p className="text-xl font-bold text-emerald-600">${stats.cobrado.toLocaleString('es-CO')}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Por cobrar</p>
          <p className="text-xl font-bold text-amber-600">${stats.pendiente.toLocaleString('es-CO')}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['todos', 'pendiente', 'pagado_parcial', 'pagado', 'cancelado'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
          >
            {f === 'todos' ? 'Todos' :
             f === 'pendiente' ? 'Pendientes' :
             f === 'pagado_parcial' ? 'Parciales' :
             f === 'pagado' ? 'Pagados' : 'Cancelados'}
          </button>
        ))}
      </div>

      {/* Tabla de ventas */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Factura</th>
                <th>Cliente</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Hora</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-slate-400 py-12">
                    No hay ventas registradas hoy
                  </td>
                </tr>
              ) : filtered.map(inv => (
                <tr key={inv.id}>
                  <td className="font-mono font-bold text-blue-600">#{inv.invoice_number}</td>
                  <td>{inv.clients?.name || <span className="text-slate-400">—</span>}</td>
                  <td>
                    <div className="max-w-48">
                      {inv.invoice_items?.map(item => (
                        <p key={item.id} className="text-xs text-slate-500 truncate">
                          {item.quantity}× {item.products?.name}
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="font-semibold">${inv.total.toLocaleString('es-CO')}</td>
                  <td className="text-emerald-600 font-medium">${inv.amount_paid.toLocaleString('es-CO')}</td>
                  <td className={inv.total - inv.amount_paid > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                    ${(inv.total - inv.amount_paid).toLocaleString('es-CO')}
                  </td>
                  <td>{statusBadge(inv.status)}</td>
                  <td className="text-slate-400 text-xs">
                    {new Date(inv.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {inv.status !== 'pagado' && inv.status !== 'cancelado' && (
                        <button
                          onClick={() => openPayModal(inv)}
                          className="btn-primary btn btn-sm"
                          title="Registrar pago"
                        >
                          <CreditCard className="w-3 h-3" />
                        </button>
                      )}
                      {inv.status !== 'cancelado' && inv.status !== 'pagado' && (
                        <button
                          onClick={() => cancelInvoice(inv)}
                          className="btn-danger btn btn-sm"
                          title="Cancelar factura"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: registrar pago */}
      {showPayModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                Registrar pago — Factura #{selected.invoice_number}
              </h2>
              <button onClick={() => setShowPayModal(false)} className="btn-ghost btn btn-sm">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Resumen */}
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
                  <span className="text-slate-700 font-medium">Saldo pendiente</span>
                  <span className="text-amber-600 font-bold">
                    ${(selected.total - selected.amount_paid).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              {/* Pagos anteriores */}
              {payments.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-2">Pagos anteriores</p>
                  {payments.map(p => (
                    <div key={p.id} className="flex justify-between text-sm py-1">
                      <span className="capitalize text-slate-600">{p.method}</span>
                      <span className="font-medium">${p.amount.toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Nuevo pago */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-700">Nuevo pago</p>
                  <button onClick={() => setNewPayments(p => [...p, { method: 'efectivo', amount: '', reference: '' }])}
                    className="btn-ghost btn btn-sm">
                    <Plus className="w-3 h-3" /> Agregar
                  </button>
                </div>
                {newPayments.map((p, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select className="input w-32"
                      value={p.method}
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