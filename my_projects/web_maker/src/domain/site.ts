import Dexie, { type EntityTable } from 'dexie'
import { z } from 'zod'

export const DEFAULT_SCOPES = {
  Landing: 'landing',
  Portfolio: 'portfolio',
  Portal: 'portal',
  MultiPage: 'multi-page marketing site',
  Content: 'content',
} as const

export const ProjectScope = DEFAULT_SCOPES
export type ProjectScope = (typeof ProjectScope)[keyof typeof ProjectScope]

export const DEFAULT_STYLES = [
  'Editorial Minimal',
  'Neo-Brutalist',
  'Soft Glass',
  'Dark Luxury',
  'Playful 3D',
  'Organic Studio',
] as const

export type AppStyle = (typeof DEFAULT_STYLES)[number]
export const ScopeStyles = DEFAULT_STYLES

export type Alignment = 'left' | 'center' | 'right'
export type AssetKind = 'image' | 'video'

export const SCHEMA_VERSION = 1
export const MAX_TEXT_LENGTH = 2000
export const MAX_LIST = 20
export const MAX_PROJECT_ASSETS = 60
export const MAX_BLOCKS_PER_PAGE = 20

export interface ConsentReceipt {
  provider: string
  grantedAt: string
  payloadDigest: string
  scope: string
  revokedAt?: string
}

export interface AppAsset {
  id: string
  name: string
  kind: AssetKind
  mimeType: string
  bytes: number
  attribution?: string
  dataUrl?: string
}

export type BlockType =
  | 'nav'
  | 'hero'
  | 'feature'
  | 'services'
  | 'gallery'
  | 'testimonials'
  | 'contact'
  | 'footer'
  | 'logo-cloud'
  | 'timeline'
  | 'faq'
  | 'pricing'
  | 'project-cards'

export interface BaseBlock {
  id: string
  type: BlockType
  alignment: Alignment
  heading: string
}

export interface NavBlock extends BaseBlock {
  type: 'nav'
  body: string
}

export interface HeroBlock extends BaseBlock {
  type: 'hero'
  body: string
  mediaId?: string
}

export interface FeatureBlock extends BaseBlock {
  type: 'feature'
  body: string
}

export interface ServicesBlock extends BaseBlock {
  type: 'services'
  services: string[]
}

export interface GalleryBlock extends BaseBlock {
  type: 'gallery'
  images: string[]
}

export interface TestimonialsBlock extends BaseBlock {
  type: 'testimonials'
  quote: string
}

export interface ContactBlock extends BaseBlock {
  type: 'contact'
  body: string
  emailRecipient: string
}

export interface FooterBlock extends BaseBlock {
  type: 'footer'
  body: string
}

export interface LogoCloudBlock extends BaseBlock {
  type: 'logo-cloud'
  logos: string[]
}

export interface TimelineBlock extends BaseBlock {
  type: 'timeline'
  events: string[]
}

export interface FaqBlock extends BaseBlock {
  type: 'faq'
  body: string
}

export interface PricingBlock extends BaseBlock {
  type: 'pricing'
  body: string
}

export interface ProjectCardsBlock extends BaseBlock {
  type: 'project-cards'
  projects: string[]
}

export type AppBlock =
  | NavBlock
  | HeroBlock
  | FeatureBlock
  | ServicesBlock
  | GalleryBlock
  | TestimonialsBlock
  | ContactBlock
  | FooterBlock
  | LogoCloudBlock
  | TimelineBlock
  | FaqBlock
  | PricingBlock
  | ProjectCardsBlock

export interface AppPage {
  id: string
  title: string
  slug: string
  blocks: AppBlock[]
}

export interface BriefState {
  audience: string
  goal: string
  content: string
  tone: string
}

export interface AppProject {
  schemaVersion: number
  id: string
  name: string
  scope: ProjectScope
  style: AppStyle
  brief: BriefState
  pages: AppPage[]
  assets: AppAsset[]
  motionEnabled: boolean
  motionIntensity?: number
  consents?: ConsentReceipt[]
  blocksCount?: number
  createdAt: string
  updatedAt: string
}

export interface AppProjectSummary {
  id: string
  name: string
  scope: ProjectScope
  style: AppStyle
  pages: number
  updatedAt: string
}

export interface ExportFile {
  path: string
  content: string | Uint8Array
}

export interface ParsedAssetReference {
  id: string
  fileName: string
  originalFilename: string
  originalType: string
  attribution: string
  placement: Array<{ pageId: string; pageName: string; blockId: string; blockType: BlockType }>
  dataUrl: string
  bytes: number
}

export interface ParseResult<T> {
  result: 'ok' | 'error'
  value: T
  errors: string[]
}

const nowIso = (): string => new Date().toISOString()
const isText = (value: unknown): value is string => typeof value === 'string'
const hasText = (value: unknown, limit = MAX_TEXT_LENGTH): value is string =>
  isText(value) && value.trim().length > 0 && value.length <= limit

const trimText = (value: string): string => value.trim()

const safeTextSchema = (label: string, limit = MAX_TEXT_LENGTH) =>
  z
    .string({ message: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(limit, 'Text exceeds limit')

const safeListSchema = (label: string, itemLimit = 1, textLimit = 120) =>
  z
    .array(safeTextSchema(`${label} item`, textLimit))
    .min(itemLimit, `${label} requires at least one item`)
    .max(MAX_LIST, `Too many ${label.toLowerCase()} items`)

const scopeValues = Object.values(DEFAULT_SCOPES)
const styleValues = Object.values(DEFAULT_STYLES)

const alignmentSchema = z.enum(['left', 'center', 'right'])
const scopeSchema = z
  .string()
  .pipe(
    z.custom<ProjectScope>((value): value is ProjectScope =>
      scopeValues.includes(value as ProjectScope),
    { message: 'Invalid scope' },
  ))
const styleSchema = z
  .string()
  .pipe(
    z.custom<AppStyle>((value): value is AppStyle => styleValues.includes(value as AppStyle), {
      message: 'Invalid style',
    }),
  )

const consentSchema = z
  .object({
    provider: safeTextSchema('provider', 100),
    grantedAt: z.string().datetime().default(() => nowIso()),
    payloadDigest: z
      .string()
      .trim()
      .min(8, 'Consent payload digest required')
      .max(240, 'Consent payload digest too long'),
    scope: safeTextSchema('Consent scope', 240),
    revokedAt: z.string().datetime().optional(),
  })
  .strict()

const assetSchema = z
  .object({
    id: safeTextSchema('Asset id', 120),
    name: safeTextSchema('Asset name', 140),
    kind: z.enum(['image', 'video']),
    mimeType: safeTextSchema('Asset MIME type', 80),
    bytes: z.number().int().nonnegative('Asset bytes must be >= 0'),
    attribution: safeTextSchema('Attribution', 200).optional(),
    dataUrl: z
      .string()
      .max(5 * 1024 * 1024, 'Asset data exceeds limit')
      .regex(/^data:(?:image|video)\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i, 'Asset data URL is invalid')
      .optional(),
  })
  .strict()

const navSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('nav'),
    alignment: alignmentSchema,
    heading: safeTextSchema('nav heading', 120),
    body: safeTextSchema('nav body', 300),
  })
  .strict()

const heroSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('hero'),
    alignment: alignmentSchema,
    heading: safeTextSchema('hero heading', 120),
    body: safeTextSchema('hero body'),
    mediaId: safeTextSchema('Hero media', 200).optional(),
  })
  .strict()

const featureSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('feature'),
    alignment: alignmentSchema,
    heading: safeTextSchema('feature heading', 120),
    body: safeTextSchema('feature body'),
  })
  .strict()

const servicesSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('services'),
    alignment: alignmentSchema,
    heading: safeTextSchema('services heading', 120),
    services: safeListSchema('Services', 1, 80),
  })
  .strict()

const gallerySchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('gallery'),
    alignment: alignmentSchema,
    heading: safeTextSchema('gallery heading', 120),
    images: z
      .array(safeTextSchema('Gallery image', 200))
      .max(MAX_LIST, 'Too many images'),
  })
  .strict()

const testimonialsSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('testimonials'),
    alignment: alignmentSchema,
    heading: safeTextSchema('testimonials heading', 120),
    quote: safeTextSchema('Testimonial quote', 260),
  })
  .strict()

const contactSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('contact'),
    alignment: alignmentSchema,
    heading: safeTextSchema('contact heading', 120),
    body: safeTextSchema('Contact body', 1400),
    emailRecipient: z
      .string()
      .trim()
      .email('Contact email recipient is invalid')
      .max(320, 'Text exceeds limit'),
  })
  .strict()

const footerSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('footer'),
    alignment: alignmentSchema,
    heading: safeTextSchema('footer heading', 120),
    body: safeTextSchema('footer body', 1400),
  })
  .strict()

const logoCloudSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('logo-cloud'),
    alignment: alignmentSchema,
    heading: safeTextSchema('logo-cloud heading', 120),
    logos: safeListSchema('Logo', 1, 80),
  })
  .strict()

const timelineSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('timeline'),
    alignment: alignmentSchema,
    heading: safeTextSchema('timeline heading', 120),
    events: safeListSchema('Timeline event', 1, 160),
  })
  .strict()

const faqSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('faq'),
    alignment: alignmentSchema,
    heading: safeTextSchema('faq heading', 120),
    body: safeTextSchema('faq body', 1200),
  })
  .strict()

const pricingSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('pricing'),
    alignment: alignmentSchema,
    heading: safeTextSchema('pricing heading', 120),
    body: safeTextSchema('pricing body', 1200),
  })
  .strict()

const projectCardsSchema = z
  .object({
    id: safeTextSchema('Block id', 120),
    type: z.literal('project-cards'),
    alignment: alignmentSchema,
    heading: safeTextSchema('project cards heading', 120),
    projects: safeListSchema('Project card', 1, 160),
  })
  .strict()

const blockSchema = z.discriminatedUnion('type', [
  navSchema,
  heroSchema,
  featureSchema,
  servicesSchema,
  gallerySchema,
  testimonialsSchema,
  contactSchema,
  footerSchema,
  logoCloudSchema,
  timelineSchema,
  faqSchema,
  pricingSchema,
  projectCardsSchema,
])

const pageSchema = z
  .object({
    id: safeTextSchema('Page id', 120),
    title: safeTextSchema('Page title', 120),
    slug: z
      .string()
      .trim()
      .min(1, 'Page slug is required')
      .max(64, 'Text exceeds limit')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Page slug must be lowercase URL-safe'),
    blocks: z
      .array(blockSchema)
      .min(1, 'Each page must contain at least one block')
      .max(MAX_BLOCKS_PER_PAGE, 'Too many blocks'),
  })
  .strict()

const briefSchema = z
  .object({
    audience: safeTextSchema('Audience', 220),
    goal: safeTextSchema('Goal', 220),
    content: safeTextSchema('Content', 1200),
    tone: safeTextSchema('Tone', 120),
  })
  .strict()

export const projectSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: safeTextSchema('Project id', 120),
    name: safeTextSchema('Project name', 120),
    scope: scopeSchema,
    style: styleSchema,
    brief: briefSchema,
    pages: z
      .array(pageSchema)
      .min(1, 'At least one page is required')
      .max(MAX_LIST, 'Too many pages'),
    assets: z.array(assetSchema).max(MAX_PROJECT_ASSETS, 'Too many assets'),
    motionEnabled: z.boolean().default(false),
    motionIntensity: z.number().min(0).max(1).default(0.5),
    consents: z.array(consentSchema).max(MAX_LIST, 'Too many consent receipts').default([]),
    blocksCount: z.number().int().nonnegative().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

const safeProjectFallback = (): AppProject => ({ schemaVersion: SCHEMA_VERSION } as AppProject)

const migrateProject = (input: unknown): unknown => {
  if (input === null || typeof input !== 'object') {
    return input
  }
  const record = input as Record<string, unknown>
  // Versionless records predate canonical storage. This is the sole supported migration.
  return record.schemaVersion === undefined ? { ...record, schemaVersion: SCHEMA_VERSION } : record
}

