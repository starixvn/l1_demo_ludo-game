# Replay Data Mapping: game-states-*.json ↔ initialGameData.json

## Overview
This document explains the mapping between the `board` field in game-states JSON files and the `bases` structure in `initialGameData.json`.

## Player Index to Base Mapping

| game-states-*.json | initialGameData.json | Color |
|-------------------|---------------------|-------|
| `board["0"]`      | `bases[0]` → `BASE_1` | YELLOW |
| `board["1"]`      | `bases[2]` → `BASE_3` | BLUE   |
| `board["2"]`      | `bases[3]` → `BASE_4` | RED    |
| `board["3"]`      | `bases[1]` → `BASE_2` | GREEN  |

## Horse Array Mapping

Each `board[playerIndex]` is an array of 4 numbers representing the positions of the 4 horses for that player.

### Array Index to Horse ID Mapping

| Array Index | Horse ID in initialGameData.json |
|------------|--------------------------------|
| `0`        | `BASE_X_HORSE_1` (first horse) |
| `1`        | `BASE_X_HORSE_2` (second horse) |
| `2`        | `BASE_X_HORSE_3` (third horse) |
| `3`        | `BASE_X_HORSE_4` (fourth horse) |

### Position Value Meaning

| Value | Meaning | Example |
|-------|---------|---------|
| `0`   | Horse is in base (not spawned) | `[0, 0, 0, 0]` = all 4 horses in base |
| `> 0` | Cell index where horse is located | `[17, 0, 0, 0]` = first horse at cell index 17 |

## Example Mappings

### Example 1: All horses in base (game-states-0.json)
```json
{
  "board": {
    "0": [0, 0, 0, 0],  // BASE_1 (YELLOW): all 4 horses in base
    "1": [0, 0, 0, 0],  // BASE_3 (BLUE): all 4 horses in base
    "2": [0, 0, 0, 0],  // BASE_4 (RED): all 4 horses in base
    "3": [0, 0, 0, 0]   // BASE_2 (GREEN): all 4 horses in base
  }
}
```

**Mapping:**
- `board["0"][0] = 0` → `BASE_1_HORSE_1` is in base (not spawned)
- `board["0"][1] = 0` → `BASE_1_HORSE_2` is in base (not spawned)
- `board["0"][2] = 0` → `BASE_1_HORSE_3` is in base (not spawned)
- `board["0"][3] = 0` → `BASE_1_HORSE_4` is in base (not spawned)

### Example 2: Some horses spawned (game-states-10.json)
```json
{
  "board": {
    "0": [0, 0, 0, 0],    // BASE_1 (YELLOW): all in base
    "1": [34, 0, 0, 0],   // BASE_3 (BLUE): first horse at index 34
    "2": [29, 0, 0, 0],   // BASE_4 (RED): first horse at index 29
    "3": [0, 0, 0, 0]     // BASE_2 (GREEN): all in base
  }
}
```

**Mapping:**
- `board["1"][0] = 34` → `BASE_3_HORSE_1` (BLUE) is at cell with `index: 34`
  - Looking up in `initialGameData.json`: cell with `index: 34` is `SOUTH_1_2` (position: SOUTH, cellID: SOUTH_1_2)
- `board["2"][0] = 29` → `BASE_4_HORSE_1` (RED) is at cell with `index: 29`
  - Looking up in `initialGameData.json`: cell with `index: 29` is `SOUTH_6_2` (position: SOUTH, cellID: SOUTH_6_2)

### Example 3: Multiple horses spawned (game-states-50.json)
```json
{
  "board": {
    "0": [17, 0, 0, 0],   // BASE_1 (YELLOW): first horse at index 17
    "1": [157, 0, 0, 0],  // BASE_3 (BLUE): first horse at index 157
    "2": [260, 0, 0, 0],  // BASE_4 (RED): first horse at index 260
    "3": [19, 0, 0, 0]    // BASE_2 (GREEN): first horse at index 19
  }
}
```

