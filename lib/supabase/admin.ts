import { createClient } from '@supabase/supabase-js'

// Admin client uses service role key — bypasses RLS
// ONLY use in Server Actions and Server Components, never on the client
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local.')
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
