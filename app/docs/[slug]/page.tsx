import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getAllDocs, getDocBySlug } from '@/lib/docs'

export function generateStaticParams() {
  return getAllDocs().map((doc) => ({ slug: doc.slug }))
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection()
  const { slug } = await params

  try {
    const { contentHtml } = await getDocBySlug(slug)

    return (
      // eslint-disable-next-line react-hooks/error-boundaries -- getDocBySlug resolves before this returns; the try/catch guards the awaited fetch (→ notFound), not JSX render errors
      <article
        className="prose prose-neutral dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    )
  } catch {
    notFound()
  }
}
