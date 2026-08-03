import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  compile,
  CompileOptions,
  LogLevel,
  LoggingContext,
  processInputPaths,
} from '@algorandfoundation/puya-ts'

const tempRoot = join(process.cwd(), '.puya-tmp')
await mkdir(tempRoot, { recursive: true })
const workDir = await mkdtemp(join(tempRoot, 'prepare-puya-'))
try {
  await writeFile(
    join(workDir, 'Prepare.algo.ts'),
    `import { Contract, GlobalState, uint64 } from '@algorandfoundation/algorand-typescript'
export class Prepare extends Contract {
  value = GlobalState<uint64>()
  createApplication(): void { this.value.value = 0 }
}
`,
  )
  const context = LoggingContext.create()
  await context.run(() =>
    compile(
      new CompileOptions({
        filePaths: processInputPaths({ paths: [workDir], outDir: 'out' }),
        outputTeal: true,
        outputArc32: false,
        outputArc56: false,
        dryRun: false,
        logLevel: LogLevel.Error,
      }),
    ),
  )
  if (context.hasErrors()) {
    const messages = context.logEvents.map((event) => event.message).join('; ')
    throw new Error(`Puya preparation compile failed: ${messages}`)
  }
  console.log('Prepared Puya backend')
} finally {
  await rm(workDir, { recursive: true, force: true })
}