export const parseProject = (input: unknown): ParseResult<AppProject> => {
  const staged = migrateProject(input)
  const parsed = projectSchema.safeParse(staged)
  if (!parsed.success) {
    return {
      result: 'error',
      value: safeProjectFallback(),
      errors: parsed.error.issues.map((issue) => {
        if (issue.code === 'invalid_union_discriminator' && staged !== null && typeof staged === 'object') {
          const value = issue.path.reduce<unknown>((current, key) =>
            current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined, staged)
          return `Unknown block type: ${String(value)}`
        }
        return issue.message
      }),
    }
  }

  const blocksCount = parsed.data.pages.reduce((sum, page) => sum + page.blocks.length, 0)
  const value = {
    ...parsed.data,
    blocksCount,
  }

  return { result: 'ok', value, errors: [] }
}

const normalizeProject = (project: AppProject): AppProject => {
  const parsed = parseProject(project)
  if (parsed.result === 'error') {
    throw new Error(`Invalid project: ${parsed.errors.join('; ')}`)
  }
  return {
    ...parsed.value,
    createdAt: project.createdAt || nowIso(),
    updatedAt: project.updatedAt || nowIso(),
    blocksCount: parsed.value.pages.reduce((sum, page) => sum + page.blocks.length, 0),
  }
}

export const canImportAsset = (mimeType: string, bytes: number): string | null => {
  if (!mimeType) {
    return 'Asset MIME type missing'
  }

  if (mimeType === 'image/svg+xml') return 'SVG uploads are not supported for safety'
  const images = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
  const videos = ['video/mp4', 'video/webm', 'video/quicktime']

  if (images.includes(mimeType)) {
    return bytes <= 20 * 1024 * 1024 ? null : 'Image exceeds 20 MiB limit'
  }

  if (videos.includes(mimeType)) {
    return bytes <= 200 * 1024 * 1024 ? null : 'Video exceeds 200 MiB limit'
  }

  return `Unsupported MIME type: ${mimeType}`
}

const buildTemplatePages = (scope: ProjectScope): AppPage[] => {
  if (scope === ProjectScope.Portfolio) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Portfolio',
        slug: 'portfolio',
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'hero',
            heading: 'Portfolio showcase',
            body: 'Feature your strongest projects with confident, readable sections.',
            alignment: 'left',
          },
          {
            id: crypto.randomUUID(),
            type: 'gallery',
            heading: 'Selected work',
            images: [],
            alignment: 'left',
          },
          {
            id: crypto.randomUUID(),
            type: 'contact',
            heading: 'Contact',
            body: 'Tell us how we can help with your next launch.',
            emailRecipient: 'hello@example.com',
            alignment: 'left',
          },
        ],
      },
    ]
  }

  if (scope === ProjectScope.MultiPage) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Home',
        slug: 'home',
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'hero',
            heading: 'Multi-page experience',
            body: 'Showcase your offer and next best action across clear site sections.',
            alignment: 'left',
          },
          {
            id: crypto.randomUUID(),
            type: 'services',
            heading: 'Services',
            services: ['Discovery', 'Build', 'Launch'],
            alignment: 'left',
          },
          {
            id: crypto.randomUUID(),
            type: 'pricing',
            heading: 'Plans',
            body: 'Starter, Growth, and Premium plans with transparent scope boundaries.',
            alignment: 'left',
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: 'About',
        slug: 'about',
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'feature',
            heading: 'About',
            body: 'A focused studio approach built for independent creators.',
            alignment: 'left',
          },
          {
            id: crypto.randomUUID(),
            type: 'footer',
            heading: 'Footer',
            body: 'Built with StudioForge',
            alignment: 'center',
          },
        ],
      },
    ]
  }

  if (scope === ProjectScope.Content) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Content',
        slug: 'content',
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'hero',
            heading: 'Editorial content hub',
            body: 'Publish thoughtful long-form updates with a consistent structure.',
            alignment: 'left',
          },
          {
            id: crypto.randomUUID(),
            type: 'faq',
            heading: 'Frequently asked questions',
            body: 'Answer the questions your buyers ask before buying.',
            alignment: 'left',
          },
          {
            id: crypto.randomUUID(),
            type: 'timeline',
            heading: 'Roadmap',
            events: ['Research', 'Design', 'Delivery'],
            alignment: 'left',
          },
        ],
      },
    ]
  }

  return [
    {
      id: crypto.randomUUID(),
      title: 'Home',
      slug: 'home',
      blocks: [
        {
          id: crypto.randomUUID(),
          type: 'hero',
          heading: 'Your StudioForge site',
          body: 'Build with reusable components, locally and quickly.',
          alignment: 'left',
        },
        {
          id: crypto.randomUUID(),
          type: 'services',
          heading: 'Core offerings',
          services: ['Brand strategy', 'Site redesign', 'Delivery'],
          alignment: 'left',
        },
        {
          id: crypto.randomUUID(),
          type: 'contact',
          heading: 'Contact',
          body: 'Tell us what you want to launch next.',
          emailRecipient: 'hello@example.com',
          alignment: 'left',
        },
      ],
    },
  ]
}

export const createDefaultProject = (name: string, scope: ProjectScope = DEFAULT_SCOPES.Landing): AppProject => {
  const now = nowIso()
  const normalizedScope = Object.values(ProjectScope).includes(scope) ? scope : ProjectScope.Landing
  const pages = buildTemplatePages(normalizedScope)

  const project: AppProject = {
    schemaVersion: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: trimText(name),
    scope: normalizedScope,
    style: DEFAULT_STYLES[0],
    brief: {
      audience: 'small business owners',
      goal: 'showcase services',
      content: 'A refined homepage and portfolio',
      tone: 'professional',
    },
    pages,
    assets: [],
    motionEnabled: false,
    motionIntensity: 0.5,
    consents: [],
    createdAt: now,
    updatedAt: now,
    blocksCount: pages.reduce((sum, page) => sum + page.blocks.length, 0),
  }

  return normalizeProject(project)
}

export const summarizeProject = (project: AppProject): string =>
  `${project.scope} · ${project.style} · ${project.pages.length} page${project.pages.length === 1 ? '' : 's'} · ${project.assets.length} asset${project.assets.length === 1 ? '' : 's'}`

export const styleContrastStatus = (style: AppStyle): string => {
  const text = styleTokens[style].text
  return text.startsWith('#f') || text.startsWith('#F') ? 'AA target' : 'AA+ target'
}

