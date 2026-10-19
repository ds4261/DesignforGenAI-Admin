import { MediaFields } from '../fields'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/utils/supabase/admin'
import { updateCaption } from '../actions'

export default async function EditMedia({ params }: { params: Promise<{ id: string }> }) {
    await connection()
    const { id } = await params
    const { supabase } = await requireAdmin()
    const { data: c, error } = await supabase.from('nyc_caption_media').select('*').eq('id', id).single()
    if (error && error.code !== 'PGRST116') throw new Error('Unable to load media. Check database permissions.')
    if (!c) notFound()

    return (
        <main className="admin-page admin-editor space-y-6">
            <h1 className="page-heading">Edit media</h1>
            <form action={updateCaption} className="studio-panel grid gap-4">
                <input type="hidden" name="id" value={c.id} />
                <MediaFields media={c} />
                <button className="button-primary w-fit">Save</button>
            </form>
        </main>
    )
}
