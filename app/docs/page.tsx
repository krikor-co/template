import { redirect } from 'next/navigation'
import { getAllDocs } from '@/lib/docs'

export default function DocsPage() {
  const docs = getAllDocs()
  const first = docs[0]
  if (first) redirect(`/docs/${first.slug}`)
  return <p>No docs found.</p>
}
