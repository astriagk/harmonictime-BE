export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  // Soft-deleted resources (e.g. archived blog posts) answer 410 so old links
  // can say "removed" instead of "never existed".
  GONE: 410,
  INTERNAL_SERVER_ERROR: 500,
} as const;
