import {
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
  FindOptionsWhere,
  FindOptionsOrder,
  ILike,
} from 'typeorm';
import { PaginationQueryDto } from '../dto/pagination.dto';

export type ListQueryResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

/**
 * Apply pagination + sort to a TypeORM repository find.
 * Use `searchFields` for ILike OR across columns when `query.search` is set.
 */
export async function findWithPagination<T extends ObjectLiteral>(
  repo: Repository<T>,
  query: PaginationQueryDto,
  opts?: {
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
    searchFields?: (keyof T & string)[];
    allowedSort?: string[];
    relations?: string[];
  },
): Promise<ListQueryResult<T>> {
  const page = query.page ?? 1;
  const limit = query.take;
  const sortField =
    opts?.allowedSort && query.sort && !opts.allowedSort.includes(query.sort)
      ? opts.allowedSort[0]
      : (query.sort ?? 'createdAt');

  let where = opts?.where;
  if (query.search?.trim() && opts?.searchFields?.length) {
    const term = `%${query.search.trim()}%`;
    const searchWhere = opts.searchFields.map(
      (field) =>
        ({
          [field]: ILike(term),
        }) as FindOptionsWhere<T>,
    );
    if (where && !Array.isArray(where)) {
      where = searchWhere.map((s) => ({ ...where, ...s }));
    } else if (Array.isArray(where)) {
      where = where.flatMap((w) => searchWhere.map((s) => ({ ...w, ...s })));
    } else {
      where = searchWhere;
    }
  }

  const order = {
    [sortField]: query.sortOrder,
  } as FindOptionsOrder<T>;

  const [items, total] = await repo.findAndCount({
    where,
    order,
    skip: query.skip,
    take: limit,
    relations: opts?.relations,
  });

  return { items, total, page, limit };
}

export function applyPaginationToQb<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: PaginationQueryDto,
  alias: string,
  defaultSort = 'createdAt',
): SelectQueryBuilder<T> {
  const sort = query.sort ?? defaultSort;
  qb.orderBy(`${alias}.${sort}`, query.sortOrder)
    .skip(query.skip)
    .take(query.take);
  return qb;
}
