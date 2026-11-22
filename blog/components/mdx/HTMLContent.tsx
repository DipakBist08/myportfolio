/** A rich-text CMS post body, already sanitised by lib/blog/html.ts. Same
 *  typography wrapper as MDXContent, so both kinds of post look alike. */
export default function HTMLContent({ html }: { html: string }) {
  return (
    <div
      className="prose max-w-none prose-headings:font-heading prose-headings:scroll-mt-20 prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
