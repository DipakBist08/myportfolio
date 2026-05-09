// ── Auth ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: number
  email: string
  username: string
  full_name: string
  bio: string
  avatar_url: string
  is_superuser: boolean
  mfa_enabled: boolean
}

export interface TokenResponse {
  access_token: string
  token_type?: string
  requires_mfa?: boolean
  temp_token?: string
  refresh_token?: string
}

// ── Post ─────────────────────────────────────────────────────────────────────

export type PostStatus = 'draft' | 'published' | 'scheduled' | 'archived'

export interface AuthorBrief {
  id: number
  username: string
  full_name: string
  avatar_url: string
}

export interface CategoryBrief {
  id: number
  name: string
  slug: string
  color: string
}

export interface TagBrief {
  id: number
  name: string
  slug: string
  color: string
}

export interface PostListItem {
  id: number
  title: string
  slug: string
  excerpt: string
  featured_image: string
  status: PostStatus
  is_featured: boolean
  reading_time: number
  view_count: number
  published_at: string | null
  scheduled_at: string | null
  created_at: string
  updated_at: string | null
  author: AuthorBrief
  category: CategoryBrief | null
  tags: TagBrief[]
}

export interface PostDetail extends PostListItem {
  content: string
  content_json: string
  seo_title: string
  seo_description: string
  seo_keywords: string
  canonical_url: string
  featured_image_alt: string
}

export interface PaginatedPosts {
  items: PostListItem[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ── Category ─────────────────────────────────────────────────────────────────

export interface Category {
  id: number
  name: string
  slug: string
  description: string
  color: string
  icon: string
  parent_id: number | null
  post_count: number
  created_at: string
}

// ── Tag ───────────────────────────────────────────────────────────────────────

export interface Tag {
  id: number
  name: string
  slug: string
  color: string
  post_count: number
  created_at: string
}

// ── Subscriber ────────────────────────────────────────────────────────────────

export interface Subscriber {
  id: number
  email: string
  name: string
  is_active: boolean
  is_unsubscribed: boolean
  subscribed_at: string
  confirmed_at: string | null
}

export interface SubscriberStats {
  total: number
  active: number
  unsubscribed: number
  pending: number
}

// ── Media ─────────────────────────────────────────────────────────────────────

export interface MediaItem {
  id: number
  filename: string
  original_filename: string
  url: string
  mime_type: string
  file_size: number
  width: number | null
  height: number | null
  alt_text: string
  caption: string
  created_at: string
}

export interface PaginatedMedia {
  items: MediaItem[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_posts: number
  published_posts: number
  draft_posts: number
  total_views: number
  total_subscribers: number
  new_subscribers_30d: number
  total_categories: number
  total_tags: number
  recent_posts: { id: number; title: string; slug: string; views: number }[]
  top_posts: { id: number; title: string; slug: string; views: number }[]
  views_chart: { day: string; views: number }[]
}


// ── Comments ──────────────────────────────────────────────────────────────────

export interface CommentReply {
  id: number
  author_name: string
  content: string
  created_at: string
}

export interface Comment {
  id: number
  post_slug: string
  parent_id: number | null
  author_name: string
  author_email: string
  content: string
  is_approved: boolean
  created_at: string
  replies: CommentReply[]
}
