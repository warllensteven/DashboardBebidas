'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart2, Package, TrendingUp, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

interface ProductStat {
  product_id: string
  name: string
  total_quantity: number
  total_revenue: number
  invoice_count: number
}

export default function ReportesPage() {
  const supabase = createClient()

  const [stats, setStats]     = useState<ProductStat[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0])
  const [dateTo, setDateTo]     = useState(new Date().toISOString().split('T')[0])
  const [view, setView]         = useState<'cantidad' | 'ingresos'>('cantidad')

  useEffect(() => { loadStats() }, [dateFrom, dateTo])

 async function loadStats() {
  setLoading(true)

  // Facturas válidas del período sin convertir zonas horarias
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id')
    .neq('status', 'cancelado')
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lte('created_at', `${dateTo}T23:59:59`)

  if (!invoices || invoices.length === 0) {
    setStats([])
    setLoading(false)
    return
  }

  const invoiceIds = invoices.map(i => i.id)

  const { data: items } = await supabase
    .from('invoice_items')
    .select('product_id, quantity, unit_price, subtotal, products(name)')
    .in('invoice_id', invoiceIds)

  const map: Record<string, ProductStat> = {}
  for (const item of items || []) {
    const pid  = item.product_id
    const name = (item.products as any)?.name || 'Desconocido'
    if (!map[pid]) map[pid] = { product_id: pid, name, total_quantity: 0, total_revenue: 0, invoice_count: 0 }
    map[pid].total_quantity += item.quantity
    map[pid].total_revenue  += item.subtotal
    map[pid].invoice_count  += 1
  }

  const sorted = Object.values(map).sort((a, b) =>
    view === 'cantidad' ? b.total_quantity - a.total_quantity : b.total_revenue - a.total_revenue
  )
  setStats(sorted)
  setLoading(false)
}
  const chartData = stats.slice(0, 10).map(s => ({
    name: s.name.length > 15 ? s.name.slice(0, 15) + '…' : s.name,
    cantidad: s.total_quantity,
    ingresos: s.total_revenue,
  }))

  const totalUnits   = stats.reduce((s, i) => s + i.total_quantity, 0)
  const totalRevenue = stats.reduce((s, i) => s + i.total_revenue, 0)

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart2 className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-slate-800">Reporte de ventas por producto</h1>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
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
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => { setDateFrom(new Date().toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]) }}
              className="btn-secondary btn btn-sm">Hoy</button>
            <button
              onClick={() => {
                const d = new Date(); d.setDate(d.getDate() - 6)
                setDateFrom(d.toISOString().split('T')[0])
                setDateTo(new Date().toISOString().split('T')[0])
              }}
              className="btn-secondary btn btn-sm">7 días</button>
            <button
              onClick={() => {
                const d = new Date()
                setDateFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0])
                setDateTo(new Date().toISOString().split('T')[0])
              }}
              className="btn-secondary btn btn-sm">Este mes</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Productos distintos</p>
          <p className="text-2xl font-bold text-slate-800">{stats.length}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Total unidades vendidas</p>
          <p className="text-2xl font-bold text-slate-800">{totalUnits}</p>
        </div>
        <div className="card card-body col-span-2 lg:col-span-1">
          <p className="text-xs text-slate-500 mb-1">Total ingresos</p>
          <p className="text-2xl font-bold text-emerald-600">${totalRevenue.toLocaleString('es-CO')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : stats.length === 0 ? (
        <div className="card card-body text-center py-16">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay ventas en este período</p>
        </div>
      ) : (
        <>
          {/* Gráfica */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-slate-800">Top 10 productos</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setView('cantidad')}
                  className={`btn btn-sm ${view === 'cantidad' ? 'btn-primary' : 'btn-secondary'}`}>
                  Por cantidad
                </button>
                <button
                  onClick={() => setView('ingresos')}
                  className={`btn btn-sm ${view === 'ingresos' ? 'btn-primary' : 'btn-secondary'}`}>
                  Por ingresos
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={v => view === 'ingresos' ? `$${(v/1000).toFixed(0)}k` : String(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} width={120} />
                <Tooltip
                  formatter={(value) => view === 'ingresos'
                    ? [`$${Number(value).toLocaleString('es-CO')}`, 'Ingresos']
                    : [Number(value), 'Unidades']
                  }
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                />
                <Bar dataKey={view === 'cantidad' ? 'cantidad' : 'ingresos'}
                  fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla detallada */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Producto</th>
                  <th className="text-center">Unidades vendidas</th>
                  <th className="text-center">En facturas</th>
                  <th className="text-right">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={s.product_id}>
                    <td className="text-slate-400 font-mono">{i + 1}</td>
                    <td className="font-medium">{s.name}</td>
                    <td className="text-center">
                      <span className="badge-blue">{s.total_quantity} uds</span>
                    </td>
                    <td className="text-center text-slate-500">{s.invoice_count}</td>
                    <td className="text-right font-semibold text-emerald-600">
                      ${s.total_revenue.toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}