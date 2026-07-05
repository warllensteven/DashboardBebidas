import Sidebar from '@/components/layout/Sidebar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="lg:ml-60 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-6 max-w-screen-2xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}