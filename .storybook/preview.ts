import type { Preview } from '@storybook/react'
import '../app/globals.css'

const preview: Preview = {
  parameters: {
    nextjs: { appDirectory: true },
  },
}

export default preview
