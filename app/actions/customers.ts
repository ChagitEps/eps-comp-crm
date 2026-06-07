'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/supabase/get-tenant'
import type { CustomerType, CustomerStatus, BillingModel } from '@/types'

export interface CustomerFormData {
  name: string
  business_name: string
  customer_type: CustomerType | ''
  customer_status: CustomerStatus | ''
  billing_model: BillingModel | ''
  phone: string
  email: string
  address: string
  city: string
  floor: string
  arrival_notes: string
  business_hours: string
  billing_terms: string
  internal_notes: string
}

function validateCustomer(data: CustomerFormData): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!data.name || data.name.trim().length < 2) {
    errors.name = 'שם חייב להכיל לפחות 2 תווים'
  }

  if (data.phone && !/^0[2-9]\d{7,8}$/.test(data.phone.replace(/[-\s]/g, ''))) {
    errors.phone = 'מספר טלפון לא תקין'
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'כתובת אימייל לא תקינה'
  }

  return errors
}

export interface ActionResult {
  errors?: Record<string, string>
  error?: string
}

export async function createCustomer(data: CustomerFormData): Promise<ActionResult> {
  const errors = validateCustomer(data)
  if (Object.keys(errors).length > 0) return { errors }

  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש. אנא התחבר מחדש.' }

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      tenant_id: tenantId,
      name: data.name.trim(),
      business_name: data.business_name.trim() || null,
      customer_type: data.customer_type || null,
      customer_status: data.customer_status || null,
      billing_model: data.billing_model || 'pay_per_visit',
      phone: data.phone.trim() || null,
      email: data.email.trim() || null,
      address: data.address.trim() || null,
      city: data.city.trim() || null,
      floor: data.floor.trim() || null,
      arrival_notes: data.arrival_notes.trim() || null,
      business_hours: data.business_hours.trim() || null,
      billing_terms: data.billing_terms.trim() || null,
      internal_notes: data.internal_notes.trim() || null,
    })
    .select('id')
    .single()

  if (error) return { error: 'שגיאה ביצירת הלקוח. אנא נסה שוב.' }

  redirect(`/customers/${customer.id}`)
}

export interface QuickCustomerResult {
  customerId?: string
  name?: string
  business_name?: string | null
  error?: string
  errors?: Record<string, string>
}

export async function createCustomerQuick(data: {
  name: string
  business_name: string
  phone: string
  email: string
  address: string
  city: string
  floor: string
  internal_notes: string
}): Promise<QuickCustomerResult> {
  const errors: Record<string, string> = {}
  if (!data.name || data.name.trim().length < 2) errors.name = 'שם חייב להכיל לפחות 2 תווים'
  if (data.phone && !/^0[2-9]\d{7,8}$/.test(data.phone.replace(/[-\s]/g, ''))) errors.phone = 'מספר טלפון לא תקין'
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'כתובת אימייל לא תקינה'
  if (Object.keys(errors).length > 0) return { errors }

  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      tenant_id:       tenantId,
      name:            data.name.trim(),
      business_name:   data.business_name.trim() || null,
      phone:           data.phone.trim() || null,
      email:           data.email.trim() || null,
      address:         data.address.trim() || null,
      city:            data.city.trim() || null,
      floor:           data.floor.trim() || null,
      internal_notes:  data.internal_notes.trim() || null,
      billing_model:   'pay_per_visit',
      customer_status: 'occasional',
    })
    .select('id, name, business_name')
    .single()

  if (error || !customer) return { error: 'שגיאה ביצירת הלקוח.' }

  revalidatePath('/customers')
  return {
    customerId:    customer.id as string,
    name:          customer.name as string,
    business_name: customer.business_name as string | null,
  }
}

export async function updateCustomer(id: string, data: CustomerFormData): Promise<ActionResult> {
  const errors = validateCustomer(data)
  if (Object.keys(errors).length > 0) return { errors }

  const supabase = await createClient()

  const { error } = await supabase
    .from('customers')
    .update({
      name: data.name.trim(),
      business_name: data.business_name.trim() || null,
      customer_type: data.customer_type || null,
      customer_status: data.customer_status || null,
      billing_model: data.billing_model || 'pay_per_visit',
      phone: data.phone.trim() || null,
      email: data.email.trim() || null,
      address: data.address.trim() || null,
      city: data.city.trim() || null,
      floor: data.floor.trim() || null,
      arrival_notes: data.arrival_notes.trim() || null,
      business_hours: data.business_hours.trim() || null,
      billing_terms: data.billing_terms.trim() || null,
      internal_notes: data.internal_notes.trim() || null,
    })
    .eq('id', id)

  if (error) return { error: 'שגיאה בעדכון הלקוח. אנא נסה שוב.' }

  revalidatePath(`/customers/${id}`)
  redirect(`/customers/${id}`)
}

export async function softDeleteCustomer(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('customers')
    .update({ is_deleted: true })
    .eq('id', id)

  if (error) return { error: 'שגיאה במחיקת הלקוח.' }

  revalidatePath('/customers')
  redirect('/customers')
}
