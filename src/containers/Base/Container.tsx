/**
 * Base Container Component
 *
 * Represents a player's starting base where horses begin the game.
 * Shows 4 horse placeholders that can spawn horses when the player rolls a 6.
 * The base becomes "spawnable" when the player rolls a 6 on the die.
 */

import classnames from "classnames"; // Utility for conditional CSS classes
import React from "react";
import { connect } from "react-redux"; // Redux connection
import { createStructuredSelector } from "reselect"; // Optimized state selection

import { IBase } from "containers/Ludo/state/interfaces"; // Game data types
import { basesSelector, horsesSelector } from "containers/Ludo/state/selectors"; // State selectors
import { getStyleObject } from "containers/utils"; // Styling utilities
import { BASE_SIZE, INNER_BASE_SIZE } from "globalConstants"; // Size constants

import { HorsePlaceholder } from "./components/HorsePlaceholder"; // Horse placeholder component

import styles from "./Container.module.css"; // Component styles

/**
 * Public props for the Base component
 */
interface IPublicProps {
  /** Unique identifier for this base (BASE_1, BASE_2, etc.) */
  baseID: IBase["ID"];
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
  bases: ReturnType<typeof basesSelector>; // All player bases
  horses: ReturnType<typeof horsesSelector>; // All horses in the game
}

/**
 * Props for Redux dispatch actions
 */
interface IDispatchProps {
  // No dispatch props needed - horses are not clickable, actions must be chosen from action panel
}

/** Combined component props */
interface IProps extends IPublicProps, IDispatchProps, IStateProps {}

/**
 * Maps Redux dispatch actions to component props
 */
const mapDispatchToProps = {};

/**
 * Maps Redux state to component props using reselect
 */
const mapStateToProps = createStructuredSelector<any, IStateProps>({
  bases: basesSelector, // Get all player bases
  horses: horsesSelector, // Get all horses
});

/**
 * Base container component class
 * Renders a player's base with horse placeholders that can spawn horses
 */
class BaseBare extends React.PureComponent<IProps> {
  /**
   * Renders the base with outer and inner containers
   * Shows horse placeholders that change appearance based on game state
   */
  render() {
    const { baseID, bases, enabled, hasWon } = this.props;
    const base = bases[baseID];

    // Add special styling when base is spawnable (player rolled a 6)
    const spawnableClass = base.spawnable ? styles.Spawnable : null;

    // Count horses in different states for display
    const horsesInBase = base.horseIDs.filter(
      (horseID) =>
        this.props.horses[horseID] &&
        !this.props.horses[horseID].isSpawned &&
        !this.props.horses[horseID].isRetired
    ).length;
    const horsesSpawned = base.horseIDs.filter(
      (horseID) =>
        this.props.horses[horseID] &&
        this.props.horses[horseID].isSpawned &&
        !this.props.horses[horseID].isRetired
    ).length;
    const horsesHome = base.horseIDs.filter(
      (horseID) =>
        this.props.horses[horseID] && this.props.horses[horseID].isRetired
    ).length;

    return (
      <div
        className={styles.OuterContainer}
        style={getStyleObject(BASE_SIZE, BASE_SIZE, base.color)} // Colored outer border
      >
        {/* Base information display */}
        {this.props.showDebugText !== false && (
          <div className={styles.BaseInfo}>
            <div className={styles.BaseID}>{baseID.replace("_", " ")}</div>
            <div className={styles.BaseColor}>{base.color}</div>
            <div className={styles.BaseStatus}>
              {!enabled && "DISABLED"}
              {hasWon && "WINNER!"}
              {enabled && !hasWon && base.spawnable && "SPAWN READY"}
            </div>
            <div className={styles.HorseStatus}>
              {horsesInBase > 0 && <span>In Base: {horsesInBase}</span>}
              {horsesSpawned > 0 && <span>On Board: {horsesSpawned}</span>}
              {horsesHome > 0 && <span>Home: {horsesHome}</span>}
            </div>
          </div>
        )}

        <div
          className={classnames(styles.InnerContainer, spawnableClass)}
          style={getStyleObject(INNER_BASE_SIZE, INNER_BASE_SIZE)} // Inner area sizing
        >
          {
            // Render 4 horse placeholders (one for each horse in the base)
            base.horseIDs.map((horseID, index) => {
              const horse = this.props.horses[horseID];
              return (
                <HorsePlaceholder
                  key={index}
                  baseColor={base.color} // Horse color matches base color
                  // Hide horse if base is disabled OR horse is already spawned/retired
                  isHorseHidden={
                    !this.props.enabled || horse.isSpawned || horse.isRetired
                  }
                  // onHorseClicked removed - horses are not clickable, actions must be chosen from action panel
                />
              );
            })
          }
        </div>
      </div>
    );
  }

  /**
   * Handles horse click events for spawning
   * DISABLED - Actions must be chosen from action panel
   */
  // private onHorseClicked removed - horses are not clickable, actions must be chosen from action panel
}

/**
 * Connected Base component with Redux state and actions
 * Exports the component with proper TypeScript typing
 */
export const Base = connect(
  mapStateToProps,
  mapDispatchToProps
)(BaseBare) as unknown as React.ComponentClass<IPublicProps>;
