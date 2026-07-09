import type { Meta, StoryObj } from '@storybook/react'
import { Wrench } from 'lucide-react'
import { KanbanBoard, KanbanColumn, KanbanCard, IconChip } from './Kanban'

const meta: Meta<typeof KanbanBoard> = {
  component: KanbanBoard,
  parameters: { layout: 'padded' },
}
export default meta
type Story = StoryObj<typeof KanbanBoard>

export const Pipeline: Story = {
  render: () => (
    <KanbanBoard>
      <KanbanColumn title="Requested" tone="accent" count={2}>
        <KanbanCard
          id="#1042"
          title="Onboarding call"
          meta="Today 14:30 · Ana"
          dotTone="brand"
          avatarName="Marina Souza"
          urgent
        />
        <KanbanCard
          id="#1043"
          title="Contract review"
          meta="Today 16:00 · Bruno"
          dotTone="warning"
          avatarName="Carla Dias"
        />
      </KanbanColumn>

      <KanbanColumn title="In progress" count={1}>
        <KanbanCard
          id="#1039"
          title="Account setup"
          meta="In progress · Julia"
          dotTone="info"
          lead={
            <IconChip tone="brand" size="sm">
              <Wrench />
            </IconChip>
          }
        />
      </KanbanColumn>

      <KanbanColumn title="Done" count={0} emptyLabel="Nothing done yet" />
    </KanbanBoard>
  ),
}

export const SingleCard: Story = {
  render: () => (
    <div className="max-w-xs">
      <KanbanCard
        id="#1042"
        title="Onboarding call"
        meta="Today 14:30 · Ana"
        dotTone="success"
        avatarName="Marina Souza"
      />
    </div>
  ),
}