export const blockTemplateForType = (type: BlockType): AppBlock => {
  switch (type) {
    case 'nav':
      return { id: crypto.randomUUID(), type: 'nav', heading: 'Navigation', body: 'Home · Work · Contact', alignment: 'left' }
    case 'hero':
      return { id: crypto.randomUUID(), type: 'hero', heading: 'Hero', body: 'Describe your offer in one line.', alignment: 'left' }
    case 'feature':
      return { id: crypto.randomUUID(), type: 'feature', heading: 'Feature', body: 'Explain the benefit in plain language.', alignment: 'left' }
    case 'services':
      return {
        id: crypto.randomUUID(),
        type: 'services',
        heading: 'Services',
        services: ['Service one', 'Service two'],
        alignment: 'left',
      }
    case 'gallery':
      return { id: crypto.randomUUID(), type: 'gallery', heading: 'Gallery', images: [], alignment: 'left' }
    case 'testimonials':
      return { id: crypto.randomUUID(), type: 'testimonials', heading: 'Testimonial', quote: 'Fast and reliable work.', alignment: 'left' }
    case 'contact':
      return {
        id: crypto.randomUUID(),
        type: 'contact',
        heading: 'Contact',
        body: 'Tell us what you need.',
        emailRecipient: 'hello@example.com',
        alignment: 'left',
      }
    case 'footer':
      return { id: crypto.randomUUID(), type: 'footer', heading: 'Footer', body: 'Studio terms and links.', alignment: 'center' }
    case 'logo-cloud':
      return { id: crypto.randomUUID(), type: 'logo-cloud', heading: 'Trusted by', logos: ['Brand 1', 'Brand 2'], alignment: 'left' }
    case 'timeline':
      return { id: crypto.randomUUID(), type: 'timeline', heading: 'Timeline', events: ['Discovery', 'Build'], alignment: 'left' }
    case 'faq':
      return { id: crypto.randomUUID(), type: 'faq', heading: 'FAQ', body: 'What does this solve?', alignment: 'left' }
    case 'pricing':
      return {
        id: crypto.randomUUID(),
        type: 'pricing',
        heading: 'Pricing',
        body: 'Starter, Growth, Premium with scope boundaries.',
        alignment: 'left',
      }
    case 'project-cards':
      return { id: crypto.randomUUID(), type: 'project-cards', heading: 'Selected projects', projects: ['Project one', 'Project two'], alignment: 'left' }
    default:
      return { id: crypto.randomUUID(), type: 'hero', heading: 'Hero', body: 'Describe your offer.', alignment: 'left' }
  }
}

const styleTokens: Record<AppStyle, Record<string, string>> = {
  'Editorial Minimal': {
    background: '#f5f7fb',
    surface: '#ffffff',
    text: '#1f2530',
    accent: '#3f56ff',
    cardBorder: '#cfd6e3',
    radius: '10px',
  },
  'Neo-Brutalist': {
    background: '#f3e8ff',
    surface: '#fff7cc',
    text: '#101010',
    accent: '#ff6a00',
    cardBorder: '#000000',
    radius: '0px',
  },
  'Soft Glass': {
    background: '#f6f3ef',
    surface: 'rgba(255, 255, 255, 0.68)',
    text: '#1f232d',
    accent: '#6f5bff',
    cardBorder: 'rgba(255, 255, 255, 0.55)',
    radius: '14px',
  },
  'Dark Luxury': {
    background: '#181b23',
    surface: '#252a35',
    text: '#f3f5f8',
    accent: '#c8a36a',
    cardBorder: '#3d495e',
    radius: '12px',
  },
  'Playful 3D': {
    background: '#fdf0f5',
    surface: '#fff7fc',
    text: '#1f1c2a',
    accent: '#ff2f92',
    cardBorder: '#ffafdd',
    radius: '18px',
  },
  'Organic Studio': {
    background: '#eff9f3',
    surface: '#fbfefc',
    text: '#1f3029',
    accent: '#2f9e73',
    cardBorder: '#bfd9cb',
    radius: '22px',
  },
}

const styleCss = (style: AppStyle, motionEnabled = false) => {
  const tokens = styleTokens[style]
  return `
:root {
  --background: ${tokens.background};
  --surface: ${tokens.surface};
  --text: ${tokens.text};
  --accent: ${tokens.accent};
  --border: ${tokens.cardBorder};
  --radius: ${tokens.radius};
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif;
  background: var(--background);
  color: var(--text);
}
main { max-width: 980px; margin: 0 auto; padding: 1rem; }
nav ul { margin: .25rem 0 1rem; padding: 0; display: flex; gap: .75rem; flex-wrap: wrap; list-style: none; }
nav a { color: var(--text); text-decoration: none; }
section {
  padding: .95rem;
  margin: .7rem 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
article { margin-bottom: 1rem; }
h1,h2,h3 { margin: 0 0 .55rem; }
.media-grid { display: grid; gap: .45rem; grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); }
img,video { width: 100%; border-radius: calc(var(--radius)*.8); }
form.contact-form { display: grid; gap: .5rem; }
label { display: grid; gap: .25rem; }
input, textarea, button, select {
  border: 1px solid #bcc4d2;
  border-radius: .45rem;
  padding: .45rem .6rem;
}
button { border: none; background: var(--accent); color: #fff; font-weight: 600; cursor: pointer; }
${motionEnabled ? '.motion-ready section { animation: studioforge-rise .45s ease both; } @keyframes studioforge-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }' : ''}
@media (max-width: 768px) {
  main { padding: .75rem; }
}
@media (max-width: 390px) {
  section { margin: .5rem 0; padding: .75rem; }
}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
`
}

const safeText = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const safeMediaUrl = (value: string): string | null =>
  /^data:(?:image|video)\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(value) ? value : null

export const resolveBlockAssets = (references: string[], resolver: Map<string, string>): string[] =>
  references
    .map((id) => resolver.get(id))
    .map((value) => (value && hasText(value, 5 * 1024 * 1024) ? safeMediaUrl(value) : null))
    .filter((value): value is string => value !== null)

