'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, FileText, ShoppingCart,
  Package, Archive, LogOut, Package2, Menu, X, Bike, BarChart2, Truck
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const navItems = [
  { href: '/dashboard',             label: 'Dashboard',          icon: LayoutDashboard },
  { href: '/caja',                  label: 'Caja / Ventas',      icon: ShoppingCart },
  { href: '/facturacion',           label: 'Nueva factura',      icon: FileText },
  { href: '/facturacion/historial', label: 'Historial facturas', icon: FileText },
  { href: '/inventario',            label: 'Inventario',         icon: Archive },
  { href: '/productos',             label: 'Productos',          icon: Package },
  { href: '/domiciliarios', label: 'Domiciliarios', icon: Bike },
  { href: '/reportes', label: 'Reportes', icon: BarChart2 },
  { href: '/proveedores', label: 'Proveedores', icon: Truck },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    router.push('/auth/login')
    router.refresh()
  }

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600">
          <Package2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800 leading-none">DistribuBebidas</p>
          <p className="text-xs text-slate-400 mt-0.5">Gestión de ventas</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={clsx('nav-item', active && 'nav-item-active')}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="nav-item w-full text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-slate-200 min-h-screen fixed left-0 top-0 z-30">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600">
            <Package2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-800 text-sm">DistribuBebidas</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col shadow-xl animate-fade-in">
            <NavContent />
          </aside>
        </div>
      )}
    </>
  )
}