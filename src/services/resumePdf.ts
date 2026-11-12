type ResumeFields = {
  name?: string
  email?: string
  education?: string
  skills?: string
  projects?: string
  experience?: string
  links?: string
}

const sectionNames: Record<string, keyof ResumeFields> = {
  education: 'education', academic: 'education', 'academic background': 'education',
  skills: 'skills', 'technical skills': 'skills', competencies: 'skills',
  projects: 'projects', 'personal projects': 'projects',
  experience: 'experience', 'work experience': 'experience', employment: 'experience',
  'professional experience': 'experience', internships: 'experience',
}

function findSection(line: string): keyof ResumeFields | undefined {
  const normalized = line.trim().replace(/[:|]+$/, '').toLowerCase()
  return sectionNames[normalized]
}

export async function readResumePdf(file: File): Promise<ResumeFields> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const lines: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    let current = ''
    for (const item of content.items) {
      if (!('str' in item)) continue
      current += `${item.str}${item.hasEOL ? '\n' : ' '}`
    }
    lines.push(...current.split(/\n+/).map((line) => line.trim()).filter(Boolean))
  }

  const text = lines.join('\n')
  if (text.replace(/\s/g, '').length < 30) {
    throw new Error('This PDF has no selectable text. It may be a scanned document; OCR is not available yet.')
  }

  const fields: ResumeFields = {}
  const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)
  if (email) fields.email = email[0]
  const links = [...text.matchAll(/(?:https?:\/\/|www\.)[^\s|,)]+/gi)].map(([url]) => url.replace(/[.,;]+$/, ''))
  if (links.length) fields.links = [...new Set(links)].join('\n')

  const firstLine = lines.find((line) => !findSection(line) && !/@|https?:\/\//i.test(line) && !/\d{3,}/.test(line))
  if (firstLine && firstLine.length < 70 && /^[\p{L}][\p{L} .'-]+$/u.test(firstLine)) fields.name = firstLine

  let activeSection: keyof ResumeFields | undefined
  const sectionContent: Partial<Record<keyof ResumeFields, string[]>> = {}
  for (const line of lines) {
    const section = findSection(line)
    if (section) {
      activeSection = section
      sectionContent[section] ??= []
      continue
    }
    if (/^(summary|objective|contact|profile|certifications?|awards|languages|interests)\s*:??$/i.test(line)) {
      activeSection = undefined
      continue
    }
    if (activeSection && !/@|https?:\/\//i.test(line)) sectionContent[activeSection]?.push(line)
  }
  for (const field of ['education', 'skills', 'projects', 'experience'] as const) {
    const value = sectionContent[field]?.join('\n').trim()
    if (value) fields[field] = value
  }
  if (fields.skills) {
    fields.skills = fields.skills.replace(/\s*[•·|]\s*/g, ', ').replace(/\s{2,}/g, ' ').trim()
  }
  return fields
}
