/**
 * Player Container Component
 *
 * Represents a single player's interface in the Ludo game.
 * Shows the player's avatar, dice (when active), and retired coins that have reached home.
 * Handles player-specific UI state like active/inactive status and positioning.
 */

import classnames from 'classnames';                             // Utility for conditional CSS classes
import React from 'react';
import { connect } from 'react-redux';                    // Redux connection
import { createStructuredSelector } from 'reselect';      // Optimized state selection

import { Coin } from 'containers/Base/components/Coin';   // Coin component for retired coins
import { Dice } from 'containers/Dice/Container';         // Dice component for the player
import { IBase } from 'containers/Ludo/state/interfaces'; // Base data types
import { basesSelector, coinsSelector } from 'containers/Ludo/state/selectors'; // State selectors
import { PlayerAvatar } from './components/PlayerAvatar'; // Player avatar component

import styles from './Container.module.css';              // Component styles

/**
 * Public props for the Player component
 */
interface IPublicProps {
  /** Unique identifier for the player's base */
  baseID: IBase['ID'];
  /** Position on screen (top or bottom of the game board) */
  placement: 'top' | 'bottom';
  /** Whether this player is currently disabled (not their turn) */
  disabled: boolean;
}

/**
 * Props from Redux state
 */
interface IStateProps {
  bases: ReturnType<typeof basesSelector>;   // All player bases
  coins: ReturnType<typeof coinsSelector>;   // All coins in the game
}

/** Combined component props */
interface IProps extends IStateProps, IPublicProps {}

/**
 * Maps Redux state to component props using reselect
 */
const mapStateToProps = createStructuredSelector<any, IStateProps>({
  bases: basesSelector,    // Get all player bases
  coins: coinsSelector,    // Get all coins
});

/**
 * Player container component class
 * Renders the player interface including avatar, dice, and retired coins
 */
class PlayerBare extends React.PureComponent<IProps> {
  /**
   * Renders the player interface
   * Only renders if the player's base exists and is enabled
   */
  render() {
    const { baseID, bases, placement, disabled } = this.props;

    // Determine CSS classes based on placement and disabled state
    const placementClass = placement === 'top' ? styles.TopPlacement : styles.BottomPlacement;
    const disabledClass = disabled ? styles.Disabled : null;

    // Get the player's base data
    const base = bases[baseID];

    // Only render if base exists and is enabled
    return base && base.enabled
    ? (
      <div className={classnames(styles.Container, placementClass, disabledClass)}>
        {/* Player avatar showing their color */}
        <PlayerAvatar baseColor={base.color}/>

        {/* Dice component - only shown when player is active (not disabled) */}
        {
          !disabled && <Dice baseColor={base.color}/>
        }

        {/* Container for coins that have reached home (retired) */}
        <div className={styles.RetiredCoins}>
        {
          // Filter and display only retired coins for this player
          base.coinIDs
          .filter((coinID) => this.props.coins[coinID].isRetired)
          .map((coin, index) => (
            <Coin
              baseColor={base.color}        // Use player's color
              onCoinClicked={() => null}   // Retired coins are not clickable
              key={index}
            />
          ))
        }
        </div>
      </div>
    )
    : null; // Don't render disabled/inactive players
  }
}

/**
 * Connected Player component with Redux state
 * Exports the component with proper TypeScript typing
 */
export const Player = connect(mapStateToProps)(PlayerBare) as unknown as React.ComponentClass<IPublicProps>;
