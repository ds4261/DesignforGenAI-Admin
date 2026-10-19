import { requireAdmin } from '@/utils/supabase/admin'

export default async function UsersPage() {
    const { supabase } = await requireAdmin()
    const { data, error } = await supabase.from('profiles').select('id,first_name,last_name,is_superadmin').order('id').limit(500)
    if (error) throw new Error('Unable to load profiles. Check admin database policies.')
    return <main className="admin-page space-y-6">
        <h1 className="page-heading">Users</h1>
        <p>Showing up to 500 profiles.</p>
        {data.length === 0 && <p>No profiles found.</p>}
        {data.map((profile) => <article key={profile.id} className="dashboard-card">
            <h2 className="font-semibold">{[profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unnamed user'}</h2>
            <p className="break-all text-sm">{profile.id}</p>
            <p>{profile.is_superadmin ? 'Superadmin' : 'User'}</p>
        </article>)}
    </main>
}
