'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Category } from '@/types'
import { Archive, Search, Plus, Minus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'

export default function InventarioPage() {
  const supabase = createClient()

  const [products, setProducts]     = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('')
  const [adjusting, setAdjusting]   = useState<string | null>(null)
  const [qty, setQty]               = useState<Record<string, number>>({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*, categories(*)').eq('active', true).order('name'),
      supabase.from('categories').select('*').order('name'),
    ])
    setProducts(prods || [])
    setCategories(cats || [])
    setLoading(false)
  }

  async function adjustStock(product: Product, delta: number) {
    const amount = qty[product.id] || 1
    const change = delta * amount
    const newStock = product.stock + change

    if (newStock < 0) return toast.error('El stock no puede ser negativo')

    setAdjusting(product.id)

    const { error } = await supabase
      .from('products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', product.id)

    if (error) {
      toast.error('Error al ajustar stock')
      setAdjusting(null)
      return
    }

    // Registrar movimiento
    await supabase.from('stock_movements').insert({
      product_id: product.id,
      type: delta > 0 ? 'entrada' : 'salida',
      quantity: Math.abs(change),
      reason: delta > 0 ? 'Entrada manual de mercancía' : 'Ajuste manual',
    })

    toast.success(`Stock actualizado: ${newStock} unidades`)
    setAdjusting(null)
    loadData()
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat    = catFilter ? p.category_id === catFilter : true
    return matchSearch && matchCat
  })

  const stockStats = {
    total:    products.length,
    ok:       products.filter(p => p.stock > 20).length,
    low:      products.filter(p => p.stock > 0 && p.stock <= 20).length,
    empty:    products.filter(p => p.stock === 0).length,
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Archive className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-slate-800">Inventario</h1>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Total productos</p>
          <p className="text-2xl font-bold text-slate-800">{stockStats.total}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Stock OK</p>
          <p className="text-2xl font-bold text-emerald-600">{stockStats.ok}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Stock bajo</p>
          <p className="text-2xl font-bold text-amber-600">{stockStats.low}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-slate-500 mb-1">Agotados</p>
          <p className="text-2xl font-bold text-red-600">{stockStats.empty}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Buscar producto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-48"
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card card-body text-center py-16">
          <Archive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay productos en inventario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => {
            const isAdjusting = adjusting === p.id
            const amount = qty[p.id] || 1

            return (
              <div key={p.id} className="card overflow-hidden">
                {/* Imagen */}
                <div className="h-36 bg-slate-100 relative">
                  {p.image_url ? (
                    <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Archive className="w-10 h-10 text-slate-300" />
                    </div>
                  )}
                  {/* Badge stock */}
                  <span className={`absolute top-2 right-2 badge ${
                    p.stock === 0 ? 'badge-red' :
                    p.stock <= 20 ? 'badge-yellow' : 'badge-green'
                  }`}>
                    {p.stock === 0 ? 'Agotado' : `${p.stock} uds`}
                  </span>
                </div>

                <div className="p-4">
                  <p className="font-semibold text-slate-800 truncate mb-1">{p.name}</p>
                  <p className="text-xs text-slate-400 mb-3">
                    {(p as any).categories?.name || 'Sin categoría'}
                  </p>

                  {/* Control de cantidad */}
                  <div className="flex items-center gap-2 mb-3">
                    <label className="text-xs text-slate-500">Cantidad:</label>
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={e => setQty(prev => ({
                        ...prev,
                        [p.id]: Math.max(1, parseInt(e.target.value) || 1)
                      }))}
                      className="input text-center w-20 py-1 text-sm"
                    />
                  </div>

                  {/* Botones entrada/salida */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => adjustStock(p, 1)}
                      disabled={isAdjusting}
                      className="btn-primary btn btn-sm flex-1"
                    >
                      {isAdjusting
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <><Plus className="w-3 h-3" /> Entrada</>
                      }
                    </button>
                    <button
                      onClick={() => adjustStock(p, -1)}
                      disabled={isAdjusting || p.stock === 0}
                      className="btn-danger btn btn-sm flex-1"
                    >
                      {isAdjusting
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <><Minus className="w-3 h-3" /> Salida</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}