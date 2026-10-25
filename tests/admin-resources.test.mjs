import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import fs from 'node:fs'
import vm from 'node:vm'

function load(path, dependencies = {}) {
    const exports = {}
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, require: name => {
        if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
        return dependencies[name]
    } })
    return exports
}
const resources = load('app/admin/resources.ts')
function fixture({ admin = true, dbError = null, rows = [{ id: 'record' }] } = {}) {
    const calls = []
    const columns = [
        { name: 'id', type: 'uuid', primary_key: true, has_default: true },
        { name: 'prompt', type: 'text', required: true },
        { name: 'response', type: 'jsonb', required: true },
        { name: 'created_at', type: 'timestamptz', has_default: true },
    ]
    const query = {
        insert: value => { calls.push(['insert', value]); return query },
        update: value => { calls.push(['update', value]); return query },
        delete: () => { calls.push(['delete']); return query },
        eq: (...value) => { calls.push(['eq', ...value]); return query },
        select: async () => ({ data: rows, error: dbError }),
    }
    const { mutateResource } = load('app/admin/[resource]/actions.ts', {
        'next/cache': { revalidatePath: path => calls.push(['revalidate', path]) },
        '@/utils/supabase/admin': { requireAdmin: async () => {
            if (!admin) throw new Error('Forbidden')
            return { supabase: {
                rpc: async () => ({ data: columns }),
                from: table => { calls.push(['from', table]); return query },
            } }
        } },
        '../resources': resources,
    })
    return { mutateResource, calls }
}
const form = values => {
    const data = new FormData()
    Object.entries(values).forEach(([key, value]) => data.set(key, value))
    return data
}

test('untrusted resource names and forbidden mutations never reach a table', async () => {
    const { mutateResource, calls } = fixture()
    for (const [resource, operation] of [['__proto__', 'create'], ['profiles', 'update'], ['prompt-chains', 'delete'], ['llm-responses', 'create'], ['prompt-chain-mix', 'create'], ['terms', 'upsert']]) {
        assert.ok((await mutateResource(resource, operation, {}, form({}))).error)
    }
    assert.equal(calls.length, 0)
})

test('every mutation authenticates before accessing metadata or data', async () => {
    const { mutateResource, calls } = fixture({ admin: false })
    await assert.rejects(mutateResource('terms', 'create', {}, form({})), /Forbidden/)
    assert.equal(calls.length, 0)
})

test('updates use database primary keys and ignore injected fields', async () => {
    const { mutateResource, calls } = fixture()
    const result = await mutateResource('ai-generation-examples', 'update', {}, form({ 'key:id': 'record', prompt: 'Hello', response: '{"text":"World"}', is_superadmin: 'true', created_at: 'injected' }))
    assert.ok(result.success)
    const update = calls.find(c => c[0] === 'update')[1]
    assert.deepEqual(Object.keys(update).sort(), ['prompt', 'response'])
    assert.equal(update.response.text, 'World')
    assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'id' && c[2] === 'record'))
    assert.ok(calls.some(c => c[0] === 'revalidate' && c[1] === '/admin/ai-generation-examples'))
})

test('invalid JSON and missing required fields cannot mutate records', async () => {
    for (const values of [{ prompt: '', response: '{}' }, { prompt: 'Hello', response: '{bad}' }]) {
        const { mutateResource, calls } = fixture()
        assert.ok((await mutateResource('ai-generation-examples', 'create', {}, form(values))).error)
        assert.equal(calls.length, 0)
    }
})

test('delete requires an identifier and reports a missing row instead of success', async () => {
    const missing = fixture()
    assert.ok((await missing.mutateResource('terms', 'delete', {}, form({}))).error)
    assert.ok(!missing.calls.some(c => c[0] === 'revalidate'))
    const empty = fixture({ rows: [] })
    assert.match((await empty.mutateResource('terms', 'delete', {}, form({ 'key:id': 'gone' }))).error, /No record changed/)
})

test('database constraint errors are returned without a success message', async () => {
    const { mutateResource } = fixture({ dbError: { message: 'Foreign key constraint' }, rows: null })
    const result = await mutateResource('terms', 'delete', {}, form({ 'key:id': 'record' }))
    assert.equal(result.error, 'Foreign key constraint')
    assert.equal(result.success, undefined)
})
