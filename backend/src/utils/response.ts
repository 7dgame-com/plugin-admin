export function success<T>(data: T) {
  return {
    code: 0,
    message: 'ok',
    data,
  };
}

export function error(code: number, message: string, data?: unknown) {
  void data;
  return {
    code,
    message,
  };
}

export function paginated<T>(items: T[], total: number, page: number, perPage: number) {
  return success({
    items,
    total,
    page,
    per_page: perPage,
  });
}
