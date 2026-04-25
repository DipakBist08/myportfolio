import { MetadataRoute } from 'next'
import { getAllPostsMeta } from '@/lib/blog/mdx'
import { getAllTags, getAllCategories, slugify } from '@/lib/blog/utils'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blog.dipakbist.com.np'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPostsMeta()
  const tags = getAllTags(posts)
  const categories = getAllCategories(posts)

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt ?? post.date),
    changeFrequency: 'monthly',
    priority: post.featured ? 0.9 : 0.8,
  }))

  const tagEntries: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: `${BASE_URL}/blog/tag/${slugify(tag)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  const categoryEntries: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${BASE_URL}/blog/category/${slugify(cat)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...postEntries,
    ...tagEntries,
    ...categoryEntries,
  ]
}
