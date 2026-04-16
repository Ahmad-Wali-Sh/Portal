/**
 * queryBuilder.js
 *
 * Parses Express req.query into a Prisma-compatible query object.
 *
 * Supported query params:
 *   Simple search:
 *     ?search=ali                  → OR across all searchFields with contains
 *
 *   Advanced field operators:
 *     ?name_contains=ali
 *     ?age_gte=18
 *     ?age_lte=30
 *     ?age_eq=25
 *     ?created_at_gte=2024-01-01
 *
 *   Ordering:
 *     ?orderBy=created_at:desc
 *     ?orderBy=name:asc
 *
 *   Pagination:
 *     ?page=1&limit=20            (default: page=1, limit=20)
 *     ?limit=0                    → disables pagination (returns all)
 */

const OPERATOR_MAP = {
  contains: 'contains',
  eq: 'equals',
  gte: 'gte',
  lte: 'lte',
  gt: 'gt',
  lt: 'lt',
  not: 'not',
  startsWith: 'startsWith',
  endsWith: 'endsWith',
}

const RESERVED_KEYS = new Set([
  'search', 'page', 'limit', 'orderBy', 'include',
])

/**
 * @param {object} query         - req.query
 * @param {string[]} searchFields - fields to search across for ?search=
 * @returns {{ where, orderBy, skip, take }}
 */
function buildQuery(query, searchFields = []) {
  const where = {}
  const conditions = []

  // ── Simple search ────────────────────────────────────────────────────────
  if (query.search && searchFields.length > 0) {
    conditions.push({
      OR: searchFields.map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      })),
    })
  }

  // ── Advanced field operators ─────────────────────────────────────────────
  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_KEYS.has(key)) continue

    // match pattern: fieldName_operator (e.g. age_gte, name_contains)
    const lastUnderscore = key.lastIndexOf('_')
    if (lastUnderscore === -1) {
      // no operator — treat as exact equals
      conditions.push({ [key]: { equals: castValue(value) } })
      continue
    }

    const field = key.slice(0, lastUnderscore)
    const operatorKey = key.slice(lastUnderscore + 1)
    const prismaOp = OPERATOR_MAP[operatorKey]

    if (!prismaOp) {
      // unknown operator — skip silently
      continue
    }

    const isStringOp = ['contains', 'startsWith', 'endsWith'].includes(operatorKey)

    conditions.push({
      [field]: isStringOp
        ? { [prismaOp]: value, mode: 'insensitive' }
        : { [prismaOp]: castValue(value) },
    })
  }

  if (conditions.length > 0) {
    where.AND = conditions
  }

  // ── OrderBy ──────────────────────────────────────────────────────────────
  let orderBy = { id: 'asc' } // default
  if (query.orderBy) {
    const [field, direction] = query.orderBy.split(':')
    if (field) {
      orderBy = { [field]: direction === 'desc' ? 'desc' : 'asc' }
    }
  }

  // ── Pagination ───────────────────────────────────────────────────────────
  const limit = parseInt(query.limit ?? '20', 10)
  const page = Math.max(1, parseInt(query.page ?? '1', 10))

  const pagination = limit === 0
    ? {} // no pagination — return all
    : { skip: (page - 1) * limit, take: limit }

  return { where, orderBy, ...pagination, _page: page, _limit: limit }
}

/**
 * Casts string query values to appropriate JS types.
 */
function castValue(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  const num = Number(value)
  if (!isNaN(num) && value.trim() !== '') return num
  return value
}

module.exports = { buildQuery }