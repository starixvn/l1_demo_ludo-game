/**
 * Main Application Entry Point
 *
 * This file bootstraps the React application with Zustand state management.
 * It's the starting point for the entire Ludo game application.
 */

import React from 'react';
import ReactDOM from 'react-dom';

import { Ludo } from 'containers/Ludo/Container';  // Main Ludo game component

import './prototypeOverrides';                      // Custom prototype modifications

import * as serviceWorker from './serviceWorker';   // Service worker for PWA features

import './index.css';                               // Global CSS styles

/**
 * Render the React application to the DOM
 * Uses StrictMode for development warnings and future React features
 */
ReactDOM.render(
  <React.StrictMode>
    <Ludo />                                    {/* Main Ludo game component */}
  </React.StrictMode>,
  document.getElementById('root'),                // Mount point in index.html
);

// Service Worker Registration
// Note: Service workers enable PWA features like offline functionality
// Currently unregistered - change to register() to enable offline features
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
