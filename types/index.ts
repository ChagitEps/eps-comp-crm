import { ArrowRightLeft, RefreshCw, PackagePlus, PackageCheck, type LucideIcon } from 'lucide-react'

export type UserRole = 'admin' | 'technician_senior' | 'technician_junior' | 'accountant'

export type CustomerType =
  | 'private'
  | 'institution'
  | 'small_business'
  | 'large_business'
  | 'project'
  | 'prospect'

export type CustomerStatus =
  | 'active_contract'
  | 'active_no_contract'
  | 'occasional'
  | 'warranty'
  | 'vip'

export type TicketStatus =
  | 'new'
  | 'read'
  | 'in_progress'
  | 'waiting_customer'
  | 'waiting_equipment'
  | 'waiting_supplier'
  | 'completed'
  | 'cancelled'

export type TicketUrgency = 'low' | 'medium' | 'high' | 'critical'

export type TicketDepartment =
  | 'quote'
  | 'order'
  | 'lab'
  | 'delivery'
  | 'technician'
  | 'billing'

export type OrderStatus =
  | 'pending'
  | 'ordered'
  | 'arrived_at_lab'
  | 'installed'
  | 'cancelled'

export type TicketActivityActionType =
  | 'department_change'
  | 'status_change'
  | 'order_created'
  | 'order_status_update'

export type TicketChannel =
  | 'website'
  | 'whatsapp'
  | 'sms'
  | 'email'
  | 'phone'
  | 'manual'

export type BillingStatus =
  | 'not_billed'
  | 'pending_invoice'
  | 'invoice_sent'
  | 'paid'
  | 'open_debt'

// Billing status on visits (from migration 006)
export type VisitBillingStatus = 'pending' | 'invoiced' | 'paid'

export type VisitType =
  | 'computing'
  | 'infrastructure'
  | 'servers'
  | 'lab'
  | 'remote'
  | 'emergency'

export type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export type EquipmentCategory =
  | 'servers'
  | 'networking'
  | 'computing'
  | 'accessories'
  | 'cameras'
  | 'keypads'
  | 'intercom'
  | 'telephony'
  | 'other'

export type EquipmentStatus =
  | 'in_stock'
  | 'at_customer'
  | 'repair_technician'
  | 'repair_lab'
  | 'repair_supplier'
  | 'installed'
  | 'replaced'
  | 'defective'
  | 'scrapped'

export type PaymentMethod = 'cash' | 'credit' | 'transfer' | 'check' | 'bit'

export type BillingModel = 'contract' | 'pay_per_visit'

export type VisitEquipmentAction = 'installed' | 'taken' | 'returned' | 'checked'

// ── Warehouse ─────────────────────────────────────────────────────────────
export type WarehouseCategory =
  | 'parts' | 'cables' | 'cameras' | 'networking'
  | 'hardware' | 'accessories' | 'other'

export type MovementType = 'IN' | 'OUT' | 'RETURN' | 'ADJUSTMENT'
export type StockStatus = 'ok' | 'low_stock' | 'out_of_stock'

