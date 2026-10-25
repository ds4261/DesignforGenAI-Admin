import { MediaFields } from './fields'
import Link from 'next/link'
import { connection } from 'next/server'
import { requireAdmin } from '@/utils/supabase/admin'
import { createCaption, deleteCaption } from './actions'

export default async function MediaPage() {
    await connection()
    const { supabase } = await requireAdmin()
    const { data: captions, error } = await supabase
        .from('nyc_caption_media')
        .select('id,photo_path,captions,user_prompt,model,created_at,published')
        .order('created_at', { ascending: false })
        .limit(200)

    if (error) throw new Error('Unable to load media. Check database tables and admin policies.')

    const previews = await Promise.all((captions ?? []).map(async (caption) => {
        const { data } = await supabase.storage.from('nyc-caption-photos').createSignedUrl(caption.photo_path, 900)
        return [caption.id, data?.signedUrl] as const
    }))
    const previewUrls = new Map(previews)

    return (
        <main className="admin-page space-y-6">
            <h1 className="page-heading">AI media</h1>

            <form action={createCaption} className="studio-panel grid gap-4">
                <h2 className="font-semibold">Add new</h2>
                <MediaFields />
                <button className="button-primary w-fit">Create</button>
            </form>

            <div className="grid gap-4 md:grid-cols-2">
                {(captions ?? []).map((c) => (
                    <div key={c.id} className="dashboard-card">
                        {previewUrls.get(c.id) ? <a href={previewUrls.get(c.id)} target="_blank" rel="noreferrer">
                            {/* Private storage URLs expire after 15 minutes. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={previewUrls.get(c.id)} alt={`Photo for ${c.captions[0] || 'generated captions'}`} className="mb-4 max-h-80 w-full rounded object-contain" />
                        </a> : <p>Photo preview unavailable. Check the storage path and access policy.</p>}
                        <p className="text-xs text-gray-500">{c.published ? 'Published' : 'Draft'} · {c.photo_path}</p>
                        {(c.captions as string[]).map((caption, i) => <p key={i} className="font-medium">{i + 1}. {caption}</p>)}
                        <p className="text-sm text-gray-500">{c.model} · {new Date(c.created_at).toLocaleDateString()}</p>
                        <p className="mt-1 text-sm text-gray-500">Prompt: {c.user_prompt}</p>
                        <div className="mt-3 flex gap-3">
                            <Link href={`/admin/media/${c.id}`} className="button-secondary">Edit</Link>
                            <form action={deleteCaption}>
                                <input type="hidden" name="id" value={c.id} />
                                <button className="button-danger">Delete</button>
                            </form>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    )
}
