#!/usr/bin/env npx tsx

import { generateRoute } from './generators/route'
import { generateSection } from './generators/section'
import { prompt } from './prompt'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'generate' || command === 'g') {
    const type = args[1]
    const target = args[2]

    if (!type || !target) {
      console.error('Usage: flow generate <route|section> <path> [flags]')
      process.exit(1)
    }

    switch (type) {
      case 'route':
        await generateRoute(target)
        break

      case 'section': {
        const flags = new Set(args.slice(3))
        const hasFlags = flags.size > 0

        let client = flags.has('--client')
        let fetches = flags.has('--fetches')
        let mutates = flags.has('--mutates')

        if (!hasFlags) {
          client = await prompt('Client section? (needs interactivity, state machine)', false)
          fetches = await prompt('Does it fetch data?', false)
          mutates = await prompt('Does it mutate data?', false)
        }

        await generateSection(target, { client, fetches, mutates })
        break
      }

      default:
        console.error(`Unknown generator: ${type}. Available: route, section`)
        process.exit(1)
    }
  } else {
    console.error('Usage: flow <generate|g> <route|section> <path> [flags]')
    process.exit(1)
  }
}

main()