export interface Supplier {
  id: string
  tenant_id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  payment_terms: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WarehouseItem {
  id: string
  tenant_id: string
  sku: string | null
  name: string
  category: WarehouseCategory | null
  quantity: number
  min_quantity: number
  cost_price: number | null
  sell_price: number | null
  location_in_warehouse: string | null
  supplier_id: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // computed from view
  stock_status?: StockStatus
  needs_reorder?: boolean
  supplier_name?: string | null
}

export interface InventoryMovement {
  id: string
  tenant_id: string
  warehouse_item_id: string
  quantity: number
  movement_type: MovementType
  quantity_before: number
  quantity_after: number
  user_id: string | null
  ticket_id: string | null
  visit_id: string | null
  notes: string | null
  created_at: string
}

// Database row types
export interface Tenant {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  tenant_id: string
  full_name: string
  role: UserRole
  phone: string | null
  hourly_rate: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  tenant_id: string
  name: string | null
  business_name: string
  customer_type: CustomerType | null
  customer_status: CustomerStatus | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  floor: string | null
  arrival_notes: string | null
  business_hours: string | null
  billing_model: BillingModel | null
  billing_terms: string | null
  internal_notes: string | null
  vat_id: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  tenant_id: string
  customer_id: string
  name: string
  role: string | null
  phones: string[]
  email: string | null
  preferred_hours: string | null
  notes: string | null
  created_at: string
}

export interface Ticket {
  id: string
  tenant_id: string
  ticket_number: number
  customer_id: string
  assigned_technician_id: string | null
  opened_by: string | null
  title: string
  description: string | null
  status: TicketStatus
  urgency: TicketUrgency
  service_type: string | null
  open_channel: TicketChannel
  billing_status: BillingStatus
  sla_due_at: string | null
  internal_notes: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  // relations
  customer?: Customer
  assigned_technician?: Profile
}

export interface TicketOrder {
  id: string
  tenant_id: string
  ticket_id: string
  attendance_id: string | null
  item_name: string
  supplier: string | null
  model: string | null
  quantity: number
  estimated_price: number | null
  notes: string | null
  order_status: OrderStatus
  created_at: string
  updated_at: string
}

export interface TicketActivity {
  id: string
  tenant_id: string
  ticket_id: string
  user_id: string | null
  action_type: TicketActivityActionType
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
  // relations
  user?: { full_name: string }
}

export interface Visit {
  id: string
  tenant_id: string
  ticket_id: string
  technician_id: string
  visit_type: VisitType
  status: VisitStatus
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  total_billing_minutes: number | null
  work_description: string | null
  work_cost: number
  equipment_cost: number
  fixed_cost: number
  total_cost: number
  billing_status: VisitBillingStatus
  hourly_rate_snapshot: number | null
  customer_signature_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // relations
  ticket?: Ticket
  technician?: Profile
}

export interface VisitAttendance {
  id: string
  tenant_id: string
  visit_id: string
  work_done: string | null
  internal_notes: string | null
  started_at: string | null
  ended_at: string | null
  duration_minutes: number | null
  current_department: TicketDepartment
  visit_type: VisitType | null
  follow_up_needed: boolean
  follow_up_scheduled_at: string | null
  quote_approved: boolean
  quote_amount: number | null
  created_at: string
  updated_at: string
}

export interface TechnicianServiceRate {
  id: string
  tenant_id: string
  technician_id: string
  visit_type: VisitType
  hourly_rate: number
}

export interface Equipment {
  id: string
  tenant_id: string
  customer_id: string
  assigned_technician_id: string | null
  item_number: string | null
  equipment_type: string
  category: EquipmentCategory | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  installation_date: string | null
  warranty_start: string | null
  warranty_end: string | null
  quantity: number
  status: EquipmentStatus
  location_notes: string | null
  notes: string | null
  ip_address: string | null
  mac_address: string | null
  gateway: string | null
  dns: string | null
  router_access_url: string | null
  anydesk_id: string | null
  teamviewer_id: string | null
  rustdesk_id: string | null
  remote_notes: string | null
  isp_name: string | null
  infrastructure_type: string | null
  speed: string | null
  static_ip: string | null
  isp_login: string | null
  isp_support_phone: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  // relations
  customer?: Customer
}

export interface Payment {
  id: string
  tenant_id: string
  ticket_id: string
  customer_id: string
  work_price: number
  equipment_price: number
  total_amount: number
  is_paid: boolean
  payment_method: PaymentMethod | null
  payment_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TicketEquipment {
  id: string
  tenant_id: string
  ticket_id: string
  equipment_id: string
  notes: string | null
  created_at: string
}

export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface Task {
  id: string
  tenant_id: string
  ticket_id: string | null
  customer_id: string | null
  assigned_to: string | null
  created_by: string | null
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  due_date: string | null
  created_at: string
  updated_at: string
  // relations
  ticket?: Ticket
  customer?: Customer
  assignee?: Profile
}

export interface TicketFile {
  id: string
  tenant_id: string
  ticket_id: string
  file_name: string
  file_url: string        // storage path, not signed URL
  file_type: string | null
  file_size: number | null
  uploaded_by: string | null
  uploader_name?: string | null
  created_at: string
}

export interface CustomerFile {
  id: string
  tenant_id: string
  customer_id: string
  file_name: string
  file_url: string        // storage path
  file_type: string | null
  file_size: number | null
  uploaded_by: string | null
  uploader_name?: string | null
  created_at: string
}

export interface VisitFile {
  id: string
  tenant_id: string
  visit_id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  uploaded_by: string | null
  created_at: string
}

export interface VisitEquipment {
  id: string
  tenant_id: string
  visit_id: string
  equipment_id: string
  action: VisitEquipmentAction | null
  notes: string | null
  created_at: string
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin:               'מנהל מערכת',
  technician_senior:   'טכנאי ראשי',
  technician_junior:   'טכנאי',
  accountant:          'מנהל/ת חשבונות',
}

export const USER_ROLE_COLORS: Record<UserRole, string> = {
  admin:             'bg-purple-100 text-purple-800',
  technician_senior: 'bg-blue-100 text-blue-800',
  technician_junior: 'bg-gray-100 text-gray-700',
  accountant:        'bg-emerald-100 text-emerald-800',
}

export const BILLING_MODEL_LABELS: Record<BillingModel, string> = {
  contract: 'לקוח חוזה',
  pay_per_visit: 'תשלום לפי ביקור',
}

export const BILLING_MODEL_COLORS: Record<BillingModel, string> = {
  contract: 'bg-emerald-100 text-emerald-800',
  pay_per_visit: 'bg-slate-100 text-slate-700',
}

// Label maps for Hebrew UI
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'חדש',
  read: 'נקרא',
  in_progress: 'בטיפול',
  waiting_customer: 'ממתין ללקוח',
  waiting_equipment: 'ממתין לציוד',
  waiting_supplier: 'ממתין לספק',
  completed: 'הושלם',
  cancelled: 'בוטל',
}

export const TICKET_URGENCY_LABELS: Record<TicketUrgency, string> = {
  low: 'נמוכה',
  medium: 'בינונית',
  high: 'גבוהה',
  critical: 'קריטי',
}

export const TICKET_URGENCY_COLORS: Record<TicketUrgency, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  new: 'bg-yellow-100 text-yellow-800',
  read: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  waiting_customer: 'bg-orange-100 text-orange-800',
  waiting_equipment: 'bg-amber-100 text-amber-800',
  waiting_supplier: 'bg-pink-100 text-pink-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

export const CURRENT_DEPARTMENT_LABELS: Record<TicketDepartment, string> = {
  quote: 'הצעת מחיר',
  order: 'הזמנה',
  lab: 'מעבדה',
  delivery: 'משלוח',
  technician: 'טכנאי',
  billing: 'חשבונות',
}

export const CURRENT_DEPARTMENT_COLORS: Record<TicketDepartment, string> = {
  quote: 'bg-indigo-100 text-indigo-800',
  order: 'bg-blue-100 text-blue-800',
  lab: 'bg-purple-100 text-purple-800',
  delivery: 'bg-amber-100 text-amber-800',
  technician: 'bg-green-100 text-green-800',
  billing: 'bg-teal-100 text-teal-800',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'ממתין',
  ordered: 'הוזמן',
  arrived_at_lab: 'הגיע למעבדה',
  installed: 'הותקן',
  cancelled: 'בוטל',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  ordered: 'bg-blue-100 text-blue-800',
  arrived_at_lab: 'bg-purple-100 text-purple-800',
  installed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-700',
}

export const TICKET_ACTIVITY_ICONS: Record<TicketActivityActionType, LucideIcon> = {
  department_change: ArrowRightLeft,
  status_change: RefreshCw,
  order_created: PackagePlus,
  order_status_update: PackageCheck,
}

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  computing: 'ביקור פיזי',
  infrastructure: 'תשתיות',
  servers: 'שרתים',
  lab: 'מעבדה',
  remote: 'מרחוק',
  emergency: 'חירום',
}

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: 'מתוכנן',
  in_progress: 'פעיל',
  completed: 'הושלם',
  cancelled: 'בוטל',
}

