/**
 * Main Application Entry Point
 *
 * This file bootstraps the React application and connects it to the Redux store.
 * It's the starting point for the entire Ludo game application.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import { Ludo } from 'containers/Ludo/Container';  // Main Ludo game component
import { store } from 'state/store';                // Redux store with all game state

import './prototypeOverrides';                      // Custom prototype modifications

import * as serviceWorker from './serviceWorker';   // Service worker for PWA features

import './index.css';                               // Global CSS styles

/**
 * Render the React application to the DOM
 * Wraps the app with Redux Provider to make store available to all components
 * Uses StrictMode for development warnings and future React features
 */
ReactDOM.render(
  <Provider store={store}>
    <React.StrictMode>
      <Ludo />                                    {/* Main Ludo game component */}
    </React.StrictMode>
  </Provider>,
  document.getElementById('root'),                // Mount point in index.html
);

// Service Worker Registration
// Note: Service workers enable PWA features like offline functionality
// Currently unregistered - change to register() to enable offline features
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