const bodyForBlock = (block: AppBlock, assetResolver: Map<string, string>) => {
  if (block.type === 'hero') {
    const source = block.mediaId ? assetResolver.get(block.mediaId) : undefined
    const media = source ? (source.startsWith('data:video/')
      ? `<video controls playsinline preload="metadata" src="${safeText(source)}" aria-label="hero video"></video>`
      : `<img src="${safeText(source)}" alt="hero media" />`) : ''
    return `<p>${safeText(block.body)}</p>${media}`
  }
  if (block.type !== 'contact' && 'body' in block && hasText(block.body)) {
    return `<p>${safeText(block.body).replaceAll('\n', '<br/>')}</p>`
  }

  if (block.type === 'testimonials') {
    return `<p>${safeText(block.quote)}</p>`
  }

  if (block.type === 'services') {
    return `<ul>${block.services.map((item) => `<li>${safeText(item)}</li>`).join('')}</ul>`
  }

  if (block.type === 'project-cards') {
    return `<div class="media-grid">${block.projects.map((project) => `<article><strong>${safeText(project)}</strong></article>`).join('')}</div>`
  }

  if (block.type === 'gallery') {
    const media = resolveBlockAssets(block.images, assetResolver)
      .slice(0, 8)
      .map((src, index) => {
        if (/\.webm$|\.mp4$/.test(src.toLowerCase()) || src.startsWith('data:video/')) {
          return `<video controls playsinline preload="none" src="${safeText(src)}" aria-label="gallery video ${index + 1}"></video>`
        }
        return `<img src="${safeText(src)}" alt="gallery image ${index + 1}" />`
      })
      .join('')
    return `<div class="media-grid">${media || '<p>No media assigned yet.</p>'}</div>`
  }

  if (block.type === 'logo-cloud') {
    return `<ul>${block.logos.map((logo) => `<li>${safeText(logo)}</li>`).join('')}</ul>`
  }

  if (block.type === 'timeline') {
    return `<ol>${block.events.map((event) => `<li>${safeText(event)}</li>`).join('')}</ol>`
  }

  if (block.type === 'contact') {
    const subject = encodeURIComponent(`${block.heading} inquiry`)
    const mailto = `mailto:${block.emailRecipient}?subject=${subject}`
    return [
      `<p>${safeText(block.body)}</p>`,
      `<p><a class="contact-fallback" href="${safeText(mailto)}">Contact via email</a></p>`,
      `<form class="contact-form" action="${safeText(mailto)}" method="post" enctype="text/plain">`,
      '<label><span>Name</span><input required name="name" placeholder="Your name"/></label>',
      '<label><span>Email</span><input required type="email" name="email" placeholder="you@domain.com"/></label>',
      '<label><span>Message</span><textarea required rows="4" name="message"></textarea></label>',
      '<button type="submit">Send email</button>',
      '</form>',
    ].join('')
  }

  return ''
}

const renderNav = (pages: AppPage[]) => {
  const links = pages
    .map((page) => `<li><a href="#${safeText(page.slug)}">${safeText(page.title)}</a></li>`)
    .join('')
  return `<nav aria-label="Site navigation"><ul>${links}</ul></nav>`
}

export const renderProjectPreviewHtml = (project: AppProject, assetUrls: Map<string, string> = new Map()): string => {
  const pagesMarkup = project.pages
    .map((page) => {
      const blocksMarkup = page.blocks
        .map((block) => `<section style="text-align:${block.alignment}"><h3>${safeText(block.heading)}</h3>${bodyForBlock(block, assetUrls)}</section>`)
        .join('')
      return `<article id="${safeText(page.slug)}"><h2>${safeText(page.title)}</h2>${blocksMarkup}</article>`
    })
    .join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeText(project.name)}</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; media-src data:; style-src 'unsafe-inline'; form-action mailto:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; script-src 'none'; connect-src 'none';" />
    <style>${styleCss(project.style, project.motionEnabled)}</style>
  </head>
  <body>
    ${renderNav(project.pages)}
    <main class="${project.motionEnabled ? 'motion-ready' : ''}">${pagesMarkup}</main>
  </body>
