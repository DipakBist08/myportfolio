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
    <figure className="my-6">
      <div className="overflow-hidden rounded-xl border border-slate-700/50">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="w-full object-cover"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-slate-500 light:text-slate-400">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
