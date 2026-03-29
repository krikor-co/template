import type { StorybookConfig } from '@storybook/nextjs'
import path from 'path'
import { fileURLToPath } from 'url'
import webpack from 'webpack'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const config: StorybookConfig = {
  stories: [
    '../app/**/*.stories.tsx',
    '../components/**/*.stories.tsx',
    '../lib/shell.stories.tsx',
  ],
  // In Storybook 10, essentials (controls, actions, docs, viewport, etc.) are built
  // into the framework — no separate addon packages needed.
  addons: [],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  webpackFinal: async (config) => {
    // Replace all actions.ts files with a no-op stub so server-only modules
    // (Resend, pg, drizzle) never execute in the browser build.
    config.plugins = config.plugins ?? []
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /[/\\]actions\.ts$/,
        path.resolve(__dirname, '__mocks__/server-actions.ts')
      )
    )

    // Stub Node.js built-ins so any remaining server-only imports resolve cleanly.
    config.resolve = config.resolve ?? {}
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net:         false,
      tls:         false,
      fs:          false,
      dns:         false,
      crypto:      false,
      stream:      false,
      path:        false,
      os:          false,
      http:        false,
      https:       false,
      'pg-native': false,
    }
    return config
  },
}

export default config
