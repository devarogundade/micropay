/**
 * Built-in Algorand TypeScript templates for the IDE gallery.
 * Selecting a template seeds a fresh multi-file project.
 */

export type IdeTemplate = {
  id: string
  name: string
  description: string
  /** Project display name */
  projectName: string
  files: Array<{ path: string; content: string }>
  activePath: string
}

const HELLO = `import { Contract } from '@algorandfoundation/algorand-typescript'

/**
 * Hello World — minimal Algorand TypeScript application.
 */
export class HelloWorld extends Contract {
  createApplication(): void {}

  hello(name: string): string {
    return 'Hello, ' + name
  }
}
`

const COUNTER = `import {
  Contract,
  GlobalState,
  uint64,
} from '@algorandfoundation/algorand-typescript'

/**
 * On-chain counter with GlobalState.
 */
export class Counter extends Contract {
  count = GlobalState<uint64>({ key: 'count', initialValue: 0 })

  createApplication(): void {}

  increment(): uint64 {
    this.count.value = this.count.value + 1
    return this.count.value
  }

  decrement(): uint64 {
    this.count.value = this.count.value - 1
    return this.count.value
  }

  getCount(): uint64 {
    return this.count.value
  }
}
`

const ASA = `import {
  Contract,
  GlobalState,
  uint64,
} from '@algorandfoundation/algorand-typescript'

/**
 * Simple ASA-oriented app skeleton.
 * Stores an asset id in global state — ask the IDE agent to add
 * an asset-create inner transaction for a full mint flow.
 */
export class SimpleAsset extends Contract {
  assetId = GlobalState<uint64>({ key: 'asset', initialValue: 0 })

  createApplication(): void {}

  /** Record an existing ASA id managed by this application. */
  setAssetId(id: uint64): void {
    this.assetId.value = id
  }

  getAssetId(): uint64 {
    return this.assetId.value
  }
}
`

export const IDE_TEMPLATES: IdeTemplate[] = [
  {
    id: 'hello',
    name: 'Hello / simple app',
    description: 'Minimal Contract with a hello(name) method.',
    projectName: 'hello-world',
    files: [{ path: 'HelloWorld.algo.ts', content: HELLO }],
    activePath: 'HelloWorld.algo.ts',
  },
  {
    id: 'counter',
    name: 'Counter',
    description: 'GlobalState counter with increment / decrement.',
    projectName: 'counter',
    files: [{ path: 'Counter.algo.ts', content: COUNTER }],
    activePath: 'Counter.algo.ts',
  },
  {
    id: 'asa',
    name: 'ASA / simple asset',
    description: 'Create a basic Algorand Standard Asset from an app.',
    projectName: 'simple-asset',
    files: [{ path: 'SimpleAsset.algo.ts', content: ASA }],
    activePath: 'SimpleAsset.algo.ts',
  },
]

export function templateToProjectFiles(template: IdeTemplate) {
  return template.files.map((f) => ({
    path: f.path,
    kind: 'file' as const,
    content: f.content,
  }))
}
