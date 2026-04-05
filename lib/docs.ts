import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypePrettyCode from 'rehype-pretty-code'

const docsDir = path.join(process.cwd(), 'docs')

export type DocMeta = {
  slug: string
  title: string
  order: number
  category: string
}

export function getAllDocs(): DocMeta[] {
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'))

  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(docsDir, file), 'utf-8')
      const { data } = matter(raw)
      return {
        slug: file.replace(/\.md$/, ''),
        title: data.title ?? file.replace(/\.md$/, ''),
        order: data.order ?? 99,
        category: data.category ?? 'Other',
      }
    })
    .sort((a, b) => a.order - b.order)
}

const categoryOrder = ['Guide', 'Core', 'Patterns', 'Infrastructure', 'Principles']

export function getCategories(): Map<string, DocMeta[]> {
  const docs = getAllDocs()
  const grouped = new Map<string, DocMeta[]>()

  for (const cat of categoryOrder) {
    const items = docs.filter((d) => d.category === cat)
    if (items.length > 0) grouped.set(cat, items)
  }

  // Catch any categories not in the predefined order
  for (const doc of docs) {
    if (!categoryOrder.includes(doc.category)) {
      const existing = grouped.get(doc.category) ?? []
      existing.push(doc)
      grouped.set(doc.category, existing)
    }
  }

  return grouped
}

export async function getDocBySlug(slug: string) {
  const filePath = path.join(docsDir, `${slug}.md`)
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypePrettyCode, {
      theme: { dark: 'github-dark', light: 'github-light' },
    })
    .use(rehypeStringify)
    .process(content)

  return {
    meta: {
      slug,
      title: data.title ?? slug,
      order: data.order ?? 99,
      category: data.category ?? 'Other',
    },
    contentHtml: result.toString(),
  }
}
