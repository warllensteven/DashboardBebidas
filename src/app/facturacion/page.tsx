'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Client, PaymentMethod, DeliveryMan } from '@/types'
import {
  FileText, Plus, Search, Trash2, Loader2,
  User, CreditCard, X, Bike
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CartItem {
  product: Product
  quantity: number
  unit_price: number
}

interface PaymentEntry {
  method: PaymentMethod
  amount: string
  reference: string
}

export default function FacturacionPage() {
  const supabase = createClient()

  const [products, setProducts]         = useState<Product[]>([])
  const [clients, setClients]           = useState<Client[]>([])
  const [deliveryMen, setDeliveryMen]   = useState<DeliveryMan[]>([])
  const [loading, setLoading]           = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [cart, setCart]                 = useState<CartItem[]>([])
  const [clientId, setClientId]         = useState('')
  const [clientName, setClientName]     = useState('')
  const [clientCedula, setClientCedula] = useState('')
  const [clientPhone, setClientPhone]   = useState('')
  const [notes, setNotes]               = useState('')
  const [invoiceNum, setInvoiceNum]     = useState<number | null>(null)
  const [isDelivery, setIsDelivery]     = useState(false)
  const [deliveryManId, setDeliveryManId] = useState('')
  const [payments, setPayments]         = useState<PaymentEntry[]>([
    { method: 'efectivo', amount: '', reference: '' }
  ])
  const [saving, setSaving]             = useState(false)

  const [productSearch, setProductSearch]         = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [clientSearch, setClientSearch]           = useState('')
  const [showClientSearch, setShowClientSearch]   = useState(false)
  const [deliverySearch, setDeliverySearch]       = useState('')
  const [showDeliverySearch, setShowDeliverySearch] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)

    const [{ data: prods }, { data: cls }, { data: dlv }] = await Promise.all([
      supabase.from('products').select('*, categories(*)').eq('active', true).order('name'),
      supabase.from('clients').select('*').order('name'),
      supabase.from('delivery_men').select('*').eq('active', true).order('name'),
    ])
    setProducts(prods || [])
    setClients(cls || [])
    setDeliveryMen(dlv || [])

    const { data: last } = await supabase
      .from('invoices').select('invoice_number')
      .order('invoice_number', { ascending: false }).limit(1)
    setInvoiceNum(last?.[0]?.invoice_number ? last[0].invoice_number + 1 : 1000)
    setLoading(false)
  }

  function addToCart(p: Product) {
    setCart(prev => {
      const exists = prev.find(i => i.product.id === p.id)
      if (exists) return prev.map(i =>
        i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i
      )
      return [...prev, { product: p, quantity: 1, unit_price: p.price }]
    })
    setProductSearch('')
    setShowProductSearch(false)
    toast.success(`${p.name} agregado`)
  }

  function updateCartQty(id: string, qty: number) {
    if (qty <= 0) return removeFromCart(id)
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, quantity: qty } : i))
  }

  function updateCartPrice(id: string, price: number) {
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, unit_price: price } : i))
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(i => i.product.id !== id))
  }

  const subtotal  = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const totalUnits = cart.reduce((s, i) => s + i.quantity, 0)
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const remaining = subtotal - totalPaid

  function addPayment() {
    setPayments(prev => [...prev, { method: 'efectivo', amount: '', reference: '' }])
  }

  function updatePayment(i: number, field: keyof PaymentEntry, value: string) {
    setPayments(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  function removePayment(i: number) {
    setPayments(prev => prev.filter((_, idx) => idx !== i))
  }

  function selectClient(c: Client) {
    setClientId(c.id)
    setClientName(c.name)
    setClientCedula(c.cedula || '')
    setClientPhone(c.phone || '')
    setClientSearch('')
    setShowClientSearch(false)
  }

  function clearClient() {
    setClientId(''); setClientName(''); setClientCedula(''); setClientPhone('')
  }

  async function handleSave() {
    if (cart.length === 0) return toast.error('Agrega al menos un producto')
    setSaving(true)

    try {
      let finalClientId = clientId || null
      if (!clientId && clientName) {
        const { data: newClient, error: cErr } = await supabase
          .from('clients')
          .insert({ name: clientName, cedula: clientCedula || null, phone: clientPhone || null })
          .select().single()
        if (cErr) throw new Error('Error creando cliente')
        finalClientId = newClient.id
      }

      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          client_id: finalClientId,
          subtotal, total: subtotal,
          amount_paid: totalPaid,
          notes: notes || null,
          is_delivery: isDelivery,
          delivery_man_id: isDelivery && deliveryManId ? deliveryManId : null,
          delivered: false,
          created_by: currentUserId,
          status: totalPaid === 0 ? 'pendiente' : totalPaid >= subtotal ? 'pagado' : 'pagado_parcial',
        })
        .select().single()
      if (invErr) throw new Error('Error creando factura')

      const items = cart.map(i => ({
        invoice_id: invoice.id,
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }))
      const { error: itemsErr } = await supabase.from('invoice_items').insert(items)
      if (itemsErr) throw new Error('Error insertando items')

      const validPayments = payments.filter(p => parseFloat(p.amount) > 0)
      if (validPayments.length > 0) {
        const payRows = validPayments.map(p => ({
          invoice_id: invoice.id,
          amount: parseFloat(p.amount),
          method: validPayments.length > 1 ? 'combinado' : p.method,
          reference: p.reference || null,
        }))
        await supabase.from('payments').insert(payRows)
      }

      toast.success(`✅ Factura #${invoice.invoice_number} creada`)
      setCart([]); setClientId(''); setClientName(''); setClientCedula('')
      setClientPhone(''); setNotes(''); setIsDelivery(false); setDeliveryManId('')
      setPayments([{ method: 'efectivo', amount: '', reference: '' }])
      loadData()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) && p.stock > 0
  )
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.cedula || '').includes(clientSearch)
  )
  const filteredDelivery = deliveryMen.filter(d =>
    d.name.toLowerCase().includes(deliverySearch.toLowerCase())
  )
  const selectedDeliveryMan = deliveryMen.find(d => d.id === deliveryManId)

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <FileText className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-slate-800">Nueva factura</h1>
      </div>

      {/* Número de factura */}
      <div className="card card-body">
        <div className="flex items-center gap-4">
          <label className="label mb-0 whitespace-nowrap">N° Factura:</label>
          <input
            type="number"
            className="input w-36"
            value={invoiceNum || ''}
            onChange={e => setInvoiceNum(parseInt(e.target.value))}
          />
          <span className="text-xs text-slate-400">Puedes modificarlo manualmente</span>
        </div>
      </div>

      {/* Cliente */}
      <div className="card p-4 space-y-3">
        <p className="font-semibold text-slate-700 flex items-center gap-2">
          <User className="w-4 h-4" /> Cliente
        </p>
        {clientId ? (
          <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
            <div>
              <p className="font-medium text-slate-800">{clientName}</p>
              <p className="text-xs text-slate-500">{clientCedula} · {clientPhone}</p>
            </div>
            <button onClick={clearClient} className="btn-ghost btn btn-sm">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <input
                className="input"
                placeholder="Buscar cliente existente..."
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientSearch(true) }}
                  onFocus={() => setShowClientSearch(true)}
                  onBlur={() => setTimeout(() => setShowClientSearch(false), 150)}
              />
              {showClientSearch && clientSearch && filteredClients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filteredClients.map(c => (
                    <button key={c.id} onClick={() => selectClient(c)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-slate-400 ml-2">{c.cedula}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 text-center">— o ingresa uno nuevo —</p>
            <input className="input" placeholder="Nombre *" value={clientName}
              onChange={e => setClientName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Cédula" value={clientCedula}
                onChange={e => setClientCedula(e.target.value)} />
              <input className="input" placeholder="Celular" value={clientPhone}
                onChange={e => setClientPhone(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Domicilio */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-700 flex items-center gap-2">
            <Bike className="w-4 h-4" /> Domicilio
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-slate-600">¿Es domicilio?</span>
            <div
              onClick={() => { setIsDelivery(!isDelivery); setDeliveryManId('') }}
              className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${isDelivery ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow mt-1 transition-transform ${isDelivery ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </label>
        </div>

        {isDelivery && (
          <div className="relative">
            {selectedDeliveryMan ? (
              <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                <div>
                  <p className="font-medium text-slate-800">{selectedDeliveryMan.name}</p>
                  {selectedDeliveryMan.phone && (
                    <p className="text-xs text-slate-500">{selectedDeliveryMan.phone}</p>
                  )}
                </div>
                <button onClick={() => setDeliveryManId('')} className="btn-ghost btn btn-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <input
  className="input"
  placeholder="Buscar domiciliario..."
  value={deliverySearch}
  onChange={e => { setDeliverySearch(e.target.value); setShowDeliverySearch(true) }}
  onFocus={() => setShowDeliverySearch(true)}
  onBlur={() => setTimeout(() => setShowDeliverySearch(false), 150)}
/>
                {showDeliverySearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredDelivery.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-400">Sin resultados</p>
                    ) : filteredDelivery.map(d => (
                      <button key={d.id}
                        onClick={() => { setDeliveryManId(d.id); setDeliverySearch(''); setShowDeliverySearch(false) }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">
                        {d.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Productos */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-700">Productos</p>
          {cart.length > 0 && (
            <span className="text-xs text-slate-400">{totalUnits} unidades · {cart.length} referencias</span>
          )}
        </div>

        {cart.length > 0 && (
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.product.name}</p>
                </div>
                <input type="number" min="1" value={item.quantity}
                  onChange={e => updateCartQty(item.product.id, parseInt(e.target.value))}
                  className="input w-16 text-center py-1 text-sm" />
                <span className="text-slate-400 text-xs">×</span>
                <input type="number" min="0" value={item.unit_price}
                  onChange={e => updateCartPrice(item.product.id, parseFloat(e.target.value))}
                  className="input w-24 text-center py-1 text-sm" />
                <span className="text-sm font-semibold text-slate-700 w-24 text-right">
                  ${(item.quantity * item.unit_price).toLocaleString('es-CO')}
                </span>
                <button onClick={() => removeFromCart(item.product.id)}
                  className="btn-ghost btn btn-sm text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Buscar y agregar producto..."
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
                <button key={p.id} onClick={() => addToCart(p)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-slate-400 ml-2">Stock: {p.stock}</span>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">
                    ${p.price.toLocaleString('es-CO')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pagos */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-700 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Forma de pago
          </p>
          <button onClick={addPayment} className="btn-ghost btn btn-sm">
            <Plus className="w-3 h-3" /> Agregar
          </button>
        </div>
        {payments.map((p, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select className="input w-36" value={p.method}
              onChange={e => updatePayment(i, 'method', e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="nequi">Nequi</option>
              <option value="banco">Banco</option>
            </select>
            <input type="number" min="0" className="input flex-1" placeholder="Monto"
              value={p.amount} onChange={e => updatePayment(i, 'amount', e.target.value)} />
            <input className="input flex-1" placeholder="Referencia (opcional)"
              value={p.reference} onChange={e => updatePayment(i, 'reference', e.target.value)} />
            {payments.length > 1 && (
              <button onClick={() => removePayment(i)} className="btn-ghost btn btn-sm text-red-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Notas */}
      <div className="card p-4">
        <label className="label">Notas (opcional)</label>
        <textarea className="input" rows={2} value={notes}
          onChange={e => setNotes(e.target.value)} placeholder="Observaciones..." />
      </div>

      {/* Totales */}
      <div className="card p-4 space-y-2">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Total productos</span>
          <span>{totalUnits} unidades en {cart.length} referencias</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Subtotal</span>
          <span>${subtotal.toLocaleString('es-CO')}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Total pagado</span>
          <span className="text-emerald-600">${totalPaid.toLocaleString('es-CO')}</span>
        </div>
        {remaining > 0 && (
          <div className="flex justify-between text-sm font-semibold text-amber-600">
            <span>Saldo pendiente</span>
            <span>${remaining.toLocaleString('es-CO')}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-slate-800 border-t border-slate-100 pt-2">
          <span>Total factura</span>
          <span>${subtotal.toLocaleString('es-CO')}</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || cart.length === 0}
          className="btn-primary btn w-full btn-lg mt-2"
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
            : <><FileText className="w-4 h-4" /> Crear factura</>
          }
        </button>
      </div>
    </div>
  )
}