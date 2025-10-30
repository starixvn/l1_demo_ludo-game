/**
 * HTTP Client Utilities
 *
 * Simple HTTP client wrapper using axios for making API requests.
 * Currently provides basic GET functionality for fetching game data.
 */

import axios from 'axios';

/**
 * Options for HTTP requests
 */
interface IHttpRequestOptions {
  /** The URL to make the request to */
  url: string;
}

/**
 * Makes a GET request to the specified URL
 * @param options - Request options containing the URL
 * @returns Promise that resolves to the response data
 */
const get = (options: IHttpRequestOptions) =>
  axios.get(
    options.url,
  )
  .then((response) => response.data);

/**
 * API client object with available HTTP methods
 * Currently only supports GET requests for fetching initial game data
 */
export const api = {
  get, // GET request method
};