export const VISIT_STATUS_COLORS: Record<VisitStatus, string> = {
  scheduled: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-700',
}

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  in_stock: 'במלאי',
  at_customer: 'אצל לקוח',
  repair_technician: 'בתיקון אצל טכנאי',
  repair_lab: 'בתיקון במעבדה',
  repair_supplier: 'בתיקון אצל ספק',
  installed: 'הותקן',
  replaced: 'הוחלף',
  defective: 'תקול',
  scrapped: 'גרוטאה',
}

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  private: 'פרטי',
  institution: 'מוסד',
  small_business: 'עסק קטן',
  large_business: 'עסק גדול',
  project: 'פרויקט',
  prospect: 'מתעניין',
}

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active_contract: 'קבוע עם חוזה',
  active_no_contract: 'קבוע ללא חוזה',
  occasional: 'מזדמן',
  warranty: 'אחריות על מוצר',
  vip: 'VIP',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'ממתין',
  in_progress: 'בטיפול',
  completed: 'הושלם',
  cancelled: 'בוטל',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'נמוכה',
  medium: 'בינונית',
  high: 'גבוהה',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'מזומן',
  credit: 'אשראי',
  transfer: 'העברה',
  check: "צ'ק",
  bit: 'ביט',
}

export const WAREHOUSE_CATEGORY_LABELS: Record<WarehouseCategory, string> = {
  parts: 'חלקים',
  cables: 'כבלים',
  cameras: 'מצלמות',
  networking: 'רשת',
  hardware: 'חומרה',
  accessories: 'נלווה',
  other: 'אחר',
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  IN: 'קליטה',
  OUT: 'הוצאה',
  RETURN: 'החזרה',
  ADJUSTMENT: 'תיקון מלאי',
}

