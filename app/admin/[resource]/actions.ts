'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/utils/supabase/admin'
import { Column, editable, getResource } from '../resources'

export type Result = { error?: string; success?: string }

export async function mutateResource(resource: string, operation: string, _previous: Result, form: FormData): Promise<Result> {
    const { supabase } = await requireAdmin()
    const config = getResource(resource)
    if (!config || config.mode === 'read' || !['create', 'update', 'delete'].includes(operation) || (config.mode === 'update' && operation !== 'update')) {
        return { error: 'This operation is not allowed.' }
    }
    const { data: metadata, error: metadataError } = await supabase.rpc('admin_resource_columns', { resource_table: config.table })
    if (metadataError) return { error: 'Unable to read table fields. Apply the assignment migration first.' }
    const columns = metadata as Column[]
    const keys = columns.filter(c => c.primary_key)
    if (!keys.length) return { error: 'This table needs a primary key before records can be changed.' }
    try {
        const values: Record<string, unknown> = {}
        if (operation !== 'delete') for (const column of columns.filter(column => editable(column, operation === 'create'))) {
            const raw = String(form.get(column.name) ?? '')
            if (!raw.trim()) {
                if (operation === 'create' && column.has_default) continue
                if (column.required) throw new Error(`${column.name} is required.`)
                values[column.name] = null
            } else if (['json', 'jsonb'].includes(column.type) || column.type.startsWith('_')) {
                values[column.name] = JSON.parse(raw)
                if (column.type.startsWith('_') && !Array.isArray(values[column.name])) throw new Error(`${column.name} must be a JSON array.`)
            } else if (column.type === 'bool') {
                if (!['true', 'false'].includes(raw)) throw new Error(`${column.name} must be true or false.`)
                values[column.name] = raw === 'true'
            } else {
                if (column.name === 'domain' && !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(raw.trim())) throw new Error('Enter a domain such as example.com.')
                if (['email', 'email_address'].includes(column.name) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) throw new Error('Enter a valid e-mail address.')
                values[column.name] = ['domain', 'email', 'email_address'].includes(column.name) ? raw.trim().toLowerCase() : raw
            }
        }
        let query = operation === 'create' ? supabase.from(config.table).insert(values)
            : operation === 'update' ? supabase.from(config.table).update(values) : supabase.from(config.table).delete()
        if (operation !== 'create') for (const key of keys) {
            const value = form.get(`key:${key.name}`)
            if (typeof value !== 'string' || !value) throw new Error('Missing record identifier.')
            query = query.eq(key.name, value)
        }
        const { data, error } = await query.select()
        if (error) return { error: error.message }
        if (!data?.length) return { error: 'No record changed. It may have been removed or access was denied.' }
        revalidatePath(`/admin/${resource}`)
        return { success: operation === 'delete' ? 'Record deleted.' : 'Record saved.' }
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Unable to save record.' }
    }
}
