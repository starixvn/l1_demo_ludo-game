import React from 'react';

import { ContextMenu as ContextMenuComponent } from './components/ContextMenu';
import { useContextMenuSelectors } from './store';

interface IProps {}

class ContextMenuBare extends React.PureComponent<IProps> {
  render() {
    const { menuContents, position, visible } = useContextMenuSelectors();
    return visible
    ? (
      <ContextMenuComponent
        menuContents={menuContents}
        position={position}
      />
    )
    : null;
  }
}

export const ContextMenu = ContextMenuBare;
