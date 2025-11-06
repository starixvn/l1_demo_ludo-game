# Home Path Business Logic Analysis

## Current Implementation

### Location

File: `src/containers/Ludo/state/sagas.ts`
Function: `moveHorseSaga` (lines 259-266)

### Current Logic

```typescript
// Special logic for entering home path - prefer same-base home path cells
nextCell =
  nextCells.length > 1
    ? nextCells.find(
        (cell) =>
          cells[cell.position][cell.cellID].cellType === CellType.HOMEPATH &&
          horses[horseID].baseID === cells[cell.position][cell.cellID].baseID
      ) || nextCells[0] // ⚠️ FALLBACK TO FIRST OPTION IF NO HOME PATH FOUND
    : nextCells[0]; // Single option available
```

## Business Conditions for Going to HOME

### 1. **Path Entry Logic**

- When multiple next cells are available, the code tries to find a HOMEPATH cell that matches the horse's `baseID`
- If a matching home path is found → horse enters its own home path
- **BUG**: If no matching home path is found, it falls back to `nextCells[0]` (first option)
  - This allows horses to enter other bases' home paths!

### 2. **Movement to HOME**

- A horse can move to HOME if:
  - The next cell in the links array has `cellID === 'HOME'`
  - No validation checks if the horse's baseID matches the home path's baseID before reaching HOME

### 3. **Current Validation Checks**

From `getMovableHorses()` function:

- ✅ Horse must be spawned (`isSpawned === true`)
- ✅ Horse must not be retired (`isRetired === false`)
- ✅ Horse must not overshoot home (`steps + stepsToTake <= WINNING_MOVES`)

**MISSING VALIDATION:**

- ❌ No check to prevent horses from entering other bases' home paths
- ❌ No validation that HOME cell matches horse's baseID

## The Problem

### Issue: Blue Horse Can Reach EAST Home Path

**Path taken by blue horse:**

1. Blue horse spawns at `WEST_0_0` (BASE_1/BLUE)
2. Travels outer path: `WEST_0_0` → `WEST_0_6` → `NORTH_6_0` → ... → `EAST_0_6` → `EAST_1_6`
3. At `EAST_1_6`, it has two options:
   - `EAST_1_5` (HOMEPATH for BASE_4/YELLOW)
   - `EAST_2_6` (outer path)
4. Current logic:
   - Tries to find a home path matching blue's baseID (BASE_1)
   - `EAST_1_5` belongs to BASE_4, so it doesn't match
   - Falls back to `nextCells[0]` which could be `EAST_1_5`
   - Blue horse incorrectly enters yellow's home path → `EAST_1_0` → HOME

### Expected Behavior

**Blue horses should:**

- ✅ Only enter home path at `WEST_1_0` (their own base's home path)
- ✅ Only reach HOME via `WEST_1_6` → HOME
- ❌ NOT be able to enter `EAST_1_5` or any other base's home path

## Recommended Fix

### Option 1: Strict Home Path Validation (Recommended)

```typescript
// Special logic for entering home path - ONLY allow same-base home path cells
if (nextCells.length > 1) {
  // First, try to find a home path cell matching this horse's base
  const matchingHomePath = nextCells.find(
    (cell) =>
      cells[cell.position][cell.cellID].cellType === CellType.HOMEPATH &&
      horses[horseID].baseID === cells[cell.position][cell.cellID].baseID
  );

  if (matchingHomePath) {
    nextCell = matchingHomePath;
  } else {
    // If no matching home path, prefer non-home-path cells
    nextCell =
      nextCells.find(
        (cell) =>
          cells[cell.position][cell.cellID].cellType !== CellType.HOMEPATH
      ) || nextCells[0];
  }
} else {
  // Single option - validate it's not someone else's home path
  const cell = cells[nextCells[0].position][nextCells[0].cellID];
  if (
    cell.cellType === CellType.HOMEPATH &&
    cell.baseID !== horses[horseID].baseID
  ) {
    // Prevent entering other base's home path
    // Handle this case (maybe skip this path or fail the move)
  }
  nextCell = nextCells[0];
}
```

### Option 2: Add Pre-move Validation

Add validation before the movement loop:

```typescript
// Before moving, check if the path would lead to wrong home path
// This could be done by tracing the entire path first
```

### Option 3: Validate at Each Step

At each step, prevent entering a home path cell that doesn't match:

```typescript
// Before selecting nextCell, filter out home paths that don't match baseID
const validNextCells = nextCells.filter((cell) => {
  const cellData = cells[cell.position][cell.cellID];
  if (cellData.cellType === CellType.HOMEPATH) {
    return cellData.baseID === horses[horseID].baseID;
  }
  return true; // Allow all non-home-path cells
});

if (validNextCells.length === 0) {
  // No valid moves - this shouldn't happen but handle gracefully
}
nextCell = validNextCells[0] || nextCells[0];
```

## Summary

**Current State:**

- ❌ Horses can enter other bases' home paths if the find() doesn't match and falls back to first option
- ❌ No validation that HOME cell belongs to the horse's base

**Required Fix:**

- ✅ Only allow horses to enter home path cells that match their baseID
- ✅ Prevent fallback to other bases' home paths
- ✅ Consider validating the entire path before movement, or validate at each step

**Test Case:**

- Blue horse at `EAST_1_6` with options `EAST_1_5` (yellow home path) and `EAST_2_6` (outer path)
- Should only be able to choose `EAST_2_6`, never `EAST_1_5`
