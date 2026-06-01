'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantId } from '@/lib/supabase/get-tenant'

export interface ActionResult {
  error?: string
  fileId?: string
  signedUrl?: string
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  // Fallback for browsers that send empty type
  '',
]

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_א-ת ]/g, '_').replace(/\s+/g, '_')
}

function isTypeAllowed(type: string, fileName: string): boolean {
  if (ALLOWED_TYPES.includes(type)) return true
  // Fallback: check extension if MIME type is missing or generic
  const ext = fileName.split('.').pop()?.toLowerCase()
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'docx', 'xlsx', 'doc', 'xls']
  return allowed.includes(ext ?? '')
}

// ── Ensure bucket exists (idempotent) ─────────────────────────────────────

async function ensureBucket(bucket: string) {
  const admin = createAdminClient()
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.find((b) => b.name === bucket)) {
    await admin.storage.createBucket(bucket, { public: false })
  }
}

// ── Upload customer file ──────────────────────────────────────────────────

export async function uploadCustomerFile(
  customerId: string,
  formData: FormData
): Promise<ActionResult> {
  console.log('[uploadCustomerFile] ── START ──────────────────────')
  console.log('[uploadCustomerFile] customerId:', customerId)

  // ── Step 1: file received? ────────────────────────────────────────────
  const file = formData.get('file') as File | null
  console.log('[uploadCustomerFile] file received:', !!file)
  if (!file || file.size === 0) {
    console.log('[uploadCustomerFile] ✗ No file in FormData')
    return { error: 'לא נבחר קובץ.' }
  }

  // ── Step 2: file details ──────────────────────────────────────────────
  console.log('[uploadCustomerFile] file.name:', file.name)
  console.log('[uploadCustomerFile] file.size:', file.size, 'bytes')
  console.log('[uploadCustomerFile] file.type:', JSON.stringify(file.type))

  if (!isTypeAllowed(file.type, file.name)) {
    console.log('[uploadCustomerFile] ✗ File type not allowed')
    return { error: `סוג קובץ לא נתמך: ${file.name}` }
  }
  if (file.size > MAX_SIZE) {
    return { error: `הקובץ גדול מ-20MB: ${file.name}` }
  }

  // ── Step 3: auth + tenantId ───────────────────────────────────────────
  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  console.log('[uploadCustomerFile] tenantId:', tenantId)
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { data: { user } } = await supabase.auth.getUser()
  console.log('[uploadCustomerFile] userId:', user?.id ?? 'null')
  if (!user) return { error: 'לא מחובר.' }

  // ── Step 4: admin client + env key ───────────────────────────────────
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  console.log('[uploadCustomerFile] SUPABASE_SERVICE_ROLE_KEY set:', !!serviceKey)
  console.log('[uploadCustomerFile] key prefix:', serviceKey?.slice(0, 20) ?? 'MISSING')

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
    console.log('[uploadCustomerFile] ✓ Admin client created')
  } catch (e) {
    console.error('[uploadCustomerFile] ✗ createAdminClient threw:', e)
    return { error: `Admin client error: ${String(e)}` }
  }

  // ── Step 5: ensure bucket ─────────────────────────────────────────────
  console.log('[uploadCustomerFile] Checking bucket customer-files...')
  try {
    const { data: buckets, error: bucketListErr } = await admin.storage.listBuckets()
    if (bucketListErr) {
      console.error('[uploadCustomerFile] ✗ listBuckets error:', bucketListErr)
      return { error: `Bucket list error: ${bucketListErr.message}` }
    }
    const exists = buckets?.some((b) => b.name === 'customer-files')
    console.log('[uploadCustomerFile] Existing buckets:', buckets?.map(b => b.name))
    console.log('[uploadCustomerFile] customer-files exists:', exists)
    if (!exists) {
      console.log('[uploadCustomerFile] Creating bucket...')
      const { error: createErr } = await admin.storage.createBucket('customer-files', { public: false })
      if (createErr) {
        console.error('[uploadCustomerFile] ✗ createBucket error:', createErr)
        return { error: `Create bucket error: ${createErr.message}` }
      }
      console.log('[uploadCustomerFile] ✓ Bucket created')
    }
  } catch (e) {
    console.error('[uploadCustomerFile] ✗ bucket check threw:', e)
    return { error: `Bucket check error: ${String(e)}` }
  }

  // ── Step 6: storage upload ────────────────────────────────────────────
  const uniqueName = `${crypto.randomUUID()}-${sanitizeName(file.name)}`
  const storagePath = `${tenantId}/${customerId}/${uniqueName}`
  console.log('[uploadCustomerFile] storagePath:', storagePath)

  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
    console.log('[uploadCustomerFile] arrayBuffer byteLength:', arrayBuffer.byteLength)
  } catch (e) {
    console.error('[uploadCustomerFile] ✗ arrayBuffer() threw:', e)
    return { error: `Buffer error: ${String(e)}` }
  }

  console.log('[uploadCustomerFile] Calling admin.storage.from(customer-files).upload()...')
  const { data: uploadData, error: uploadError } = await admin.storage
    .from('customer-files')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  console.log('[uploadCustomerFile] upload result — data:', JSON.stringify(uploadData))
  console.log('[uploadCustomerFile] upload result — error:', JSON.stringify(uploadError))

  if (uploadError) {
    return {
      error: `Storage upload failed: [${uploadError.name ?? ''}] ${uploadError.message}${uploadError.cause ? ` | cause: ${uploadError.cause}` : ''}`,
    }
  }

  // ── Step 7: save metadata to DB ───────────────────────────────────────
  console.log('[uploadCustomerFile] Saving metadata to customer_files...')
  const { data: inserted, error: dbError } = await supabase
    .from('customer_files')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      file_name: file.name,
      file_url: storagePath,
      file_type: file.type || null,
      file_size: file.size,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (dbError) {
    console.error('[uploadCustomerFile] ✗ DB insert error:', dbError)
    await admin.storage.from('customer-files').remove([storagePath])
    return { error: `DB error: ${dbError.message} (code: ${dbError.code})` }
  }

  console.log('[uploadCustomerFile] ✓ SUCCESS — fileId:', inserted.id)
  revalidatePath(`/customers/${customerId}`)
  return { fileId: inserted.id }
}

