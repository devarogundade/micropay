/**
 * @deprecated Use `#/lib/puya-ts-project` — kept as a thin re-export for any
 * lingering imports during the multi-file IDE migration.
 */

export {
  loadIdeProject as loadIdeState,
  saveIdeProject as saveIdeState,
  snapshotProject as snapshotVersion,
  type IdeProjectState as IdePersistedState,
  type IdeProjectVersion as CodeVersion,
} from '#/lib/puya-ts-project'
