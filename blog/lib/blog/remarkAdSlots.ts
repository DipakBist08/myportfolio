import { ADS_ENABLED } from '@/lib/ads'

interface MdNode {
  type: string
  depth?: number
  name?: string | null
  children?: MdNode[]
  attributes?: unknown[]
}

/* Blocks that contain code or a copy button. An ad must never sit next to one:
   a reader reaching for "Copy" could click the ad by accident. */
const NO_AD_NEIGHBOURS = new Set(['CodeBlock', 'CommandBlock', 'PromptBlock', 'APIRequest', 'BugReport', 'TestCase'])

const unsafeNeighbour = (node?: MdNode) =>
  !node || node.type === 'code' || (node.type === 'mdxJsxFlowElement' && NO_AD_NEIGHBOURS.has(node.name ?? ''))

const adNode = (position: string): MdNode => ({
  type: 'mdxJsxFlowElement',
  name: 'AdSlot',
  attributes: [{ type: 'mdxJsxAttribute', name: 'position', value: position }],
  children: [],
})

/**
 * Inserts the two in-article ad slots while the MDX is compiled:
 *   - "after-intro": before the first H2, i.e. after the intro and Key takeaways box.
 *   - "mid-article": before the H2 nearest the middle (posts with 4+ H2 sections only).
 * A slot always sits between the end of one section and the next H2. If the
 * block just above that point, or the first block under that H2, is code or
 * has a copy button, the slot moves to the next H2; if none is safe, it is left out.
 * With ads off this plugin does nothing, so no ad markup exists in the page.
 */
export function remarkAdSlots() {
  return (tree: MdNode) => {
    if (!ADS_ENABLED || !tree.children) return

    const kids = tree.children
    const h2s = kids.map((n, i) => (n.type === 'heading' && n.depth === 2 ? i : -1)).filter((i) => i > 0)
    if (h2s.length === 0) return

    // Safe when neither the block above the slot nor the first block of the
    // section below it (after the heading) is code or has a copy button.
    const firstSafe = (from: number) =>
      h2s.slice(from).find((i) => !unsafeNeighbour(kids[i - 1]) && !unsafeNeighbour(kids[i + 1]))

    const afterIntro = firstSafe(0)
    const midStart = Math.max(Math.floor(h2s.length / 2), 2)
    const mid = h2s.length >= 4 ? firstSafe(midStart) : undefined

    // Insert from the bottom up so earlier indexes stay valid.
    if (mid !== undefined && mid !== afterIntro) kids.splice(mid, 0, adNode('mid-article'))
    if (afterIntro !== undefined) kids.splice(afterIntro, 0, adNode('after-intro'))
  }
}