</html>`
}

export const renderExportBundle = (project: AppProject, assets: ParsedAssetReference[] = []) => {
  const resolver = new Map<string, string>()
  for (const asset of assets) {
    resolver.set(asset.id, asset.dataUrl)
  }

  const index = renderProjectPreviewHtml(project, resolver)
  const css = styleCss(project.style, project.motionEnabled)
  const script = ''

  const manifest = JSON.stringify(
    {
      projectName: project.name,
      projectId: project.id,
      scope: project.scope,
      style: project.style,
      schemaVersion: project.schemaVersion,
      generatedAt: nowIso(),
      assetUsageNotice: 'All exported assets are User-provided files. The exporter is responsible for confirming rights, licenses, permissions, and any required attribution before publishing.',
      assets: assets.map(({ id, fileName, originalFilename, originalType, attribution, placement }) => ({
        id,
        fileName,
        originalFilename,
        originalType,
        placement,
        attribution,
      })),
    },
    null,
    2,
  )

  return { index, css, script, manifest }
}

const originalAssetFilename = (asset: AppAsset): string => asset.name.replaceAll('\\', '/').split('/').filter(Boolean).pop() || 'asset'

const assetPlacements = (project: AppProject, assetId: string): ParsedAssetReference['placement'] => project.pages.flatMap((page) => page.blocks.flatMap((block) => {
  const placed = (block.type === 'hero' && block.mediaId === assetId) || (block.type === 'gallery' && block.images.includes(assetId))
  return placed ? [{ pageId: page.id, pageName: page.title, blockId: block.id, blockType: block.type }] : []
}))

export const listExportAssetRows = (project: AppProject): ParsedAssetReference[] =>
  project.assets
    .filter((asset): asset is AppAsset & { dataUrl: string } => hasText(asset.id) && hasText(asset.dataUrl) && hasText(asset.name))
    .map((asset) => ({
      id: asset.id,
      fileName: toAssetFileName(asset),
      originalFilename: originalAssetFilename(asset),
      originalType: asset.mimeType,
      attribution: asset.attribution ?? 'User-provided — attribution not supplied',
      placement: assetPlacements(project, asset.id),
      dataUrl: asset.dataUrl!,
      bytes: asset.bytes,
    }))

const toAssetFileName = (asset: AppAsset): string => {
  const safeName = originalAssetFilename(asset)
    .replaceAll(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const base = safeName || 'asset'
  return `${base}-${asset.id.slice(0, 6)}.${extForMime(asset.mimeType)}`
}

const extForMime = (mimeType: string): string => {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'video/mp4') return 'mp4'
  if (mimeType === 'video/webm') return 'webm'
  if (mimeType === 'video/quicktime') return 'mov'
  return 'bin'
}

const dockerfile = [
  'FROM nginxinc/nginx-unprivileged:1.27-alpine',
  'COPY nginx.conf /etc/nginx/conf.d/default.conf',
  'COPY . /usr/share/nginx/html',
  'EXPOSE 8080',
  'HEALTHCHECK --interval=30s --timeout=5s --start-period=2s CMD wget -qO- http://127.0.0.1:8080/ || exit 1',
  'CMD ["nginx", "-g", "daemon off;"]',
].join('\n')

const dockerCompose = [
  'services:',
  '  studioforge-export:',
  '    build: .',
  '    ports:',
  '      - "8080:8080"',
  '    restart: unless-stopped',
].join('\n')
const dockerIgnore = [
  '*',
  '!index.html',
  '!styles.css',
  '!script.js',
  '!manifest.json',
  '!README.md',
  '!assets',
  '!assets/**',
  '!nginx.conf',
  '!Dockerfile',
  '!compose.yaml',
].join('\n')
const nginxConf = [
  'server {',
  '  listen 8080;',
  '  root /usr/share/nginx/html;',
  '  index index.html;',
  '  location / {',
  '    try_files $uri $uri/ =404;',
  '  }',
  '}',
].join('\n')
const readmeFromProject = (project: AppProject, assets: ParsedAssetReference[]): string => [
  `# ${project.name}`,
  '',
  'Generated with StudioForge.',
  '',
  `- Scope: ${project.scope}`,
  `- Style: ${project.style}`,
  `- Motion enabled: ${project.motionEnabled ? 'yes' : 'no'}`,
  `- Motion intensity: ${project.motionIntensity}`,
  '',
  '## Run locally',
  '1. Serve from a static host or open index.html from the generated folder.',
  '2. Contact form uses `mailto:` fallback when no third-party endpoint is configured.',
  '',
  '## Docker',
  'Build with the included Dockerfile and run with `docker run -p 8080:8080 <image>` or `docker compose up`.',
  '',
  '## Export',
  'Includes generated manifest and asset list for auditability.',
  '',
  '## Asset rights and attribution',
  'All exported assets are user-provided files. Rights for all user-provided files remain the exporter’s responsibility.',
  'Confirm licenses, permissions, and required credits before publishing. `manifest.json` is the machine-readable asset contract.',
  '',
  ...(assets.length === 0 ? ['No user-provided assets were included.'] : assets.flatMap((asset) => [
    `- ${asset.id}: ${asset.originalFilename} (${asset.originalType}); placement: ${asset.placement.length ? asset.placement.map((item) => `${item.pageName}/${item.blockType}#${item.blockId}`).join(', ') : 'not placed'}; attribution: ${asset.attribution}`,
  ])),
  '',
  'Do not store secrets in these exports.',
].join('\n')
const toDataUrlFromBase64 = (asset: ParsedAssetReference) => {
  if (!asset.dataUrl.trim()) {
    return { path: `assets/${asset.fileName}`, content: '' as string | Uint8Array }
  }
  const trimmed = asset.dataUrl.trim()
  const payload = trimmed.split(',')[1]
  const bytes = payload ? Uint8Array.from(atob(payload), (char) => char.charCodeAt(0)) : new Uint8Array()
  return { path: `assets/${asset.fileName}`, content: bytes }
}

export const buildExportFiles = (project: AppProject, includeDocker = false): ExportFile[] => {
  const parsed = parseProject(project)
  if (parsed.result === 'error') {
    throw new Error(`Cannot export invalid project: ${parsed.errors.join('; ')}`)
  }

  const normalized = parsed.value
  const assets = listExportAssetRows(normalized)
  const bundle = renderExportBundle(normalized, assets)

  const files: ExportFile[] = [
    { path: 'index.html', content: bundle.index },
    { path: 'styles.css', content: bundle.css },
    { path: 'script.js', content: bundle.script },
    { path: 'manifest.json', content: bundle.manifest },
    { path: 'README.md', content: readmeFromProject(normalized, assets) },
  ]

  for (const asset of assets) {
    files.push(toDataUrlFromBase64(asset))
  }

  if (!includeDocker) {
    return files
  }

  return [
    ...files,
    { path: 'Dockerfile', content: `${dockerfile}\n` },
    { path: 'compose.yaml', content: `${dockerCompose}\n` },
    { path: '.dockerignore', content: `${dockerIgnore}\n` },
    { path: 'nginx.conf', content: `${nginxConf}\n` },
  ]
}

export const generateSeedancePrompt = (project: AppProject, placement = 'selected website media block'): string => {
  const hero = project.pages[0]?.blocks.find((block) => block.type === 'hero')
  const heading = hero && 'heading' in hero ? hero.heading : 'premium website hero section'
  const context = hero && 'body' in hero ? hero.body : ''

  return [
    'This is a copyable Seedance 2.0+ prompt, not media generation in StudioForge.',
    `Scope: ${project.scope}.`,
    `Style: ${project.style}.`,
    `Audience: ${project.brief.audience || 'small business owner'}.`,
    `Project goal: ${project.brief.goal || 'showcase services'} and tone: ${project.brief.tone || 'professional'}.`,
    `Primary prompt: ${heading}. ${context}`,
    `Intended placement: ${placement}.`,
    'Duration: 8 seconds. Aspect: 16:9 unless otherwise requested.',
    'Camera: gentle dolly-in, stable framing, warm editorial lighting, premium composition.',
    'Motion: subtle parallax and hover micro-cues with reduced-motion safe fallback.',
    'Negative: logos/text overlays, noisy compression, obvious AI artifacts.',
  ].join('\n')
}

const PROJECTS_STORAGE_KEY = 'studioforge:projects'
const DELETED_PROJECTS_STORAGE_KEY = 'studioforge:deleted-projects'
const LEGACY_MIGRATION_KEY = 'studioforge:indexeddb-migration-v1'
const DATABASE_NAME = 'studioforge-projects'

interface StoredAsset {
  key: string
  projectId: string
  assetId: string
  blob: Blob
}

interface ProjectRecord {
  id: string
  project: AppProject
}

class ProjectDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, 'id'>
  deletedProjects!: EntityTable<ProjectRecord, 'id'>
  assets!: EntityTable<StoredAsset, 'key'>

  constructor() {
    super(DATABASE_NAME)
    this.version(1).stores({
      projects: 'id, project.updatedAt',
      deletedProjects: 'id, project.updatedAt',
      assets: 'key, projectId, assetId',
    })
  }
}

