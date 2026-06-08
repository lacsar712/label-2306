function buildPaginationQuery(page = 1, pageSize = 20) {
  const p = parseInt(page) || 1;
  const ps = parseInt(pageSize) || 20;
  return {
    skip: (p - 1) * ps,
    take: ps,
    page: p,
    pageSize: ps,
  };
}

function buildPaginationResult(list, total, page, pageSize) {
  return {
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

function buildFilterQuery(filters, fieldMappings) {
  const where = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;

    const mapping = fieldMappings[key];
    if (!mapping) continue;

    if (typeof mapping === 'string') {
      where[mapping] = value;
    } else if (typeof mapping === 'function') {
      const result = mapping(value, where);
      if (result && typeof result === 'object') {
        Object.assign(where, result);
      }
    } else if (typeof mapping === 'object') {
      const { field, transform, operator = 'equals' } = mapping;
      const transformedValue = transform ? transform(value) : value;
      if (operator === 'contains') {
        where[field] = { contains: transformedValue };
      } else if (operator === 'equals') {
        where[field] = transformedValue;
      } else if (operator === 'in') {
        where[field] = { in: transformedValue };
      } else if (operator === 'gte') {
        where[field] = { gte: transformedValue };
      } else if (operator === 'lte') {
        where[field] = { lte: transformedValue };
      }
    }
  }

  return where;
}

module.exports = {
  buildPaginationQuery,
  buildPaginationResult,
  buildFilterQuery,
};
