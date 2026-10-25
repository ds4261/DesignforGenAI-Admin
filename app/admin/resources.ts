export const resources = {
    'prompt-chains': { table: 'prompt_chains', title: 'Prompt chains', mode: 'read' },
    'prompt-chain-steps': { table: 'prompt_chain_steps', title: 'Prompt chain steps', mode: 'read' },
    'prompt-chain-mix': { table: 'prompt_chain_mix', title: 'Prompt chain mix', mode: 'update' },
    terms: { table: 'terms', title: 'Terms', mode: 'crud' },
    'generation-requests': { table: 'generation_requests', title: 'Generation requests', mode: 'read' },
    'ai-generation-examples': { table: 'ai_generation_examples', title: 'AI generation examples', mode: 'crud' },
    'llm-models': { table: 'llm_models', title: 'LLM models', mode: 'crud' },
    'llm-providers': { table: 'llm_providers', title: 'LLM providers', mode: 'crud' },
    'llm-responses': { table: 'llm_responses', title: 'LLM responses', mode: 'read' },
    'allowed-signup-domains': { table: 'allowed_signup_domains', title: 'Allowed signup domains', mode: 'crud' },
    'whitelisted-emails': { table: 'whitelisted_emails', title: 'Whitelisted e-mail addresses', mode: 'crud' },
} as const

export type Resource = keyof typeof resources
export type Column = { name: string; type: string; required: boolean; has_default: boolean; primary_key: boolean; generated: boolean }
export function getResource(value: string) {
    return Object.hasOwn(resources, value) ? resources[value as Resource] : undefined
}
export function editable(column: Column, creating = false) {
    return !column.generated && (!column.primary_key || (creating && !column.has_default)) && !['created_at', 'updated_at'].includes(column.name)
}
