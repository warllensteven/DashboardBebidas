'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, TrendingUp, ShoppingCart,
  Package, AlertTriangle, Loader2, RefreshCw
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts'

interface SalesStat {
  label: string
  total: number
  count: number
}

interface Stats {
  today: number
  todayCount: number
  week: number
  month: number
  pending: number
  lowStock: any[]
  dailyData: SalesStat[]
  weeklyData: SalesStat[]
  monthlyData: SalesStat[]
}

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView]     = useState<'dia' | 'semana' | 'mes'>('dia')

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)

    const now   = new Date()
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Facturas del mes (para calcular todo)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total, amount_paid, status, created_at')
      .neq('status', 'cancelado')
      .gte('created_at', monthStart.toISOString())
      .order('created_at')

    const all = invoices || []

    // Hoy
    const todayInvs = all.filter(i => new Date(i.created_at) >= today)
    const todayTotal = todayInvs.reduce((s, i) => s + i.total, 0)
    const todayCount = todayInvs.length

    // Semana
    const weekInvs  = all.filter(i => new Date(i.created_at) >= weekStart)
    const weekTotal  = weekInvs.reduce((s, i) => s + i.total, 0)

    // Mes
    const monthTotal = all.reduce((s, i) => s + i.total, 0)

    // Pendiente por cobrar
    const pending = all.reduce((s, i) => s + (i.total - i.amount_paid), 0)

    // Productos con bajo stock
    const { data: lowStock } = await supabase
      .from('products')
      .select('id, name, stock, categories(name)')
      .eq('active', true)
      .lte('stock', 10)
      .order('stock')
      .limit(5)

    // ── Datos para gráficas ───────────────────────────────

    // Últimos 7 días
    const dailyMap: Record<string, { total: number; count: number }> = {}
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now)
      date.setDate(now.getDate() - d)
      const key = date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })
      dailyMap[key] = { total: 0, count: 0 }
    }
    weekInvs.forEach(i => {
      const key = new Date(i.created_at).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })
      if (dailyMap[key]) {
        dailyMap[key].total += i.total
        dailyMap[key].count += 1
      }
    })
    const dailyData = Object.entries(dailyMap).map(([label, v]) => ({ label, ...v }))

    // Últimas 4 semanas
    const weeklyMap: Record<string, { total: number; count: number }> = {}
    for (let w = 3; w >= 0; w--) {
      const key = `Sem -${w === 0 ? 'actual' : w}`
      weeklyMap[key] = { total: 0, count: 0 }
    }
    all.forEach(i => {
      const diff = Math.floor((now.getTime() - new Date(i.created_at).getTime()) / (7 * 86400000))
      const key = `Sem -${diff === 0 ? 'actual' : Math.min(diff, 3)}`
      if (weeklyMap[key]) {
        weeklyMap[key].total += i.total
        weeklyMap[key].count += 1
      }
    })
    const weeklyData = Object.entries(weeklyMap).map(([label, v]) => ({ label, ...v }))

    // Días del mes actual
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const monthlyMap: Record<string, { total: number; count: number }> = {}
    for (let d = 1; d <= daysInMonth; d++) {
      monthlyMap[String(d)] = { total: 0, count: 0 }
    }
    all.forEach(i => {
      const day = String(new Date(i.created_at).getDate())
      if (monthlyMap[day]) {
        monthlyMap[day].total += i.total
        monthlyMap[day].count += 1
      }
    })
    const monthlyData = Object.entries(monthlyMap).map(([label, v]) => ({ label, ...v }))

    setStats({
      today: todayTotal, todayCount, week: weekTotal,
      month: monthTotal, pending,
      lowStock: lowStock || [],
      dailyData, weeklyData, monthlyData,
    })
    setLoading(false)
  }

  const chartData = stats
    ? view === 'dia' ? stats.dailyData
    : view === 'semana' ? stats.weeklyData
    : stats.monthlyData
    : []

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        </div>
        <button onClick={loadStats} className="btn-secondary btn btn-sm">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-body">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">Ventas hoy</p>
            <ShoppingCart className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-800">${stats!.today.toLocaleString('es-CO')}</p>
          <p className="text-xs text-slate-400 mt-1">{stats!.todayCount} facturas</p>
        </div>

        <div className="card card-body">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">Esta semana</p>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-800">${stats!.week.toLocaleString('es-CO')}</p>
        </div>

        <div className="card card-body">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">Este mes</p>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-slate-800">${stats!.month.toLocaleString('es-CO')}</p>
        </div>

        <div className="card card-body">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">Por cobrar</p>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-600">${stats!.pending.toLocaleString('es-CO')}</p>
        </div>
      </div>

      {/* Gráfica */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-slate-800">Ventas</h2>
          <div className="flex gap-2">
            {(['dia', 'semana', 'mes'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-secondary'}`}
              >
                {v === 'dia' ? 'Últimos 7 días' : v === 'semana' ? 'Por semana' : 'Este mes'}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value) => [`$${Number(value).toLocaleString('es-CO')}`, 'Total']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
            />
            <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Línea de facturas por día */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-800 mb-6">Número de facturas — últimos 7 días</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={stats!.dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [Number(value), 'Facturas']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
            />
            <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Productos con bajo stock */}
      {stats!.lowStock.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-slate-800">Productos con stock bajo</h2>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {stats!.lowStock.map(p => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-slate-400">{p.categories?.name || '—'}</td>
                  <td>
                    <span className={`badge ${p.stock === 0 ? 'badge-red' : 'badge-yellow'}`}>
                      {p.stock} uds
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}