const database = new ProjectDatabase()

export interface StorageState {
  projects: AppProject[]
  deletedProjects: AppProject[]
}

export type StorageResult<T> = { ok: true; value: T } | { ok: false; error: string }

const safeParseRows = (rows: unknown[]): AppProject[] => rows
  .map((row) => parseProject(row))
  .filter((parsed): parsed is ParseResult<AppProject> & { result: 'ok' } => parsed.result === 'ok')
  .map((parsed) => parsed.value)
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

const isQuotaError = (error: unknown): boolean => error instanceof DOMException && (
  error.name === 'QuotaExceededError' || error.name === 'UnknownError'
)

const storageError = (error: unknown): Error => {
  if (isQuotaError(error)) return new Error('Local storage is full. Remove unused projects or assets and try again.')
  return error instanceof Error ? error : new Error('Unable to save local project data. Your existing projects were not changed.')
}

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, encoded] = dataUrl.split(',', 2)
  const mimeType = header?.match(/^data:([^;]+);base64$/i)?.[1] ?? 'application/octet-stream'
  const bytes = Uint8Array.from(atob(encoded ?? ''), (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: mimeType })
}

const blobToDataUrl = async (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(reader.error ?? new Error('Unable to read local asset'))
  reader.onload = () => resolve(String(reader.result))
  const value = blob as Blob & { type?: string }
  reader.readAsDataURL(blob instanceof Blob ? blob : new Blob([blob], { type: value.type }))
})

const assetKey = (projectId: string, assetId: string) => `${projectId}:${assetId}`

const toRecord = (project: AppProject): ProjectRecord => ({
  id: project.id,
  project: {
    ...project,
    assets: project.assets.map((asset) => {
      const metadata = { ...asset }
      delete metadata.dataUrl
      return metadata
    }),
  },
})

const hydrateRecord = async (record: ProjectRecord): Promise<AppProject | null> => {
  const assetRows = await database.assets.where('projectId').equals(record.id).toArray()
  const assetData = new Map(await Promise.all(assetRows.map(async (asset) => [asset.assetId, await blobToDataUrl(asset.blob)] as const)))
  const parsed = parseProject({
    ...record.project,
    assets: record.project.assets.map((asset) => ({ ...asset, ...(assetData.has(asset.id) ? { dataUrl: assetData.get(asset.id) } : {}) })),
  })
  return parsed.result === 'ok' ? parsed.value : null
}

const writeProject = async (
  table: EntityTable<ProjectRecord, 'id'>,
  project: AppProject,
  touchUpdatedAt = true,
): Promise<AppProject> => {
  const normalized = normalizeProject(project)
  if (touchUpdatedAt) normalized.updatedAt = nowIso()
  await database.transaction('rw', table, database.assets, async () => {
    await table.put(toRecord(normalized))
    await database.assets.where('projectId').equals(normalized.id).delete()
    await database.assets.bulkPut(normalized.assets
      .filter((asset): asset is AppAsset & { dataUrl: string } => Boolean(asset.dataUrl))
      .map((asset) => ({ key: assetKey(normalized.id, asset.id), projectId: normalized.id, assetId: asset.id, blob: dataUrlToBlob(asset.dataUrl) })))
  })
  return normalized
}

const removeProjectAssets = async (projectId: string): Promise<void> => {
  await database.assets.where('projectId').equals(projectId).delete()
}

const migrateLegacyStorage = async (): Promise<void> => {
  if (typeof localStorage === 'undefined' || localStorage.getItem(LEGACY_MIGRATION_KEY) === 'complete') return
  const decode = (key: string): AppProject[] => {
    const stored = localStorage.getItem(key)
    if (!stored) return []
    try {
      const decoded: unknown = JSON.parse(stored)
      return Array.isArray(decoded) ? safeParseRows(decoded) : []
    } catch { return [] }
  }
  const active = decode(PROJECTS_STORAGE_KEY)
  const deleted = decode(DELETED_PROJECTS_STORAGE_KEY)
  try {
    await database.transaction('rw', database.projects, database.deletedProjects, database.assets, async () => {
      for (const project of active) await writeProject(database.projects, project, false)
      for (const project of deleted) await writeProject(database.deletedProjects, project, false)
    })
    localStorage.removeItem(PROJECTS_STORAGE_KEY)
    localStorage.removeItem(DELETED_PROJECTS_STORAGE_KEY)
    localStorage.setItem(LEGACY_MIGRATION_KEY, 'complete')
  } catch (error) { throw storageError(error) }
}

const ready = async (): Promise<void> => {
  await database.open()
  await migrateLegacyStorage()
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) void navigator.storage.persist().catch(() => false)
}

export const clearRepository = async (): Promise<void> => {
  await database.close()
  await Dexie.delete(DATABASE_NAME)
  await database.open()
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(PROJECTS_STORAGE_KEY)
    localStorage.removeItem(DELETED_PROJECTS_STORAGE_KEY)
    localStorage.removeItem(LEGACY_MIGRATION_KEY)
  }
}

