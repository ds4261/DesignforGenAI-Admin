import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from './server'

// Call at every data entry point: layouts can persist across navigation.
export async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) redirect('/login')
    if (!user.app_metadata.providers?.includes('google')) redirect('/login?error=google')

    const { data: profile, error: profileError } = await supabase
        .from('profiles').select('is_superadmin').eq('id', user.id).single()
    if (profileError || profile?.is_superadmin !== true) redirect('/login?error=forbidden')
    return { supabase, user }
}
