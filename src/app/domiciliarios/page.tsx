'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DeliveryMan, DeliveryShift, DeliveryExpense } from '@/types'
import {
  Bike, Plus, Pencil, Loader2, X, Save,
  DollarSign, Trash2, ChevronDown, ChevronUp
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function DomiciliariosPage() {
  const supabase = createClient()

  const [deliveryMen, setDeliveryMen] = useState<DeliveryMan[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<string | null>(null)
  const [shifts, setShifts]           = useState<Record<string, DeliveryShift>>({})
  const [expenses, setExpenses]       = useState<Record<string, DeliveryExpense[]>>({})

  // Form nuevo/editar domiciliario
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState<DeliveryMan | null>(null)
  const [name, setName]               = useState('')
  const [phone, setPhone]             = useState('')
  const [saving, setSaving]           = useState(false)

  // Base del turno
  const [baseAmount, setBaseAmount]   = useState('')
  const [savingBase, setSavingBase]   = useState<string | null>(null)

  // Gastos
  const [expenseDesc, setExpenseDesc]     = useState<Record<string, string>>({})
  const [expenseAmount, setExpenseAmount] = useState<Record<string, string>>({})
  const [savingExpense, setSavingExpense] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('delivery_men').select('*').order('name')
    setDeliveryMen(data || [])

    // Cargar turnos y gastos de hoy
    const today = new Date().toISOString().split('T')[0]
    const ids = (data || []).map(d => d.id)

    if (ids.length > 0) {
      const [{ data: shiftData }, { data: expData }] = await Promise.all([
        supabase.from('delivery_shifts').select('*')
          .in('delivery_man_id', ids).eq('date', today),
        supabase.from('delivery_expenses').select('*')
          .in('delivery_man_id', ids).eq('date', today),
      ])

      const shiftMap: Record<string, DeliveryShift> = {}
      for (const s of shiftData || []) shiftMap[s.delivery_man_id] = s
      setShifts(shiftMap)

      const expMap: Record<string, DeliveryExpense[]> = {}
      for (const e of expData || []) {
        if (!expMap[e.delivery_man_id]) expMap[e.delivery_man_id] = []
        expMap[e.delivery_man_id].push(e)
      }
      setExpenses(expMap)
    }
    setLoading(false)
  }

  function openNew() {
    setEditing(null); setName(''); setPhone('')
    setShowForm(true)
  }

  function openEdit(d: DeliveryMan) {
    setEditing(d); setName(d.name); setPhone(d.phone || '')
    setShowForm(true)
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('El nombre es obligatorio')
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('delivery_men')
        .update({ name, phone: phone || null }).eq('id', editing.id)
      if (error) { toast.error('Error al actualizar'); setSaving(false); return }
      toast.success('Domiciliario actualizado')
    } else {
      const { error } = await supabase.from('delivery_men')
        .insert({ name, phone: phone || null })
      if (error) { toast.error('Error al crear'); setSaving(false); return }
      toast.success('Domiciliario creado')
    }
    setSaving(false)
    setShowForm(false)
    loadData()
  }

  async function toggleActive(d: DeliveryMan) {
    await supabase.from('delivery_men').update({ active: !d.active }).eq('id', d.id)
    toast.success(d.active ? 'Desactivado' : 'Activado')
    loadData()
  }

  async function saveBase(deliveryManId: string) {
    if (!baseAmount) return toast.error('Ingresa un monto')
    setSavingBase(deliveryManId)
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('delivery_shifts').upsert({
      delivery_man_id: deliveryManId,
      base_amount: parseFloat(baseAmount),
      date: today,
    }, { onConflict: 'delivery_man_id,date' })
    if (error) { toast.error('Error al guardar base'); setSavingBase(null); return }
    toast.success('Base registrada')
    setSavingBase(null)
    setBaseAmount('')
    loadData()
  }

  async function addExpense(deliveryManId: string) {
    const desc   = expenseDesc[deliveryManId] || ''
    const amount = expenseAmount[deliveryManId] || ''
    if (!desc.trim() || !amount) return toast.error('Completa descripción y monto')
    setSavingExpense(deliveryManId)
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('delivery_expenses').insert({
      delivery_man_id: deliveryManId,
      description: desc,
      amount: parseFloat(amount),
      date: today,
    })
    if (error) { toast.error('Error al guardar gasto'); setSavingExpense(null); return }
    toast.success('Gasto registrado')
    setSavingExpense(null)
    setExpenseDesc(prev => ({ ...prev, [deliveryManId]: '' }))
    setExpenseAmount(prev => ({ ...prev, [deliveryManId]: '' }))
    loadData()
  }

  async function deleteExpense(expenseId: string, deliveryManId: string) {
    await supabase.from('delivery_expenses').delete().eq('id', expenseId)
    toast.success('Gasto eliminado')
    loadData()
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Bike className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Domiciliarios</h1>
        </div>
        <button onClick={openNew} className="btn-primary btn">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : deliveryMen.length === 0 ? (
        <div className="card card-body text-center py-16">
          <Bike className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay domiciliarios registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliveryMen.map(d => {
            const shift    = shifts[d.id]
            const exps     = expenses[d.id] || []
            const totalExp = exps.reduce((s, e) => s + e.amount, 0)
            const isOpen   = selected === d.id

            return (
              <div key={d.id} className={`card overflow-hidden ${!d.active ? 'opacity-60' : ''}`}>
                {/* Header del domiciliario */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelected(isOpen ? null : d.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Bike className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-400">{d.phone || 'Sin teléfono'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Base hoy</p>
                    <p className="font-bold text-slate-800">
                      ${(shift?.base_amount || 0).toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Gastos hoy</p>
                    <p className="font-bold text-red-500">
                      ${totalExp.toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!d.active && <span className="badge-gray">Inactivo</span>}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* Panel expandible */}
                {isOpen && (
                  <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/50 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {/* Base del turno */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Base del turno hoy
                        </p>
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                          {shift ? (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-slate-500">Base asignada</p>
                                <p className="text-xl font-bold text-slate-800">
                                  ${shift.base_amount.toLocaleString('es-CO')}
                                </p>
                              </div>
                              <span className="badge-green">Registrada</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-sm text-slate-500">Sin base registrada hoy</p>
                              <div className="flex gap-2">
                                <input
                                  type="number" min="0"
                                  className="input flex-1"
                                  placeholder="Monto base"
                                  value={baseAmount}
                                  onChange={e => setBaseAmount(e.target.value)}
                                />
                                <button
                                  onClick={() => saveBase(d.id)}
                                  disabled={savingBase === d.id}
                                  className="btn-primary btn btn-sm"
                                >
                                  {savingBase === d.id
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <Save className="w-3 h-3" />
                                  }
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Gastos */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Gastos del día
                        </p>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          {exps.length > 0 && (
                            <table className="table">
                              <tbody>
                                {exps.map(e => (
                                  <tr key={e.id}>
                                    <td className="text-sm">{e.description}</td>
                                    <td className="text-right text-red-500 font-medium">
                                      ${e.amount.toLocaleString('es-CO')}
                                    </td>
                                    <td className="w-8">
                                      <button
                                        onClick={() => deleteExpense(e.id, d.id)}
                                        className="btn-ghost btn btn-sm text-red-400"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          <div className="p-3 space-y-2 border-t border-slate-100">
                            <input
                              className="input"
                              placeholder="Descripción (gasolina, almuerzo...)"
                              value={expenseDesc[d.id] || ''}
                              onChange={e => setExpenseDesc(prev => ({ ...prev, [d.id]: e.target.value }))}
                            />
                            <div className="flex gap-2">
                              <input
                                type="number" min="0"
                                className="input flex-1"
                                placeholder="Monto"
                                value={expenseAmount[d.id] || ''}
                                onChange={e => setExpenseAmount(prev => ({ ...prev, [d.id]: e.target.value }))}
                              />
                              <button
                                onClick={() => addExpense(d.id)}
                                disabled={savingExpense === d.id}
                                className="btn-primary btn btn-sm"
                              >
                                {savingExpense === d.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <><Plus className="w-3 h-3" /> Agregar</>
                                }
                              </button>
                            </div>
                          </div>
                          {exps.length > 0 && (
                            <div className="flex justify-between px-4 py-2 bg-slate-50 border-t border-slate-100">
                              <span className="text-sm font-medium text-slate-600">Total gastos</span>
                              <span className="text-sm font-bold text-red-500">
                                ${totalExp.toLocaleString('es-CO')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button onClick={() => openEdit(d)} className="btn-secondary btn btn-sm">
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                      <button onClick={() => toggleActive(d)}
                        className={`btn btn-sm ${d.active ? 'btn-ghost text-red-400' : 'btn-ghost text-emerald-500'}`}>
                        {d.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuevo/editar */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                {editing ? 'Editar domiciliario' : 'Nuevo domiciliario'}
              </h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost btn btn-sm">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" placeholder="Nombre completo"
                  value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input" placeholder="Celular"
                  value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary btn">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary btn">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}