/**
 * Base Container Component
 *
 * Represents a player's starting base where coins begin the game.
 * Shows 4 coin placeholders that can spawn coins when the player rolls a 6.
 * The base becomes "spawnable" when the player rolls a 6 on the die.
 */

import classnames from 'classnames';                             // Utility for conditional CSS classes
import React from 'react';
import { connect } from 'react-redux';                    // Redux connection
import { createStructuredSelector } from 'reselect';      // Optimized state selection

import { isDieRollValidSelector } from 'containers/Dice/state/selectors'; // Die roll validation
import { spawnCoin } from 'containers/Ludo/state/actions'; // Spawn coin action
import { IBase, ICoin } from 'containers/Ludo/state/interfaces'; // Game data types
import { basesSelector, coinsSelector } from 'containers/Ludo/state/selectors'; // State selectors
import { getStyleObject } from 'containers/utils';        // Styling utilities
import { BASE_SIZE, INNER_BASE_SIZE } from 'globalConstants'; // Size constants

import { CoinPlaceholder } from './components/CoinPlaceholder'; // Coin placeholder component

import styles from './Container.module.css';              // Component styles

/**
 * Public props for the Base component
 */
interface IPublicProps {
  /** Unique identifier for this base (BASE_1, BASE_2, etc.) */
  baseID: IBase['ID'];
  /** Whether this base is enabled/active in the current game */
  enabled: boolean;
  /** Whether the player of this base has won the game */
  hasWon: boolean;
  /** Whether to show debug text (base ID, color, etc.) */
  showDebugText?: boolean;
}

/**
 * Props from Redux state
 */
interface IStateProps {
  bases: ReturnType<typeof basesSelector>;           // All player bases
  coins: ReturnType<typeof coinsSelector>;           // All coins in the game
  isDieRollValid: ReturnType<typeof isDieRollValidSelector>; // Whether die roll can be used
}

/**
 * Props for Redux dispatch actions
 */
interface IDispatchProps {
  spawnCoin: typeof spawnCoin; // Action to spawn a coin from base
}

/** Combined component props */
interface IProps extends IPublicProps, IDispatchProps, IStateProps {}

/**
 * Maps Redux dispatch actions to component props
 */
const mapDispatchToProps = {
  spawnCoin, // Spawn coin action
};

/**
 * Maps Redux state to component props using reselect
 */
const mapStateToProps = createStructuredSelector<any, IStateProps>({
  bases: basesSelector,                     // Get all player bases
  coins: coinsSelector,                     // Get all coins
  isDieRollValid: isDieRollValidSelector,   // Get die roll validity
});

/**
 * Base container component class
 * Renders a player's base with coin placeholders that can spawn coins
 */
class BaseBare extends React.PureComponent<IProps> {
  /**
   * Renders the base with outer and inner containers
   * Shows coin placeholders that change appearance based on game state
   */
  render() {
    const { baseID, bases, enabled, hasWon } = this.props;
    const base = bases[baseID];

    // Add special styling when base is spawnable (player rolled a 6)
    const spawnableClass = base.spawnable ? styles.Spawnable : null;

    // Count coins in different states for display
    const coinsInBase = base.coinIDs.filter(coinID =>
      this.props.coins[coinID] && !this.props.coins[coinID].isSpawned && !this.props.coins[coinID].isRetired
    ).length;
    const coinsSpawned = base.coinIDs.filter(coinID =>
      this.props.coins[coinID] && this.props.coins[coinID].isSpawned && !this.props.coins[coinID].isRetired
    ).length;
    const coinsHome = base.coinIDs.filter(coinID =>
      this.props.coins[coinID] && this.props.coins[coinID].isRetired
    ).length;

    return (
      <div
        className={styles.OuterContainer}
        style={getStyleObject(BASE_SIZE, BASE_SIZE, base.color)} // Colored outer border
      >
        {/* Base information display */}
        {this.props.showDebugText !== false && (
          <div className={styles.BaseInfo}>
            <div className={styles.BaseID}>{baseID.replace('_', ' ')}</div>
            <div className={styles.BaseColor}>{base.color}</div>
            <div className={styles.BaseStatus}>
              {!enabled && 'DISABLED'}
              {hasWon && 'WINNER!'}
              {enabled && !hasWon && base.spawnable && 'SPAWN READY'}
            </div>
            <div className={styles.CoinStatus}>
              {coinsInBase > 0 && <span>In Base: {coinsInBase}</span>}
              {coinsSpawned > 0 && <span>On Board: {coinsSpawned}</span>}
              {coinsHome > 0 && <span>Home: {coinsHome}</span>}
            </div>
          </div>
        )}

        <div
          className={classnames(styles.InnerContainer, spawnableClass)}
          style={getStyleObject(INNER_BASE_SIZE, INNER_BASE_SIZE)} // Inner area sizing
        >
          {
            // Render 4 coin placeholders (one for each coin in the base)
            base.coinIDs.map((coinID, index) => {
              const coin = this.props.coins[coinID];
              return (
                <CoinPlaceholder
                  key={index}
                  baseColor={base.color} // Coin color matches base color
                  // Hide coin if base is disabled OR coin is already spawned/retired
                  isCoinHidden={!this.props.enabled || (coin.isSpawned || coin.isRetired)}
                  // onCoinClicked removed - coins are not clickable, actions must be chosen from action panel
                />
              );
            })
          }
        </div>
      </div>
    );
  }

  /**
   * Handles coin click events for spawning
   * DISABLED - Actions must be chosen from action panel
   */
  // private onCoinClicked removed - coins are not clickable, actions must be chosen from action panel
}

/**
 * Connected Base component with Redux state and actions
 * Exports the component with proper TypeScript typing
 */
export const Base = connect(mapStateToProps, mapDispatchToProps)(BaseBare) as unknown as React.ComponentClass<IPublicProps>;
