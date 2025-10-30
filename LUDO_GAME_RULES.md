# Ludo Game Rules & Mechanics

## 🎮 Game Overview

Ludo is a classic board game where 2-4 players compete to be the first to move all their pieces from the starting base to the home position. This implementation includes both manual and automatic gameplay modes.

## 🎯 Objective

Be the first player to move all 4 of your coins from your base to your home position.

## 🎲 Players & Setup

### Players

- **2-4 players** can play simultaneously
- Each player has a **colored base** and **4 coins/pieces**
- Player colors: Red, Blue, Green, Yellow

### Initial Setup

- Each player starts with all 4 coins in their base
- Coins are "retired" and cannot move until spawned onto the board
- The game begins with player selection (2, 3, or 4 players)

## 🎯 Game Rules

### 1. Turn Structure

1. **Roll the Die**: Each player's turn begins with rolling a 6-sided die
2. **Spawn Coins**: If you roll a **6**, you can spawn a coin from your base onto the board
3. **Move Coins**: Move your spawned coins along the walkway
4. **Special Actions**: Handle any special cell effects or coin captures
5. **End Turn**: Turn passes to the next player

### 2. Coin Spawning (Getting Out of Base)

- **Requirement**: Must roll a **6** on the die
- **Action**: Move one coin from your base to your starting position on the board
- **Bonus**: After spawning, you get **another turn** to roll again
- **Limit**: You can have multiple coins spawned simultaneously

### 3. Coin Movement

- **Die Roll**: The number shown on the die determines how many spaces to move
- **Direction**: All coins move clockwise around the board
- **Path**: Each player has their own colored walkway path to home
- **Exact Moves**: You must land exactly on the home position (no overshooting)

### 4. Special Cells

#### Star Cells (⭐)

- **Bonus Move**: Landing on a star gives you an extra turn
- **Effect**: Roll the die again immediately after landing on a star
- **Strategic**: Stars provide additional movement opportunities

#### Spawn Cells

- **Starting Point**: Where coins first enter the board after spawning
- **Color-Coded**: Each player has their own spawn cell in their base color

#### Home Path Cells

- **Final Stretch**: Special path leading to the home position
- **Safety**: Coins on the home path cannot be captured by opponents
- **Color-Coded**: Each player has their own colored home path

### 5. Coin Captures (Sending Back to Base)

- **Landing Rule**: If your coin lands on a space occupied by an opponent's coin, you **capture** it
- **Effect**: The opponent's coin is sent back to their base and becomes "retired"
- **Requirement**: Capturing coin must be from the same player who just moved
- **Multiple Coins**: If multiple opponent coins occupy the same space, only one can be captured per move

### 6. Reaching Home (Winning)

- **Home Position**: The final square in each player's home path
- **Requirement**: Coin must land exactly on the home position
- **Completion**: Once a coin reaches home, it is "retired" and safe
- **Victory**: First player to get all 4 coins home wins the game

## 🎮 Advanced Rules & Mechanics

### Auto-Play Mode

The game includes automatic actions for faster gameplay:

- **Timeout**: If a player doesn't make a move within the configured time limit (default: 200ms), the game automatically chooses an action
- **Smart Selection**: The game prioritizes spawning coins when possible, otherwise selects movable coins
- **Random Choice**: When multiple options exist, the game randomly selects one

### Turn Progression

- **Forced Spawning**: If you roll a 6 and have coins in your base, you must spawn one
- **Bonus Turns**: Rolling a 6 or landing on a star gives you an extra turn
- **Skip Turns**: If you have no legal moves, your turn is skipped

### Game End Conditions

- **Winner Declaration**: Game ends immediately when one player gets all coins home
- **No Draws**: Only one winner per game
- **Completion Check**: Player must have all 4 coins retired in home position

## 🎨 Board Layout

### Walkway Structure

- **Central Path**: Main circular path where all coins travel
- **Home Paths**: Individual colored paths leading to each player's home
- **Star Positions**: Special bonus squares marked with stars
- **Base Areas**: Colored starting areas for each player's coins

### Cell Types

1. **Normal Cells**: Standard movement squares
2. **Star Cells**: Bonus turn squares (⭐)
3. **Spawn Cells**: Where coins enter the board
4. **Home Path Cells**: Safe path to home position

## 🔧 Technical Implementation Notes

### State Management

- **Redux Store**: Central state management for game data
- **Real-time Updates**: All game state changes are immediately reflected in UI
- **Persistent State**: Game state is maintained throughout the session

### Auto-Play Configuration

- **Enabled/Disabled**: Auto-play can be toggled on/off
- **Timeout Settings**: Configurable delay before auto-actions trigger
- **Smart Logic**: Game makes logical choices based on available moves

### Development Tools

- **Board Editor**: Right-click cells to change their type during development
- **Cell Linking**: Define movement connections between cells
- **Debug Logging**: Comprehensive action logging for game analysis

## 📊 Scoring & Statistics

### Game Metrics Tracked

- **Moves Made**: Total number of coin movements
- **Dice Rolls**: History of all die rolls
- **Captures**: Number of opponent coins sent back to base
- **Turns Taken**: Total turns elapsed
- **Auto-Actions**: Number of automatic moves made

### Log Categories

- **Dice Rolls**: "Rolled X"
- **Coin Movement**: "Player moved coin X Y spaces"
- **Captures**: "Player captured opponent's coin"
- **Auto Actions**: "Automatically chose to spawn/move"
- **Game Events**: "Player won the game"

## 🚀 Game Modes

### Manual Mode

- Full player control over all decisions
- No time limits
- Complete strategic control

### Auto-Play Mode

- Accelerated gameplay
- Computer makes decisions when players are slow
- Good for watching AI play or quick games

### Development Mode

- Board editing capabilities
- Cell type modification
- Path connection tools

## 🎯 Strategy Tips

### Early Game

- **Focus on Spawning**: Get multiple coins onto the board quickly
- **Position Advantage**: Try to block opponent paths when possible
- **Star Hunting**: Position coins to land on stars for bonus turns

### Mid Game

- **Coin Protection**: Keep coins spaced out to avoid captures
- **Path Blocking**: Use your coins to block opponents' progress
- **Home Path Focus**: Once coins are near home, prioritize getting them safely to the finish

### End Game

- **Exact Movement**: Plan moves carefully to land exactly on home
- **Coin Spacing**: Keep coins spread out to protect against final captures
- **Victory Focus**: Prioritize getting remaining coins home over capturing opponents

## 🔍 Common Scenarios

### No Legal Moves

- **Situation**: Player rolls but has no valid moves
- **Result**: Turn is skipped, passes to next player
- **Common When**: All coins are blocked or no coins are spawned

### Multiple Capture Opportunities

- **Situation**: Die roll allows landing on multiple opponent spaces
- **Rule**: Only one coin can be captured per move
- **Strategy**: Choose which opponent coin to eliminate strategically

### Star Bonus Chain

- **Situation**: Landing on star, then rolling another 6
- **Result**: Can spawn AND get another turn
- **Advantage**: Maximum movement potential in one turn

---

_This game rules documentation is derived from the actual Ludo game implementation codebase. The rules reflect the programmed game mechanics and may include features specific to this digital version._
