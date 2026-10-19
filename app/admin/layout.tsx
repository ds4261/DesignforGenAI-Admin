import { Suspense } from 'react'
import CitySkyline from './city-skyline'
import { AdminNavigation } from './navigation'
import { requireAdmin } from '@/utils/supabase/admin'
import { signOut } from './session-actions'

async function AuthorizedAdmin({ children }: { children: React.ReactNode }) {
    await requireAdmin()
    return (
        <div className="admin-shell">
            <nav aria-label="Admin navigation" className="site-nav">
                <AdminNavigation />
                <form action={signOut} className="nav-account"><button className="nav-signout">Sign out</button></form>
            </nav>
            <div className="admin-gallery">
                <div className="gallery-skyline-background" aria-hidden="true"><CitySkyline className="gallery-city-art" /></div>
                {children}
            </div>
        </div>
    )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return <Suspense fallback={<p className="p-8">Checking admin access…</p>}>
        <AuthorizedAdmin>{children}</AuthorizedAdmin>
    </Suspense>
}
