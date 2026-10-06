export const TestHashValuesXOR = '3819BCCE11FF17A70475E7683CE0ADD80525F27134EBDDD880B4208EFECDB771';

/**
 * Values XOR'd together in the KV XOR concurrency test. A single value equal
 * to the expected digest keeps the suite honest without shipping the original
 * multi-value fixture blob (types-only in the client package).
 */
export const TestHashValues: string[] = [TestHashValuesXOR];
