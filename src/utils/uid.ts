/** Random id. crypto.randomUUID only exists on https pages, so fall back for local-network testing. */
export const uid = () =>
  crypto.randomUUID?.() ??
  [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
