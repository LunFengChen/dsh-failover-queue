/** `/failover` verbs the host handler and tests share. */
export type FailoverVerb =
  | { readonly kind: 'status' }
  | { readonly kind: 'on' }
  | { readonly kind: 'off' }
  | { readonly kind: 'candidates' }
  | { readonly kind: 'error'; readonly text: string }

/**
 * Parse `/failover` arguments.
 * @param rawInput - text after the command name.
 */
export function parseFailoverArg(rawInput: string): FailoverVerb {
  const arg = rawInput.trim().toLowerCase()
  if (arg === '' || arg === 'status') return { kind: 'status' }
  if (arg === 'on' || arg === 'enable') return { kind: 'on' }
  if (arg === 'off' || arg === 'disable') return { kind: 'off' }
  if (arg === '__candidates' || arg === 'candidates') return { kind: 'candidates' }
  return { kind: 'error', text: 'Usage: /failover [on|off|status]' }
}
