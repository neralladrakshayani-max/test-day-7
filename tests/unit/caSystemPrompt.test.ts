import { describe, expect, it } from 'vitest'
import { CA_SYSTEM_PROMPT } from '../../src/services/caSystemPrompt'

describe('CA_SYSTEM_PROMPT', () => {
  it('defines the supported topics and professional escalation rules', () => {
    expect(CA_SYSTEM_PROMPT).toMatch(/GST/)
    expect(CA_SYSTEM_PROMPT).toMatch(/TDS/)
    expect(CA_SYSTEM_PROMPT).toMatch(/ITR deadlines/)
    expect(CA_SYSTEM_PROMPT).toMatch(/audit basics/)
    expect(CA_SYSTEM_PROMPT).toMatch(/consult a Chartered Accountant/)
    expect(CA_SYSTEM_PROMPT).toMatch(/outside CA Buddy's scope/)
  })
})
