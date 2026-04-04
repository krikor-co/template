import type { Preview } from '@storybook/react'
import React from 'react'
import '../app/globals.css'
import { ShellDecorator, type ShellType } from '../lib/storybook/shell-decorator'

const preview: Preview = {
  parameters: {
    nextjs: { appDirectory: true },
  },
  globalTypes: {
    shell: {
      name: 'Shell',
      description: 'Wrap section in a presentation shell',
      toolbar: {
        icon: 'component',
        items: [
          { value: 'none',         title: 'No Shell' },
          { value: 'fullpage',     title: 'FullPage' },
          { value: 'card',         title: 'Card' },
          { value: 'modal',        title: 'Modal' },
          { value: 'drawer-right', title: 'Drawer (right)' },
          { value: 'drawer-left',  title: 'Drawer (left)' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    shell: 'none',
  },
  decorators: [
    (Story, context) => {
      if (!context.parameters.shell) return <Story />

      const shell = (context.globals.shell ?? 'none') as ShellType
      return (
        <ShellDecorator shell={shell}>
          <Story />
        </ShellDecorator>
      )
    },
  ],
}

export default preview
