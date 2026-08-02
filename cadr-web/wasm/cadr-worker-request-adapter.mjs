/* Preserve the caller-owned worker message while entering a frozen strict
 * subhandler.  Validation remains the outer worker's responsibility. */
export function copyRequestForStrictVersion(request, strictVersion) {
  return request.version === strictVersion ? request :
    Object.freeze({ ...request, version: strictVersion });
}
