/**
 * Media type for HTTP responses that serialize values with `binaryOnly`, so
 * objects that implement `toBytes` become `{ $binary }` instead of JSON.
 *
 * Marked @internal in keetanet-client (stripped from published .d.ts); node-lite
 * keeps the runtime export for LocalNode Accept negotiation and tests.
 */
export const API_BINARY_MEDIA_TYPE = 'application/vnd.keeta.binary+json';
