'use client'

import { useActionState } from 'react'
import { Column, editable } from '../resources'
import { mutateResource } from './actions'

export function RecordForm({ resource, columns, row, remove = false }: {
    resource: string; columns: Column[]; row?: Record<string, unknown>; remove?: boolean
}) {
    const [state, action, pending] = useActionState(mutateResource.bind(null, resource, remove ? 'delete' : row ? 'update' : 'create'), {})
    const fields = columns.filter(column => editable(column, !row))
    return <form action={action} className="grid gap-4" onSubmit={event => {
        if (remove && !window.confirm('Delete this record permanently?')) event.preventDefault()
    }}>
        {row && columns.filter(c => c.primary_key).map(c => <input key={c.name} type="hidden" name={`key:${c.name}`} value={String(row[c.name])} />)}
        {!remove && fields.map(c => {
            const value = row?.[c.name]
            const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
            return <label key={c.name} className="grid gap-1">{c.name.replaceAll('_', ' ')}
                {c.type === 'bool' ? <select name={c.name} defaultValue={text} required={c.required && (!!row || !c.has_default)} className="rounded border p-2">
                    <option value="">{c.has_default && !row ? 'Use default' : 'Not set'}</option><option value="true">True</option><option value="false">False</option>
                </select> : <textarea name={c.name} defaultValue={text} rows={['json', 'jsonb'].includes(c.type) ? 4 : 2}
                    required={c.required && (!!row || !c.has_default)} className="w-full rounded border p-2" />}
                <span className="text-xs text-gray-500">{c.type}{c.required ? ' · required' : ' · optional'}{c.type.startsWith('_') ? ' · enter a JSON array' : ''}{c.has_default && !row ? ' · leave blank for default' : ''}</span>
            </label>
        })}
        {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
        {state.success && <p role="status">{state.success}</p>}
        <button disabled={pending} className={`${remove ? 'button-danger' : 'button-primary'} w-fit`}>{pending ? 'Saving…' : remove ? 'Delete record' : row ? 'Save changes' : 'Create record'}</button>
    </form>
}
