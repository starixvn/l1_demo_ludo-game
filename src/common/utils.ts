/**
 * Common Utility Functions
 *
 * General-purpose utility functions used throughout the application.
 */

/**
 * Converts an array of objects into a dictionary/map keyed by a property
 * @param array - Array of objects to convert
 * @param property - Property name to use as the key
 * @returns Dictionary with property values as keys and objects as values
 */
export const mapByProperty = <A, P extends keyof A>(array: A[], property: P): { [key: string]: A } => {
  const map: { [key: string]: A } = {};
  array.forEach((obj) => {
    const key = obj[property];
    map[key as any] = obj;
  });
  return map;
};

/**
 * Flattens a nested array structure into a single-level array
 * @param arr - Array containing nested arrays
 * @returns Single-level flattened array
 */
export const flatArray = <T>(arr: T[]) => arr.reduce((acc, val) => acc.concat(val), [] as T[]);

/**
 * Randomly shuffles the elements of an array using Fisher-Yates algorithm
 * @param array - Array to shuffle
 * @returns New array with elements in random order
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  let currentIndex = array.length;
  let temporaryValue;
  let randomIndex;

  // Fisher-Yates shuffle algorithm
  while (0 !== currentIndex) {
    // Pick a remaining element
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // Swap with current element
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
};
