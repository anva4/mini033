export function normalizeRouteParam(param: string | string[] | undefined): string | undefined {
  if (param === undefined || param === null) return undefined;
  return Array.isArray(param) ? param[0] : param;
}
