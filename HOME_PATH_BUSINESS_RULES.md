# Home Path Business Rules

## Conditions for a Horse to Enter Home Path

### 1. **Prerequisites (Basic Requirements)**

A horse must meet ALL of the following basic conditions:

- ✅ **Horse must be spawned**: `horse.isSpawned === true`
  - Unspawned horses (still in base) cannot enter home path
- ✅ **Horse must not be retired**: `horse.isRetired === false`
  - Retired horses (already reached HOME) cannot move
- ✅ **Horse must not overshoot home**: `horse.steps + stepsToMove <= WINNING_MOVES` (62)
  - If moving would exceed 62 total steps, the horse cannot move (would overshoot HOME)

### 2. **Home Path Entry Rules**

#### Rule 2.1: Base ID Matching (CRITICAL)

- ✅ **Horse can ONLY enter home path cells that match its own baseID**
  - `horse.baseID === cellData.baseID`
  - A horse from BASE_1 (Blue) can ONLY enter home path cells belonging to BASE_1
  - A horse CANNOT enter home path cells belonging to other bases (BASE_2, BASE_3, BASE_4)

#### Rule 2.2: Cell Type Validation

- ✅ **Target cell must be of type `CellType.HOMEPATH`**
  - Only cells marked as HOMEPATH can be entered as home path
  - Normal cells, spawn cells, and other cell types are not home path

#### Rule 2.3: Path Selection Priority (When Multiple Options Available)

When a horse has multiple next cell options:

**Priority 0: HOME Cell**

- If `cellID === 'HOME'` is available → Always choose HOME (final destination)

**Priority 1: Matching Home Path (Can Jump to Any Cell)**

- If multiple home path cells match the horse's `baseID` → Choose the one closest to HOME (furthest along)
- **Horses can jump directly to any home path cell** (e.g., cell 3 or 4), not just the first one
- **No sequential requirement** - horses don't need to enter at cell 1 and move sequentially
- Movement depends on dice result and available paths in the links structure

**Priority 2: Non-Home-Path Cells**

- If no matching home path is available → Choose non-home-path cells (continue on outer path)
- Prevents entering wrong base's home path

**Priority 3: Validation Failure**

- If only option is another base's home path → **Move fails** (cannot enter)

### 3. **Movement Validation During Path Traversal**

#### Rule 3.1: Step-by-Step Validation

- At each step of movement, the system validates:
  1. Next cell exists and has valid cell data
  2. If next cell is HOMEPATH type → Must match horse's baseID
  3. If next cell is HOME → Always allowed (final destination)

#### Rule 3.2: Blocking Prevention

- If the only available path would lead to another base's home path → Movement is blocked
- The move fails with `moveHorseFailure()` and turn passes

### 5. **Special Cases**

#### Case 4.1: Single Option Available

- If only one next cell is available:
  - If it's HOME → Always allowed
  - If it's HOMEPATH → Must match horse's baseID, otherwise move fails
  - If it's normal cell → Allowed

#### Case 4.2: Multiple Options with Mixed Types

- If options include:
  - HOME cell → Choose HOME
  - Matching home path → Choose matching home path
  - Non-matching home path → Ignore (cannot enter)
  - Normal cells → Choose if no matching home path available

### 6. **Code Implementation Locations**

#### Validation Points:

1. **`moveHorseSaga` (src/containers/Ludo/state/sagas.ts:398-512)**

   - Validates at each step during movement
   - Filters out invalid home path cells
   - Prevents entering wrong base's home path

2. **`isValidNextCell` (src/containers/Ludo/state/sagas.ts:1046-1101)**

   - Used during cell exploration for highlighting
   - Returns `false` for other players' home paths
   - Only allows home paths matching horse's baseID

3. **`canReachHome` (src/containers/Dice/state/sagas.ts:149-240)**
   - Checks if horse can reach HOME or HOMEPATH
   - Only considers matching home paths
   - Used for action labels and descriptions

### 7. **Examples**

#### ✅ Valid: Blue Horse Entering Blue Home Path

```
Horse: BASE_1 (Blue)
Current Position: WEST_0_6 (outer path)
Next Options:
  - WEST_1_0 (HOMEPATH, baseID=BASE_1) ✅ ALLOWED
  - WEST_0_5 (NORMAL) ✅ ALLOWED
Result: Can enter WEST_1_0 (matching home path)
```

#### ❌ Invalid: Blue Horse Trying to Enter Yellow Home Path

```
Horse: BASE_1 (Blue)
Current Position: EAST_1_6 (outer path)
Next Options:
  - EAST_1_5 (HOMEPATH, baseID=BASE_4) ❌ BLOCKED
  - EAST_2_6 (NORMAL) ✅ ALLOWED
Result: Must choose EAST_2_6, cannot enter EAST_1_5
```

#### ✅ Valid: Horse Reaching HOME

```
Horse: BASE_1 (Blue)
Current Position: WEST_1_6 (last home path cell)
Next Options:
  - HOME ✅ ALLOWED (always)
Result: Can reach HOME
```

### 8. **Summary Checklist**

A horse can enter home path if:

- [x] Horse is spawned (`isSpawned === true`)
- [x] Horse is not retired (`isRetired === false`)
- [x] Move won't overshoot home (`steps + stepsToMove <= 62`)
- [x] Target cell is HOMEPATH type
- [x] Target cell's `baseID` matches horse's `baseID`
- [x] **Target cell is reachable within the step count** (can jump directly to any home path cell, not just first one)
- [x] No blocking horses prevent the move
- [x] Path is available in the links structure (allows jumping to any reachable home path cell)

A horse CANNOT enter home path if:

- [ ] Target cell is another base's home path (`baseID` mismatch)
- [ ] Horse is not spawned
- [ ] Horse is retired
- [ ] Move would overshoot home
- [ ] Blocking horse prevents access