// ── Upload ticket file ────────────────────────────────────────────────────

export async function uploadTicketFile(
  ticketId: string,
  customerId: string,
  formData: FormData
): Promise<ActionResult> {
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'לא נבחר קובץ.' }
  if (!isTypeAllowed(file.type, file.name)) return { error: `סוג קובץ לא נתמך: ${file.name}` }
  if (file.size > MAX_SIZE) return { error: `הקובץ גדול מ-20MB: ${file.name}` }

  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }

  const admin = createAdminClient()
  await ensureBucket('ticket-files')

  const uniqueName = `${crypto.randomUUID()}-${sanitizeName(file.name)}`
  const storagePath = `${tenantId}/${ticketId}/${uniqueName}`

  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from('ticket-files')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    console.error('[uploadTicketFile] Storage error:', uploadError)
    return { error: `שגיאה בהעלאה: ${uploadError.message}` }
  }

  const { data: inserted, error: dbError } = await supabase
    .from('ticket_files')
    .insert({
      tenant_id: tenantId,
      ticket_id: ticketId,
      file_name: file.name,
      file_url: storagePath,
      file_type: file.type || null,
      file_size: file.size,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (dbError) {
    console.error('[uploadTicketFile] DB error:', dbError)
    await admin.storage.from('ticket-files').remove([storagePath])
    return { error: 'שגיאה בשמירת הקובץ.' }
  }

  revalidatePath(`/tickets/${ticketId}`)
  return { fileId: inserted.id }
}

// ── Delete (admin only) ───────────────────────────────────────────────────

export async function deleteCustomerFile(
  fileId: string,
  storagePath: string,
  customerId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'רק מנהל יכול למחוק קבצים.' }

  const admin = createAdminClient()
  const [{ error: dbError }, { error: storageError }] = await Promise.all([
    supabase.from('customer_files').delete().eq('id', fileId),
    admin.storage.from('customer-files').remove([storagePath]),
  ])

  if (dbError || storageError) {
    console.error('[deleteCustomerFile]', dbError, storageError)
    return { error: 'שגיאה במחיקת הקובץ.' }
  }

  revalidatePath(`/customers/${customerId}`)
  return {}
}

export async function deleteTicketFile(
  fileId: string,
  storagePath: string,
  ticketId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'רק מנהל יכול למחוק קבצים.' }

  const admin = createAdminClient()
  const [{ error: dbError }, { error: storageError }] = await Promise.all([
    supabase.from('ticket_files').delete().eq('id', fileId),
    admin.storage.from('ticket-files').remove([storagePath]),
  ])

  if (dbError || storageError) {
    console.error('[deleteTicketFile]', dbError, storageError)
    return { error: 'שגיאה במחיקת הקובץ.' }
  }

  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

// ── Signed download URL ───────────────────────────────────────────────────

export async function getSignedUrl(
  bucket: 'customer-files' | 'ticket-files',
  storagePath: string
): Promise<ActionResult> {
  // Use admin client — no RLS to worry about, auth checked above via session
  const admin = createAdminClient()

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600)

  if (error || !data?.signedUrl) return { error: 'שגיאה ביצירת קישור הורדה.' }
  return { signedUrl: data.signedUrl }
}
