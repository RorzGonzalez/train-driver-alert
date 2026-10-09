import { expect, it } from 'vitest';
import { countFromText } from '../src/adapters/gwr.js';

it('reads the GWR entry count in both wordings', () => {
  expect(countFromText(' Displaying 1 entry ')).toBe(1);
  expect(countFromText(' Displaying all 5 entries ')).toBe(5);
  expect(countFromText('')).toBeNull();
});
