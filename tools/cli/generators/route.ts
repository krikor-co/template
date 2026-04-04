import * as path from 'path'
import { writeFile, toRoutePath } from '../fs'

export async function generateRoute(target: string): Promise<void> {
  if (target.includes('_components')) {
    console.error('Error: Routes cannot be inside _components/. Routes live at the page level (e.g. app/bookings/list).')
    process.exit(1)
  }

  const dir = target
  const routePath = toRoutePath(target)

  console.log(`\nGenerating route: ${routePath}\n`)

  writeFile(
    path.join(dir, 'entry.ts'),
    `import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

const schema = z.object({})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (_p: Params = {} as Params) => '${routePath}',
  parse: (_ctx: ParseContext) => ({} as Params),
}
`,
  )

  writeFile(
    path.join(dir, 'contract.ts'),
    `import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'

export const route = createRoute({
  entry,
  exits: {},
})
`,
  )

  writeFile(
    path.join(dir, 'page.tsx'),
    `import { Shell } from '@/lib/shell'
// import { route } from './contract'

type Props = {
  params:       Promise<Record<string, string>>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ searchParams }: Props) {
  // const sp = await searchParams
  // const entry = route.entry.parse({ params: {}, searchParams: sp, cookies: {} })

  return (
    <Shell.FullPage>
      <p>TODO</p>
    </Shell.FullPage>
  )
}
`,
  )

  writeFile(
    path.join(dir, 'layout.tsx'),
    `export default async function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
`,
  )

  console.log('\nDone. Next steps:')
  console.log('  1. Define entry params in entry.ts')
  console.log('  2. Wire exits in contract.ts')
  console.log('  3. Add guard logic in layout.tsx if needed')
  console.log('  4. Run: flow g section ' + path.join(dir, '_components/YourSection'))
}
