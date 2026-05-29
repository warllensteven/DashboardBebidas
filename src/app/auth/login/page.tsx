'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Package2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Correo o contraseña incorrectos.')
      toast.error('Credenciales inválidas')
      setLoading(false)
      return
    }

    toast.success('¡Bienvenido!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500 shadow-lg mb-4">
            <Package2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">DistribuBebidas</h1>
          <p className="text-slate-400 text-sm mt-1">Sistema de gestión de inventario y ventas</p>
        </div>

        {/* Card */}
        <div className="card shadow-2xl">
          <div className="p-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-6">Iniciar sesión</h2>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="label" htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  className={`input ${error ? 'input-error' : ''}`}
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="label" htmlFor="password">Contraseña</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    className={`input pr-10 ${error ? 'input-error' : ''}`}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full btn-lg mt-2"
                disabled={loading}
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Ingresando...</>
                  : 'Ingresar'
                }
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Contacta al administrador si olvidaste tu contraseña.
        </p>
      </div>
    </div>
  )
}