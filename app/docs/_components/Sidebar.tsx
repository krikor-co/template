import Link from 'next/link'
import { getCategories } from '@/lib/docs'

export function Sidebar({ currentSlug }: { currentSlug?: string }) {
  const categories = getCategories()

  return (
    <nav className="space-y-5">
      {Array.from(categories).map(([category, docs]) => (
        <div key={category}>
          <h3 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {category}
          </h3>
          <ul className="space-y-0.5">
            {docs.map((doc) => (
              <li key={doc.slug}>
                <Link
                  href={`/docs/${doc.slug}`}
                  className={`block rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                    currentSlug === doc.slug
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
