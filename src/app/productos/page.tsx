'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, Category } from '@/types'
import { Package, Plus, Search, Pencil, ToggleLeft, ToggleRight, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'

export default function ProductosPage() {
  const supabase = createClient()

  const [products, setProducts]     = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Product | null>(null)

  // Form state
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [price, setPrice]         = useState('')
  const [stock, setStock]         = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*, categories(*)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ])
    setProducts(prods || [])
    setCategories(cats || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setName(''); setDesc(''); setPrice(''); setStock('')
    setCategoryId(''); setImageFile(null); setImagePreview('')
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setName(p.name); setDesc(p.description || ''); setPrice(String(p.price))
    setStock(String(p.stock)); setCategoryId(p.category_id || '')
    setImagePreview(p.image_url || ''); setImageFile(null)
    setShowForm(true)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!name || !price) return toast.error('Nombre y precio son obligatorios')
    setSaving(true)

    let image_url = editing?.image_url || null

    // Subir imagen si hay una nueva
    if (imageFile) {
      const ext  = imageFile.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('products').upload(path, imageFile, { upsert: true })
      if (upErr) { toast.error('Error subiendo imagen'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('products').getPublicUrl(path)
      image_url = urlData.publicUrl
    }

    const payload = {
      name, description, price: parseFloat(price),
      stock: parseInt(stock) || 0, category_id: categoryId || null, image_url,
    }

    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id)
      if (error) { toast.error('Error al actualizar'); setSaving(false); return }
      toast.success('Producto actualizado')
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) { toast.error('Error al crear'); setSaving(false); return }
      toast.success('Producto creado')
    }

    setSaving(false)
    setShowForm(false)
    loadData()
  }

  async function toggleActive(p: Product) {
    const { error } = await supabase.from('products')
      .update({ active: !p.active }).eq('id', p.id)
    if (error) return toast.error('Error al cambiar estado')
    toast.success(p.active ? 'Producto desactivado' : 'Producto activado')
    loadData()
  }

  async function deleteProduct(p: Product) {
  // Verificar si tiene facturas asociadas
  const { count } = await supabase
    .from('invoice_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', p.id)

  if (count && count > 0) {
    toast.error('Este producto tiene facturas asociadas, solo puedes desactivarlo')
    return
  }

  if (!confirm(`¿Eliminar "${p.name}" permanentemente?`)) return

  // Eliminar imagen del storage si existe
  if (p.image_url) {
    const path = p.image_url.split('/products/')[1]
    if (path) await supabase.storage.from('products').remove([path])
  }

  const { error } = await supabase.from('products').delete().eq('id', p.id)
  if (error) return toast.error('Error al eliminar')
  toast.success(`"${p.name}" eliminado`)
  loadData()
}

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat    = catFilter ? p.category_id === catFilter : true
    return matchSearch && matchCat
  })

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Productos</h1>
        </div>
        <button onClick={openNew} className="btn-primary btn">
          <Plus className="w-4 h-4" /> Nuevo producto
        </button>
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

      {/* Grid de productos */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card card-body text-center py-16">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay productos. ¡Crea el primero!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <div key={p.id} className={`card overflow-hidden transition-opacity ${!p.active ? 'opacity-50' : ''}`}>
              {/* Imagen */}
              <div className="h-40 bg-slate-100 relative">
                {p.image_url ? (
                  <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="w-12 h-12 text-slate-300" />
                  </div>
                )}
                {!p.active && (
                  <span className="absolute top-2 right-2 badge-red">Inactivo</span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                <p className="text-xs text-slate-400 mb-2">
                  {(p as any).categories?.name || 'Sin categoría'}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-blue-600">
                    ${p.price.toLocaleString('es-CO')}
                  </span>
                  <span className={`badge ${p.stock <= 5 ? 'badge-red' : p.stock <= 20 ? 'badge-yellow' : 'badge-green'}`}>
                    Stock: {p.stock}
                  </span>
                </div>

                {/* Acciones */}
                {/* Acciones */}
<div className="flex gap-2">
  <button onClick={() => openEdit(p)} className="btn-secondary btn btn-sm flex-1">
    <Pencil className="w-3 h-3" /> Editar
  </button>
  <button onClick={() => toggleActive(p)} className="btn-ghost btn btn-sm">
    {p.active
      ? <ToggleRight className="w-4 h-4 text-green-500" />
      : <ToggleLeft className="w-4 h-4 text-slate-400" />
    }
  </button>
  <button onClick={() => deleteProduct(p)} className="btn-ghost btn btn-sm text-red-400 hover:text-red-600">
    <Trash2 className="w-4 h-4" />
  </button>
</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulario */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">
                {editing ? 'Editar producto' : 'Nuevo producto'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Imagen */}
              <div>
                <label className="label">Imagen</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden relative flex-shrink-0">
                    {imagePreview ? (
                      <Image src={imagePreview} alt="preview" fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Package className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="input" />
                </div>
              </div>

              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Coca-Cola 2L" />
              </div>

              <div>
                <label className="label">Descripción</label>
                <textarea className="input" rows={2} value={description} onChange={e => setDesc(e.target.value)} placeholder="Descripción opcional..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Precio *</label>
                  <input className="input" type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="label">Stock inicial</label>
                  <input className="input" type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" />
                </div>
              </div>

              <div>
                <label className="label">Categoría</label>
                <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary btn">Cancelar</button>
              <button onClick={handleSave} className="btn-primary btn" disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}