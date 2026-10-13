import { describe, expect, it } from 'vitest'
import { isValidStoryPath, storyAge, storyPath, storyTab, storyThumbPath } from './stories'

const S = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
describe('stories', () => {
  it('caminho segue o padrão do Storage e é validado', () => {
    const p = storyPath(S, ID, 'webp')
    expect(p).toBe(`stores/${S}/stories/${ID}.webp`)
    expect(isValidStoryPath(p, S)).toBe(true)
    expect(isValidStoryPath(storyThumbPath(p), S)).toBe(false)
    expect(isValidStoryPath(p, 'cccccccc-cccc-cccc-cccc-cccccccccccc')).toBe(false)
    expect(isValidStoryPath(`stores/${S}/products/${ID}.webp`, S)).toBe(false)
    expect(isValidStoryPath(`stores/${S}/stories/../x/${ID}.webp`, S)).toBe(false)
  })
  it('miniatura fica ao lado', () => expect(storyThumbPath('a/b.webp')).toBe('a/b_thumb.webp'))
  it('aba inválida vira pendentes', () => {
    expect(storyTab('converted')).toBe('converted')
    expect(storyTab('x')).toBe('pending')
  })
  it('idade em português', () => {
    const now = Date.parse('2026-10-13T12:00:00Z')
    expect(storyAge('2026-10-13T11:40:00Z', now)).toBe('agora há pouco')
    expect(storyAge('2026-10-13T09:00:00Z', now)).toBe('há 3 h')
    expect(storyAge('2026-10-12T09:00:00Z', now)).toBe('há 1 dia')
    expect(storyAge('2026-10-10T12:00:00Z', now)).toBe('há 3 dias')
  })
})
