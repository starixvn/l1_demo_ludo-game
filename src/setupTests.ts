// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
// Note: @testing-library/jest-dom may not be installed, so we'll skip if unavailable
try {
  require('@testing-library/jest-dom/extend-expect');
} catch (e) {
  // @testing-library/jest-dom is not installed, skip
}
