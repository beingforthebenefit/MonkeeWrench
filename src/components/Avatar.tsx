/**
 * A member's photo, or their initial in a circle when they have none. No
 * hooks, so it renders in server components too.
 */
export default function Avatar({
  name,
  src,
  size = 32,
  className = '',
}: {
  name: string
  src: string | null | undefined
  size?: number
  className?: string
}) {
  const style = {width: size, height: size}
  if (src)
    return (
      // A 256px image already; next/image would only add a resize round trip
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={style}
        className={`shrink-0 rounded-full bg-line object-cover ${className}`}
      />
    )
  return (
    <span
      aria-hidden="true"
      style={{...style, fontSize: Math.round(size * 0.42)}}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-line-2 font-bold uppercase text-text ${className}`}
    >
      {name.trim().charAt(0) || '?'}
    </span>
  )
}
