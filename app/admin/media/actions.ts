'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/utils/supabase/admin'

const fields = (f: FormData) => {
    const captions = [0, 1, 2].map((i) => String(f.get(`caption_${i}`) ?? '').trim())
    const photo_path = String(f.get('photo_path') ?? '').trim()
    const model = String(f.get('model') ?? '').trim()
    if (!photo_path || captions.some((caption) => !caption) || !model) {
        throw new Error('Photo path, three captions, and model are required')
    }
    return {
        photo_path, captions, model,
        system_prompt: String(f.get('system_prompt') ?? ''),
        user_prompt: String(f.get('user_prompt') ?? ''),
    }
}

export async function createCaption(formData: FormData) {
    const { supabase, user } = await requireAdmin()
    const { error } = await supabase.from('nyc_caption_media').insert({ user_id: user.id, ...fields(formData) })
    if (error) throw new Error(error.message)
    revalidatePath('/admin/media')
    revalidatePath('/admin')
}

export async function updateCaption(formData: FormData) {
    const { supabase } = await requireAdmin()
    const id = String(formData.get('id'))
    const { error } = await supabase.from('nyc_caption_media').update(fields(formData)).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/media')
    revalidatePath('/admin')
    redirect('/admin/media')
}

export async function deleteCaption(formData: FormData) {
    const { supabase } = await requireAdmin()
    const id = String(formData.get('id'))
    const { error } = await supabase.from('nyc_caption_media').delete().eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/media')
    revalidatePath('/admin')
}
