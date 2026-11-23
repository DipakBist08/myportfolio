export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

/** What kind of article it is, shown to readers so they can tell a tutorial from an opinion,
 *  an experiment or a write-up of real project experience (QA-blog SEO brief, 19/11/2026, Phase 7). */
export const ARTICLE_TYPES = ['Tutorial', 'Opinion', 'Experiment', 'Project experience'] as const
export type ArticleType = (typeof ARTICLE_TYPES)[number]

export type Category =
  | 'QA Fundamentals'
  | 'Manual Testing'
  | 'Automation Testing'
  | 'API Testing'
  | 'Bug Reporting'
  | 'Test Planning'
  | 'QA Career'
  | 'Python'
  | 'Web Development'
  | 'CI/CD'
  | 'Git & GitHub'
  | 'Tools & Tips'
  | 'AI Lab'
  | 'Playwright'
  | 'SaaS Testing'
  | 'BDD'
  | 'Performance Testing'

export interface FaqItem {
  q: string
  a: string
}

/**
 * Front matter as written in content/blog/*.mdx.
 *
 * Dates: new posts use `datePublished` / `dateModified`; the older `date` /
 * `updatedAt` names are still accepted. lib/blog/mdx.ts normalises both into
 * `date` and `updatedAt`, which is what the rest of the code reads.
 * The full standard is in docs/POST_TEMPLATE.md and enforced by scripts/seo-lint.mjs.
 */
export interface PostFrontmatter {
  title: string
  description: string
  date: string
  updatedAt?: string
  datePublished?: string
  dateModified?: string
  slug: string
  primaryQuery?: string
  secondaryQueries?: string[]
  /** Cluster slug from lib/blog/clusters.ts. */
  cluster?: string
  isPillar?: boolean
  /** Tool versions the code was run against, e.g. "Playwright for Python 1.49, Python 3.12". */
  testedWith?: string
  faq?: FaqItem[]
  tags: string[]
  category: Category
  coverImage?: string
  author: string
  readingTime?: string
  excerpt: string
  featured?: boolean
  draft?: boolean
  difficulty?: Difficulty
  articleType?: ArticleType
  tools?: string[]
  keywords?: string[]
}

export interface Post extends PostFrontmatter {
  content: string
  readingTime: string
}

export interface PostMeta extends PostFrontmatter {
  readingTime: string
  /** Where the post comes from: a file in content/blog, or the CMS. */
  source?: 'file' | 'cms'
  /** How the body is written: MDX (files, Markdown CMS posts) or HTML (rich-text CMS posts). */
  format?: 'mdx' | 'html'
  /** The CMS's SEO title, when it differs from the headline. */
  seoTitle?: string
}

export interface GroupedByTag {
  [tag: string]: PostMeta[]
}

export interface GroupedByCategory {
  [category: string]: PostMeta[]
}

export interface PaginatedPosts {
  posts: PostMeta[]
  total: number
  currentPage: number
  totalPages: number
}

export interface SearchParams {
  q?: string
  tag?: string
  category?: string
  page?: string
  featured?: string
}
