import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/utils/supabase/admin'
import { Column, getResource } from '../resources'
import { RecordForm } from './record-form'

export default async function ResourcePage({ params, searchParams }: {
    params: Promise<{ resource: string }>; searchParams: Promise<{ page?: string }>
}) {
    const { resource } = await params
    const config = getResource(resource)
    if (!config) notFound()
    const { supabase } = await requireAdmin()
    const input = Number((await searchParams).page ?? 1)
    const page = Number.isSafeInteger(input) && input > 0 ? Math.min(input, 100000) : 1
    const { data: metadata, error: metadataError } = await supabase.rpc('admin_resource_columns', { resource_table: config.table })
    const columns = (metadata ?? []) as Column[]
    const keys = columns.filter(c => c.primary_key)
    let query = supabase.from(config.table).select('*', { count: 'exact' })
    for (const key of keys) query = query.order(key.name)
    const { data, count, error } = metadataError ? { data: null, count: null, error: metadataError } : await query.range((page - 1) * 50, page * 50 - 1)
    return <main className="admin-page space-y-6">
        <h1 className="page-heading">{config.title}</h1>
        <p>{config.mode === 'read' ? 'View records' : config.mode === 'update' ? 'View and update records' : 'Create, view, edit, and delete records'}</p>
        {error ? <p role="alert" className="dashboard-card">Unable to load {config.title.toLowerCase()}. Apply the assignment migration and check table permissions. {error.message}</p> : <>
            {config.mode === 'crud' && <details className="studio-panel"><summary>Create record</summary><RecordForm resource={resource} columns={columns} /></details>}
            <p>{count ?? 0} records · Page {page}</p>
            {!data?.length && <p>No records on this page.</p>}
            {data?.map((row, index) => <article key={keys.map(c => String(row[c.name])).join(':') || index} className="dashboard-card space-y-4">
                <dl className="grid gap-3">{columns.map(c => <div key={c.name}>
                    <dt className="font-semibold">{c.name.replaceAll('_', ' ')}</dt>
                    <dd className="whitespace-pre-wrap break-words text-sm">{row[c.name] == null ? '—' : typeof row[c.name] === 'object' ? JSON.stringify(row[c.name], null, 2) : String(row[c.name])}</dd>
                </div>)}</dl>
                {config.mode !== 'read' && keys.length > 0 && <details><summary>Edit record</summary><RecordForm resource={resource} columns={columns} row={row} /></details>}
                {config.mode === 'crud' && keys.length > 0 && <RecordForm resource={resource} columns={columns} row={row} remove />}
            </article>)}
            <nav aria-label="Record pages" className="flex gap-4">
                {page > 1 && <Link href={`/admin/${resource}?page=${page - 1}`}>Previous</Link>}
                {page * 50 < (count ?? 0) && <Link href={`/admin/${resource}?page=${page + 1}`}>Next</Link>}
            </nav>
        </>}
    </main>
}
