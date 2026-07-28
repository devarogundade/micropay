/** Default Algorand TypeScript (puya-ts) contract shown in the IDE. */
export const STARTER_FILENAME = 'contract.algo.ts'

export const STARTER_CONTRACT = `import { Contract } from '@algorandfoundation/algorand-typescript'

/**
 * Minimal Algorand TypeScript application (compiled by puya-ts).
 * Ask the IDE agent to add methods, state, or prepare for deploy.
 */
export class App extends Contract {
  createApplication(): void {}

  /**
   * Example NoOp method — replace with your application logic.
   */
  hello(name: string): string {
    return 'Hello, ' + name
  }
}
`
