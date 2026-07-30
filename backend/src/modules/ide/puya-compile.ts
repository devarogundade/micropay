/**
 * Nest wrapper around puya-ts server compile (ported from code/app).
 */
export {
  compilePuyaTsProjectWithPuya as compilePuyaTsProject,
  compilePuyaTsSourceWithPuya,
  type CompileProjectInput,
} from './puya-compile.raw';

export type {
  CompileDiagnostic,
  CompileMethod,
  CompileResult,
} from './puya-structural';