**Mapping:**
- `board["0"][0] = 17` → `BASE_1_HORSE_1` (YELLOW) at cell index 17 = `WEST_2_5`
- `board["1"][0] = 157` → `BASE_3_HORSE_1` (BLUE) at cell index 157 = `WEST_1_1` (HOMEPATH)
- `board["2"][0] = 260` → `BASE_4_HORSE_1` (RED) at cell index 260 = `SOUTH_2_1` (HOMEPATH)
- `board["3"][0] = 19` → `BASE_2_HORSE_1` (GREEN) at cell index 19 = `WEST_2_4`

## Cell Index Lookup

To find which cell a position value refers to:

1. Search `initialGameData.json` → `cells` → `[position]` → `[cellID]` → `index`
2. Match the `index` value with the position value from `board[playerIndex][horseIndex]`

### Example Lookup:
- `board["1"][0] = 34`
- Search for `index: 34` in `initialGameData.json`
- Found: `cells.SOUTH.SOUTH_1_2.index = 34`
- Result: `BASE_3_HORSE_1` (BLUE) is at cell `SOUTH_1_2` in position `SOUTH`

## Complete Mapping Structure

```
game-states-*.json                    initialGameData.json
─────────────────                     ────────────────────
board                                 bases
├─ "0" (player index)                 ├─ BASE_1 (YELLOW) - bases[0]
│  ├─ [0] → horse 1 position         │  ├─ horseIDs[0] = BASE_1_HORSE_1
│  ├─ [1] → horse 2 position         │  ├─ horseIDs[1] = BASE_1_HORSE_2
│  ├─ [2] → horse 3 position         │  ├─ horseIDs[2] = BASE_1_HORSE_3
│  └─ [3] → horse 4 position         │  └─ horseIDs[3] = BASE_1_HORSE_4
│                                     │
├─ "1" (player index)                 ├─ BASE_3 (BLUE) - bases[2]
│  ├─ [0] → horse 1 position         │  ├─ horseIDs[0] = BASE_3_HORSE_1
│  ├─ [1] → horse 2 position         │  ├─ horseIDs[1] = BASE_3_HORSE_2
│  ├─ [2] → horse 3 position         │  ├─ horseIDs[2] = BASE_3_HORSE_3
│  └─ [3] → horse 4 position         │  └─ horseIDs[3] = BASE_3_HORSE_4
│                                     │
├─ "2" (player index)                 ├─ BASE_4 (RED) - bases[3]
│  ├─ [0] → horse 1 position         │  ├─ horseIDs[0] = BASE_4_HORSE_1
│  ├─ [1] → horse 2 position         │  ├─ horseIDs[1] = BASE_4_HORSE_2
│  ├─ [2] → horse 3 position         │  ├─ horseIDs[2] = BASE_4_HORSE_3
│  └─ [3] → horse 4 position         │  └─ horseIDs[3] = BASE_4_HORSE_4
│                                     │
└─ "3" (player index)                 └─ BASE_2 (GREEN) - bases[1]
   ├─ [0] → horse 1 position            ├─ horseIDs[0] = BASE_2_HORSE_1
   ├─ [1] → horse 2 position            ├─ horseIDs[1] = BASE_2_HORSE_2
   ├─ [2] → horse 3 position            ├─ horseIDs[2] = BASE_2_HORSE_3
   └─ [3] → horse 4 position            └─ horseIDs[3] = BASE_2_HORSE_4
```

## Position Value to Cell Mapping

When `board[playerIndex][horseIndex] > 0`, it represents a cell index. To find the actual cell:

1. The value is the `index` property in `initialGameData.json` → `cells[position][cellID].index`
2. Example: `board["1"][0] = 34` means find the cell where `index === 34`
3. Result: `cells.SOUTH.SOUTH_1_2.index = 34`
4. So `BASE_3_HORSE_1` (BLUE) is at cell `SOUTH_1_2` in position `SOUTH`

## Summary

- **Player Mapping**: 
  - `board["0"]` → `BASE_1` (YELLOW) - bases[0]
  - `board["1"]` → `BASE_3` (BLUE) - bases[2]
  - `board["2"]` → `BASE_4` (RED) - bases[3]
  - `board["3"]` → `BASE_2` (GREEN) - bases[1]
- **Horse Mapping**: `board[playerIndex][0-3]` → `BASE_X_HORSE_1-4`
- **Position Mapping**: 
  - `0` = horse in base (not spawned)
  - `> 0` = cell index where horse is located (matches `cells[position][cellID].index`)

