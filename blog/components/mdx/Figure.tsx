import Image from 'next/image'

interface FigureProps {
  src: string
  alt: string
  caption?: string
  width?: number
  height?: number
}

export default function Figure({ src, alt, caption, width = 1200, height = 630 }: FigureProps) {
  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-xl border border-line">
        <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 1280px) 76ch, 100vw" className="h-auto w-full object-cover" />
      </div>
      {caption && <figcaption className="mono-label mt-2 text-center">{caption}</figcaption>}
    </figure>
  )
}
