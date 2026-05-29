// ─── Usuarios ───────────────────────────────────────────────
export type UserRole = 'admin' | 'vendedor'

export interface AppUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
}

// ─── Categorías ──────────────────────────────────────────────
export interface Category {
  id: string
  name: string
  created_at: string
}

// ─── Productos ───────────────────────────────────────────────
export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  category_id: string | null
  image_url: string | null
  active: boolean
  created_at: string
  updated_at: string
  categories?: Category
}

// ─── Clientes ────────────────────────────────────────────────
export interface Client {
  id: string
  name: string
  cedula: string | null
  phone: string | null
  created_at: string
}

// ─── Facturas ────────────────────────────────────────────────
export type InvoiceStatus = 'pendiente' | 'pagado_parcial' | 'pagado' | 'cancelado'
export type PaymentMethod = 'efectivo' | 'nequi' | 'banco' | 'combinado'

export interface Invoice {
  id: string
  invoice_number: number
  client_id: string | null
  status: InvoiceStatus
  subtotal: number
  total: number
  amount_paid: number
  notes: string | null
  created_at: string
  updated_at: string
  clients?: Client
  invoice_items?: InvoiceItem[]
  payments?: Payment[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  products?: Product
}

// ─── Pagos ───────────────────────────────────────────────────
export interface Payment {
  id: string
  invoice_id: string
  amount: number
  method: PaymentMethod
  reference: string | null
  notes: string | null
  paid_at: string
  created_at: string
}

// ─── Movimientos de inventario ───────────────────────────────
export type StockMovementType = 'entrada' | 'salida' | 'ajuste'

export interface StockMovement {
  id: string
  product_id: string
  type: StockMovementType
  quantity: number
  reason: string | null
  invoice_id: string | null
  created_at: string
  products?: Product
}

// ─── Dashboard ───────────────────────────────────────────────
export interface SalesStat {
  date: string
  total: number
  count: number
}

export interface DashboardStats {
  today: number
  thisWeek: number
  thisMonth: number
  pendingAmount: number
  lowStockProducts: Product[]
  recentInvoices: Invoice[]
  salesByDay: SalesStat[]
}