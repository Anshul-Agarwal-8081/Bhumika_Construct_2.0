import { env } from '../config/env.js'

const apiBase = 'https://recentfunding.com/api/v1'
function providerError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode, expose: true })
}

type JsonRecord = Record<string, unknown>
export type FundedFounder = {
  founderId: string
  founderName: string
  role: string
  companySlug: string
  companyName: string
  companyLogo: string | null
  stage: string | null
  amountUsd: number | null
  raisedAt: string | null
  category: string | null
  city: string | null
  founderUrl: string | null
  personSourceUrl: string | null
  linkedinUrl: string | null
  xHandle: string | null
}
export type FounderContact = { name: string; title: string | null; role: string | null; email: string | null; emailStatus: string; linkedin: string | null; source: string | null }

function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function numeric(value: unknown): number | null { const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN; return Number.isFinite(number) ? number : null }
function configured() {
  if (!env.RECENT_FUNDING_API_KEY) throw providerError('Add RECENT_FUNDING_API_KEY to backend/.env to enable Founder Finder.', 503)
  if (!env.RECENT_FUNDING_ON_BEHALF_OF) throw providerError('Set RECENT_FUNDING_ON_BEHALF_OF in backend/.env so the data provider knows who is using Founder Finder.', 503)
}

async function request(path: string, timeoutMs: number) {
  configured()
  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, {
      headers: {
        authorization: `Bearer ${env.RECENT_FUNDING_API_KEY}`,
        'x-on-behalf-of': env.RECENT_FUNDING_ON_BEHALF_OF!,
        'user-agent': 'Bhumika-FounderFinder/1.0',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    throw providerError('The startup data provider could not be reached. Try again shortly.', 503)
  }
  const body = await response.json().catch(() => ({})) as JsonRecord
  if (!response.ok) {
    const code = (body.error as JsonRecord | undefined)?.code
    const message = code === 'contacts_quota'
      ? 'The provider’s founder contact allowance is used up. No contact was returned.'
      : code === 'plan_required'
        ? 'This contact is only available on a live-data plan.'
        : response.status === 401
          ? 'The startup data provider key is invalid. Check backend/.env.'
          : response.status === 429
            ? 'The startup data provider limit was reached. Try again later.'
            : 'The startup data provider could not complete this request.'
    throw providerError(message, response.status === 401 ? 503 : response.status === 429 ? 429 : response.status === 402 || response.status === 403 ? 402 : 503)
  }
  return body
}

export async function searchFundedFounders(input: { query?: string; category?: string; limit: number }) {
  const url = new URL(`${apiBase}/founders`)
  url.searchParams.set('scope', 'founders')
  url.searchParams.set('country', 'india')
  url.searchParams.set('raised', '183')
  url.searchParams.set('sort', 'latest_raise')
  url.searchParams.set('limit', String(input.limit))
  if (input.query) url.searchParams.set('q', input.query)
  if (input.category) url.searchParams.set('category', input.category)
  const body = await request(`/founders?${url.searchParams.toString()}`, 20_000)
  const rawFounders = Array.isArray(body.founders) ? body.founders : []
  const founders: FundedFounder[] = rawFounders.flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as JsonRecord
    const slug = text(item.slug)
    const name = text(item.name)
    const companyName = text(item.company)
    if (!slug || !name || !companyName) return []
    return [{
      founderId: `${slug}:${name.toLowerCase()}`,
      founderName: name,
      role: text(item.role) ?? 'Founder',
      companySlug: slug,
      companyName,
      companyLogo: text(item.company_logo),
      stage: text(item.stage),
      amountUsd: numeric(item.amount_usd),
      raisedAt: text(item.raised_at),
      category: text(item.category),
      city: text(item.hq_city),
      founderUrl: text(item.profile_url),
      personSourceUrl: text(item.source_url),
      linkedinUrl: text(item.linkedin_url),
      xHandle: text(item.x_handle),
    }]
  })
  return { founders, count: numeric(body.count) ?? founders.length, updatedAt: new Date().toISOString(), dataFreshness: 'Funding announcements within 183 days; free provider access can be at least 14 days delayed.' }
}

export async function getFounderContacts(slug: string) {
  const body = await request(`/companies/${encodeURIComponent(slug)}/contacts`, 125_000)
  const contacts = Array.isArray(body.contacts) ? body.contacts : []
  return contacts.flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as JsonRecord
    const name = text(item.name)
    if (!name) return []
    const title = text(item.title)
    const role = text(item.role)
    if (!/\b(founder|co-founder|cofounder|ceo|chief executive)\b/i.test(`${title ?? ''} ${role ?? ''}`)) return []
    return [{ name, title, role, email: text(item.email), emailStatus: text(item.email_status) ?? 'not found', linkedin: text(item.linkedin), source: text(item.source) } satisfies FounderContact]
  })
}
