import { requireAdmin } from '@/utils/supabase/admin'

export default async function VotesPage() {
    const { supabase } = await requireAdmin()
    const { data, error } = await supabase.from('nyc_caption_votes').select('media_id,caption_index,user_id,direction,created_at').order('created_at', { ascending: false }).limit(500)
    if (error) throw new Error('Unable to load votes. Check admin database policies.')
    return <main className="admin-page space-y-6">
        <h1 className="page-heading">Votes</h1>
        <p>Showing up to 500 latest votes.</p>
        {data.length === 0 && <p>No votes found.</p>}
        {data.map((vote) => <article key={`${vote.media_id}-${vote.caption_index}-${vote.user_id}`} className="dashboard-card">
            <h2 className="font-semibold">{vote.direction > 0 ? 'Upvote' : 'Downvote'} · Caption {vote.caption_index + 1}</h2>
            <p className="break-all text-sm">Media: {vote.media_id}</p>
            <p className="break-all text-sm">User: {vote.user_id}</p>
            <p className="text-sm">{new Date(vote.created_at).toISOString()}</p>
        </article>)}
    </main>
}