const list = async (table: EntityTable<ProjectRecord, 'id'>): Promise<AppProject[]> => {
  await ready()
  const hydrated = await Promise.all((await table.toArray()).map(hydrateRecord))
  return hydrated.filter((project): project is AppProject => project !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export const listProjects = async (): Promise<AppProject[]> => list(database.projects)
export const listDeletedProjects = async (): Promise<AppProject[]> => list(database.deletedProjects)

export const findStorageState = async (): Promise<StorageState> => {
  const [projects, deletedProjects] = await Promise.all([listProjects(), listDeletedProjects()])
  return { projects, deletedProjects }
}

export const getProject = async (projectId: string): Promise<AppProject> => {
  await ready()
  const record = await database.projects.get(projectId)
  const project = record ? await hydrateRecord(record) : null
  if (!project) throw new Error('Project not found')
  return project
}

export const saveProject = async (project: AppProject): Promise<AppProject> => {
  await ready()
  try { return await writeProject(database.projects, project) } catch (error) { throw storageError(error) }
}

export const createProject = async (name: string, scope: ProjectScope): Promise<AppProject> => saveProject(createDefaultProject(name, scope))

export const moveProjectToRecycleBin = async (projectId: string): Promise<boolean> => {
  await ready()
  try {
    return await database.transaction('rw', database.projects, database.deletedProjects, async () => {
      const record = await database.projects.get(projectId)
      if (!record) return false
      await database.deletedProjects.put(record)
      await database.projects.delete(projectId)
      return true
    })
  } catch (error) { throw storageError(error) }
}

/** Removes a recycled project and its Blob-backed local asset records. */
export const permanentlyDeleteProject = async (projectId: string): Promise<boolean> => {
  await ready()
  try {
    return await database.transaction('rw', database.deletedProjects, database.assets, async () => {
      if (!await database.deletedProjects.get(projectId)) return false
      await database.deletedProjects.delete(projectId)
      await removeProjectAssets(projectId)
      return true
    })
  } catch (error) { throw storageError(error) }
}

/** @deprecated Use moveProjectToRecycleBin so retention is explicit. */
export const deleteProject = moveProjectToRecycleBin

export const restoreProject = async (projectId: string): Promise<AppProject> => {
  await ready()
  try {
    const record = await database.transaction('rw', database.projects, database.deletedProjects, async () => {
      const recycled = await database.deletedProjects.get(projectId)
      if (!recycled) return null
      await database.projects.put(recycled)
      await database.deletedProjects.delete(projectId)
      return recycled
    })
    if (!record) return getProject(projectId)
    const hydrated = await hydrateRecord(record)
    if (!hydrated) throw new Error('Project not found')
    return hydrated
  } catch (error) { throw storageError(error) }
}

export const updateProject = async (
  projectId: string,
  update: AppProject | ((project: AppProject) => AppProject),
): Promise<AppProject> => {
  const current = await getProject(projectId)
  const next = typeof update === 'function' ? update(current) : update
  return saveProject({ ...next, id: projectId })
}

export const updateBlock = async (
  projectId: string,
  pageId: string,
  blockId: string,
  mutate: (block: AppBlock) => AppBlock,
): Promise<AppProject> => {
  return updateProject(projectId, (project) => {
    const nextPages = project.pages.map((page) => {
      if (page.id !== pageId) {
        return page
      }
      return {
        ...page,
        blocks: page.blocks.map((block) => (block.id === blockId ? mutate(block) : block)),
      }
    })
    return {
      ...project,
      pages: nextPages,
      blocksCount: nextPages.reduce((sum, page) => sum + page.blocks.length, 0),
    }
  })
}

export const addAssetToProject = async (projectId: string, asset: AppAsset): Promise<AppProject> => {
  const normalized = assetSchema.parse(asset)
  return updateProject(projectId, (project) => {
    if (project.assets.some((existing) => existing.id === normalized.id)) {
      return project
    }
    return {
      ...project,
      assets: [...project.assets, normalized],
      blocksCount: project.blocksCount,
    }
  })
}

export const removeAssetFromProject = async (projectId: string, assetId: string): Promise<AppProject> => {
  return updateProject(projectId, (project) => {
    const nextAssets = project.assets.filter((asset) => asset.id !== assetId)
    const nextPages = project.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => {
        if (block.type === 'gallery') return { ...block, images: block.images.filter((id) => id !== assetId) }
        if (block.type === 'hero' && block.mediaId === assetId) return { ...block, mediaId: undefined }
        return block
      }),
    }))
    return {
      ...project,
      assets: nextAssets,
      pages: nextPages,
      blocksCount: nextPages.reduce((sum, page) => sum + page.blocks.length, 0),
    }
  })
}

export const removeBlock = async (
  projectId: string,
  pageId: string,
  blockId: string,
): Promise<AppProject> => {
  return updateProject(projectId, (project) => {
    const nextPages = project.pages.map((page) => {
      if (page.id !== pageId) {
        return page
      }
      const filtered = page.blocks.filter((block) => block.id !== blockId)
      if (filtered.length === 0) {
        return page
      }
      return { ...page, blocks: filtered }
    })

    return {
      ...project,
      pages: nextPages,
      blocksCount: nextPages.reduce((sum, page) => sum + page.blocks.length, 0),
    }
  })
}

export const addBlockToPage = async (projectId: string, pageId: string, type: BlockType): Promise<AppProject> => {
  const template = blockTemplateForType(type)
  return updateProject(projectId, (project) => {
    const nextPages = project.pages.map((page) => {
      if (page.id !== pageId) {
        return page
      }
      return {
        ...page,
        blocks: [...page.blocks, template],
      }
    })
    return {
      ...project,
      pages: nextPages,
      blocksCount: nextPages.reduce((sum, page) => sum + page.blocks.length, 0),
    }
  })
}

export const moveBlock = async (
  projectId: string,
  pageId: string,
  blockId: string,
  direction: -1 | 1,
): Promise<AppProject> => {
  return updateProject(projectId, (project) => {
    const nextPages = project.pages.map((page) => {
      if (page.id !== pageId) {
        return page
      }
      const index = page.blocks.findIndex((block) => block.id === blockId)
      if (index < 0) {
        return page
      }

      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= page.blocks.length) {
        return page
      }

      const updated = [...page.blocks]
      const [moved] = updated.splice(index, 1)
      updated.splice(nextIndex, 0, moved)
      return { ...page, blocks: updated }
    })

    return {
      ...project,
      pages: nextPages,
      blocksCount: nextPages.reduce((sum, page) => sum + page.blocks.length, 0),
    }
  })
}

export const setConsent = async (projectId: string, consent: ConsentReceipt | null): Promise<AppProject> => {
  return updateProject(projectId, (project) => {
    const provider = consent?.provider ?? 'seedance-prompt-v1'
    const next = (project.consents ?? []).filter((item) => item.provider !== provider)
    if (consent) {
      next.push(consent)
    } else {
      const existing = (project.consents ?? []).find((item) => item.provider === provider)
      if (existing) next.push({ ...existing, revokedAt: nowIso() })
    }
    return { ...project, consents: next }
  })
}

export const toJson = (project: AppProject): string => JSON.stringify(project)

export const parseJson = (input: string): ParseResult<AppProject> => {
  try {
    const parsed = JSON.parse(input)
    return parseProject(parsed)
  } catch {
    return { result: 'error', value: { schemaVersion: SCHEMA_VERSION } as AppProject, errors: ['Invalid JSON'] }
  }
}