export const VISIT_BILLING_STATUS_LABELS: Record<VisitBillingStatus, string> = {
  pending: 'ממתין לחיוב',
  invoiced: 'חשבונית נשלחה',
  paid: 'שולם',
}

export const VISIT_BILLING_STATUS_COLORS: Record<VisitBillingStatus, string> = {
  pending: 'bg-orange-100 text-orange-700',
  invoiced: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
}

export const MOVEMENT_TYPE_COLORS: Record<MovementType, string> = {
  IN: 'bg-green-100 text-green-700',
  OUT: 'bg-red-100 text-red-700',
  RETURN: 'bg-blue-100 text-blue-700',
  ADJUSTMENT: 'bg-orange-100 text-orange-700',
}

export const STOCK_STATUS_COLORS: Record<StockStatus, string> = {
  ok: 'text-green-600',
  low_stock: 'text-orange-600',
  out_of_stock: 'text-red-600',
}

// ── Notifications ─────────────────────────────────────────────────────────

export type NotificationType =
  | 'new_ticket'
  | 'ticket_emergency'
  | 'ticket_assigned'
  | 'ticket_updated'
  | 'visit_started'
  | 'visit_completed'
  | 'sla_breach'
  | 'invoice_created'
  | 'low_stock'

export interface Notification {
  id:         string
  tenant_id:  string
  user_id:    string | null
  ticket_id:  string | null
  visit_id:   string | null
  type:       NotificationType
  title:      string
  body:       string | null
  metadata:   Record<string, unknown> | null
  is_read:    boolean
  read_at:    string | null
  created_at: string
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  new_ticket:       'קריאה חדשה',
  ticket_emergency: '🚨 קריאה דחופה',
  ticket_assigned:  'קריאה שויכה אליך',
  ticket_updated:   'עדכון קריאה',
  visit_started:    'ביקור התחיל',
  visit_completed:  'ביקור הסתיים',
  sla_breach:       '⏰ SLA עבר',
  invoice_created:  'חשבונית הופקה',
  low_stock:        'מלאי נמוך',
}

export const NOTIFICATION_TYPE_COLORS: Record<NotificationType, string> = {
  new_ticket:       'bg-blue-100 text-blue-800',
  ticket_emergency: 'bg-red-100 text-red-800',
  ticket_assigned:  'bg-purple-100 text-purple-800',
  ticket_updated:   'bg-gray-100 text-gray-700',
  visit_started:    'bg-emerald-100 text-emerald-800',
  visit_completed:  'bg-green-100 text-green-800',
  sla_breach:       'bg-orange-100 text-orange-800',
  invoice_created:  'bg-teal-100 text-teal-800',
  low_stock:        'bg-yellow-100 text-yellow-800',
}
