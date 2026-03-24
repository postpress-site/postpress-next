import type { ComponentType } from 'react'
import type { Block } from '../lib/content/types'

interface Props {
  blocks: Block[]
  getBlockComponent: (blockType: string) => ComponentType<{ block: Block }> | null
}

export function BlockRenderer({ blocks, getBlockComponent }: Props) {
  return (
    <>
      {blocks.map((block) => {
        const Component = getBlockComponent(block.blockType)

        if (!Component) {
          if (process.env.NODE_ENV === 'development') {
            return (
              <div
                key={block.id}
                className="p-4 border-2 border-dashed border-amber-400 rounded-lg my-4 text-amber-800 bg-amber-50"
              >
                Missing component for block type: <code className="font-mono">{block.blockType}</code>
              </div>
            )
          }
          return null
        }

        return <Component key={block.id} block={block} />
      })}
    </>
  )
}
