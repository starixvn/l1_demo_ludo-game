/**
 * Common Utility Functions
 *
 * General-purpose utility functions used throughout the application.
 */

/**
 * Converts a hex color string to rgba format with specified opacity
 * @param hex - Hex color string (e.g., "#FF0000" or "FF0000")
 * @param opacity - Opacity value between 0 and 1 (e.g., 0.8 for 80% opacity)
 * @returns RGBA color string (e.g., "rgba(255, 0, 0, 0.8)") or original hex if invalid
 */
export const hexToRgba = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex; // Return original if invalid hex
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

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

/**
 * Game state loading utility interfaces
 */
export interface IGameStateFile {
  gameState: {
    currentTurn: any; // BaseID type (will be validated by caller)
    bases: any[];
    horses: any[];
    cells: any;
    walkways: any[];
    relationships: any[];
    links: any;
  };
  exportedAt?: string;
  statistics?: {
    totalLogs: number;
  };
  logs?: any[];
}

export interface IRestoredGameState {
  currentTurn: any; // BaseID type (will be validated by caller)
  bases: { [key: string]: any };
  horses: { [key: string]: any };
  cells: any;
  walkways: { [key: string]: any };
  relationships: any[];
  links: any;
}

/**
 * Loads a game state from a JSON file
 * Opens a file picker, reads the file, validates and transforms the data
 * @param onSuccess - Callback function called with the restored game state on success
 * @param onError - Callback function called with error message on failure
 */
export const loadGameStateFromFile = (
  onSuccess: (state: IRestoredGameState, metadata: { exportedAt?: string; totalLogs?: number }) => void,
  onError: (message: string) => void
): void => {
  // Create a hidden file input element
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.style.display = "none";

  input.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      document.body.removeChild(input);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string;
        const importedData: IGameStateFile = JSON.parse(fileContent);

        // Check if the file has the expected structure
        if (!importedData.gameState) {
          document.body.removeChild(input);
          onError("Invalid game state file. Missing 'gameState' property.");
          return;
        }

        const { gameState } = importedData;

        // Convert arrays back to dictionaries (since export uses Object.values)
        const restoredState: IRestoredGameState = {
          currentTurn: gameState.currentTurn,
          bases: gameState.bases.reduce((acc: any, base: any) => {
            acc[base.ID] = base;
            return acc;
          }, {}),
          horses: gameState.horses.reduce((acc: any, horse: any) => {
            acc[horse.horseID] = horse;
            return acc;
          }, {}),
          cells: gameState.cells, // Already in correct format
          walkways: gameState.walkways.reduce((acc: any, walkway: any) => {
            acc[walkway.ID] = walkway;
            return acc;
          }, {}),
          relationships: gameState.relationships, // Already an array
          links: gameState.links, // Already in correct format
        };

        const metadata = {
          exportedAt: importedData.exportedAt,
          totalLogs: importedData.statistics?.totalLogs || importedData.logs?.length || 0,
        };

        document.body.removeChild(input);
        onSuccess(restoredState, metadata);
      } catch (error) {
        console.error("Error loading game state:", error);
        document.body.removeChild(input);
        onError(
          "Failed to load game state. The file may be corrupted or in an invalid format."
        );
      }
    };

    reader.onerror = () => {
      document.body.removeChild(input);
      onError("Failed to read the file.");
    };

    reader.readAsText(file);
  };

  input.oncancel = () => {
    if (document.body.contains(input)) {
      document.body.removeChild(input);
    }
  };

  document.body.appendChild(input);
  input.click();
};