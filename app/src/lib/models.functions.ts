/** Re-exports for existing imports — prefer catalog vs usage modules for new code. */
export {
  fetchModelBySlug,
  fetchModelsCatalog,
} from '#/lib/models-catalog.functions'
export { fetchRecentlyUsedModels } from '#/lib/models-usage.functions'
