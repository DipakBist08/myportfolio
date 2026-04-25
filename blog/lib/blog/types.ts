export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export type Category =
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
  | 'AI & QA'

export interface PostFrontmatter {
  title: string
  description: string
  date: string
  updatedAt?: string
  slug: string
  tags: string[]
  category: Category
  coverImage?: string
  author: string
  readingTime?: string
  excerpt: string
  featured?: boolean
  draft?: boolean
  difficulty?: Difficulty
  tools?: string[]
  keywords?: string[]
}

export interface Post extends PostFrontmatter {
  content: string
  readingTime: string
}

export interface PostMeta extends PostFrontmatter {
  readingTime: string
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
