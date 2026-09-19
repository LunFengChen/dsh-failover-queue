import { describe, expect, it } from 'vitest'
import { candidatesFromCatalog, candidatesFromText } from '../src/candidates.ts'
import { CANDIDATES_MARKER } from '../src/types.ts'

describe('candidatesFromCatalog', () => {
  it('flattens provider groups without a session', () => {
    expect(candidatesFromCatalog({
      groups: [
        {
          id: 'xfcodeai-grok',
          name: 'xfcodeai-grok',
          models: [{ id: 'grok-4.6', name: 'Grok 4.6' }],
        },
        {
          id: 'deepseek-official',
          name: 'DeepSeek',
          models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }],
        },
      ],
    })).toEqual([
      {
        provider: 'xfcodeai-grok',
        providerName: 'xfcodeai-grok',
        model: 'grok-4.6',
        name: 'Grok 4.6',
      },
      {
        provider: 'deepseek-official',
        providerName: 'DeepSeek',
        model: 'deepseek-chat',
        name: 'DeepSeek Chat',
      },
    ])
  })

  it('ignores missing or malformed catalogs', () => {
    expect(candidatesFromCatalog(undefined)).toEqual([])
    expect(candidatesFromCatalog({ groups: [{ id: 1 }] })).toEqual([])
  })
})

describe('candidatesFromText', () => {
  it('reads the command marker payload', () => {
    expect(candidatesFromText(`${CANDIDATES_MARKER}\n[{"provider":"a","model":"b","name":"B","providerName":"A"}]`)).toEqual([
      { provider: 'a', providerName: 'A', model: 'b', name: 'B' },
    ])
  })
})
