import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

async function Gate({ children }: { children: React.ReactNode }) {
    await connection()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_superadmin) {
        return (
            <main className="flex min-h-screen items-center justify-center">
                <p className="text-xl">Not authorized.</p>
            </main>
        )
    }
    return <>{children}</>
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<p className="p-8">Checking access…</p>}>
            <Gate>{children}</Gate>
        </Suspense>
    )
}
