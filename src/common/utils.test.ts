/**
 * Test cases for utility functions
 */

import { mapByProperty, flatArray, shuffleArray } from './utils';

describe('Utils', () => {
  describe('mapByProperty', () => {
    it('should map array of objects by property', () => {
      const array = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
        { id: '3', name: 'Charlie' },
      ];
      const result = mapByProperty(array, 'id');
      expect(result).toEqual({
        '1': { id: '1', name: 'Alice' },
        '2': { id: '2', name: 'Bob' },
        '3': { id: '3', name: 'Charlie' },
      });
    });
  });

  describe('flatArray', () => {
    it('should flatten nested arrays', () => {
      const nested = [[1, 2], [3, 4], [5, 6]];
      const result = flatArray(nested);
      expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should handle empty arrays', () => {
      const empty: number[][] = [];
      const result = flatArray(empty);
      expect(result).toEqual([]);
    });
  });

  describe('shuffleArray', () => {
    it('should return array with same length', () => {
      const array = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(array);
      expect(shuffled.length).toBe(array.length);
    });

    it('should contain all original elements', () => {
      const array = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray([...array]);
      expect(shuffled.sort()).toEqual(array.sort());
    });
  });
});

