import { learningRequest } from './learningApi'
import type { FounderContact, FundedFounder } from '../types'

export type FounderSearchResult = {
  founders: FundedFounder[]
  count: number
  updatedAt: string
  dataFreshness: string
}

export function searchFundedFounders(query: string, category: string) {
  const params = new URLSearchParams({ limit: '50' })
  if (query.trim()) params.set('query', query.trim())
  if (category.trim()) params.set('category', category.trim().toLowerCase().replace(/\s+/g, '-'))
  return learningRequest<FounderSearchResult>(`/founders/search?${params}`)
}

export async function fetchFounderContacts(companySlug: string) {
  const result = await learningRequest<{ contacts: FounderContact[] }>(`/founders/${encodeURIComponent(companySlug)}/contacts`)
  return result.contacts
}
