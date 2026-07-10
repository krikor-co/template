import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Tiny back-arrow link rendered above pages that have a parent route in the
 * flow diagram. Pages always pass a typed `route.exits.<parent>(...)` href —
 * never raw URL strings.
 *
 * `className` overrides the default `mb-4` margin — useful when composing
 * BackLink alongside other navigation affordances (e.g. inside
 * `<ContextualBackLink>`).
 */
export function BackLink(props: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={props.href}
      className={
        (props.className ?? 'mb-4') +
        ' group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
      }
    >
      <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-0.5" />
      <span>{props.label}</span>
    </Link>
  )
}
