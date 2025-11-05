/**
 * Action Selection Container Component
 *
 * Displays available actions (spawn/move coins) for the player to choose from after rolling dice.
 * Shows buttons for each available action with descriptions.
 */

import React from 'react';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';

import { clearAvailableActions, IAvailableAction, spawnCoin } from 'containers/Ludo/state/actions';
import { moveCoin } from 'containers/Ludo/state/actions';
import {
  availableActionsSelector,
  availableActionsDieValueSelector,
  basesSelector,
  coinsSelector,
  currentTurnSelector,
} from 'containers/Ludo/state/selectors';
import { getBaseHexColor } from 'containers/utils';

import styles from './Container.module.css';

/**
 * Props from Redux state
 */
interface IStateProps {
  availableActions: ReturnType<typeof availableActionsSelector>;
  availableActionsDieValue: ReturnType<typeof availableActionsDieValueSelector>;
  bases: ReturnType<typeof basesSelector>;
  coins: ReturnType<typeof coinsSelector>;
  currentTurn: ReturnType<typeof currentTurnSelector>;
}

/**
 * Props for Redux dispatch actions
 */
interface IDispatchProps {
  spawnCoin: typeof spawnCoin;
  moveCoin: typeof moveCoin;
  clearAvailableActions: typeof clearAvailableActions;
}

/**
 * Combined component props
 */
interface IProps extends IStateProps, IDispatchProps {}

/**
 * Maps Redux state to component props
 */
const mapStateToProps = createStructuredSelector<any, IStateProps>({
  availableActions: availableActionsSelector,
  availableActionsDieValue: availableActionsDieValueSelector,
  bases: basesSelector,
  coins: coinsSelector,
  currentTurn: currentTurnSelector,
});

/**
 * Maps Redux dispatch actions to component props
 */
const mapDispatchToProps = {
  spawnCoin,
  moveCoin,
  clearAvailableActions,
};

/**
 * Action Selection component
 * Shows buttons for each available action after dice roll
 */
class ActionSelectionBare extends React.PureComponent<IProps> {
  /**
   * Handles when user clicks on an action button
   */
  private handleActionClick = (action: IAvailableAction) => {
    const { coins, currentTurn, bases } = this.props;

    // Clear the action selection UI
    this.props.clearAvailableActions();

    if (action.type === 'spawn') {
      // Spawn the coin
      this.props.spawnCoin(bases[currentTurn].ID, action.coinID);
    } else if (action.type === 'move') {
      // Move the coin
      const coin = coins[action.coinID];
      this.props.moveCoin(action.coinID, coin.position, coin.cellID);
    } else if (action.type === 'kick') {
      // Kick action: move coin and disqualify blocking coin
      const coin = coins[action.coinID];
      this.props.moveCoin(action.coinID, coin.position, coin.cellID, action.blockingCoinID);
    } else if (action.type === 'move_before') {
      // Move before blocking: move only specified steps
      const coin = coins[action.coinID];
      this.props.moveCoin(action.coinID, coin.position, coin.cellID, undefined, action.stepsBeforeBlocking);
    }
  };

  /**
   * Renders the action selection panel
   */
  render() {
    const { availableActions, availableActionsDieValue, bases, currentTurn } = this.props;

    // Debug logging to help troubleshoot
    if (process.env.NODE_ENV === 'development') {
      console.log('[ActionSelection] Render check:', {
        availableActions,
        availableActionsLength: availableActions?.length,
        availableActionsDieValue,
        currentTurn,
        hasBases: !!bases,
      });
    }

    // Don't render if no actions are available
    if (!availableActions || availableActions.length === 0) {
      return null;
    }

    const currentBase = bases[currentTurn];

    // Don't render if current base doesn't exist or game hasn't started (base not enabled)
    if (!currentBase || !currentBase.enabled) {
      return null;
    }

    return (
      <div className={styles.Sidebar}>
        <div className={styles.Container}>
          <div className={styles.Header}>
            <h3 className={styles.Title}>
              {currentBase.color} Player - Choose settlement action
            </h3>
            <div className={styles.DieValue}>
              Rolled: <span className={styles.DieNumber}>{availableActionsDieValue}</span>
            </div>
          </div>
          <div className={styles.ActionsList}>
            {availableActions.map((action, index) => {
              const coin = this.props.coins[action.coinID];
              const coinBase = coin ? this.props.bases[coin.baseID] : null;
              // Get the base color for the current turn (the base performing the action)
              const baseColor = currentBase.color ? getBaseHexColor(currentBase.color) : null;
              
              return (
                <button
                  key={`${action.type}-${action.coinID}-${index}`}
                  className={`${styles.ActionButton} ${
                    action.type === 'spawn' ? styles.SpawnButton : styles.MoveButton
                  }`}
                  onClick={() => this.handleActionClick(action)}
                >
                  <div 
                    className={styles.ActionLabel}
                    style={baseColor ? { color: baseColor } : undefined}
                  >
                    {action.label}
                  </div>
                  <div className={styles.ActionDetails}>
                    <div className={styles.DetailRow}>
                      <span className={styles.DetailLabel}>Coin ID:</span>
                      <span className={styles.DetailValue}>{action.coinID}</span>
                    </div>
                    {coinBase && (
                      <div className={styles.DetailRow}>
                        <span className={styles.DetailLabel}>Base ID:</span>
                        <span className={styles.DetailValue}>{coinBase.ID}</span>
                      </div>
                    )}
                  </div>
                  {action.description && (
                    <div className={styles.ActionDescription}>{action.description}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Connected ActionSelection component with Redux state and actions
 */
export const ActionSelection = connect(
  mapStateToProps,
  mapDispatchToProps
)(ActionSelectionBare) as unknown as React.ComponentClass<{}>;

