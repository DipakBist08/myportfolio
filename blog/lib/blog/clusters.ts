import type { Category } from './types'
import data from './clusters.json'

/**
 * Topic clusters. Each cluster has one pillar post that links to every spoke,
 * and every spoke links back to the pillar. The cluster's category page is its
 * hub, so new posts in a cluster use that category.
 *
 * The data lives in clusters.json so scripts/seo-lint.mjs can read the same
 * list. `pillarSlug` is the planned slug of the pillar: until that post is
 * published the lint only warns about a missing pillar link; once it is, a
 * spoke without a link to it fails the build. See docs/POST_TEMPLATE.md.
 */
export interface Cluster {
  slug: string
  name: string
  category: Category
  pillarSlug: string
  /** Shown at the top of the cluster's category hub page. */
  intro: string
}

export const CLUSTERS = data as Cluster[]

export const getCluster = (slug?: string) => CLUSTERS.find((c) => c.slug === slug)
