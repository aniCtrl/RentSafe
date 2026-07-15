import '@testing-library/jest-dom';

// Complete mock implementation of localStorage for the test runner
const mockLocalStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
};

globalThis.localStorage = mockLocalStorage as any;
(globalThis as any).localstorage = mockLocalStorage as any;

if (typeof window !== 'undefined') {
  (window as any).localStorage = mockLocalStorage as any;
  (window as any).localstorage = mockLocalStorage as any;
}
