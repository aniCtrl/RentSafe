// Polyfill for Server-Side Rendering (SSR) in Next.js
if (typeof globalThis !== 'undefined') {
  const mockLocalStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    length: 0,
    key: () => null,
  };

  if (!(globalThis as any).localStorage) {
    (globalThis as any).localStorage = mockLocalStorage;
  }
  if (!(globalThis as any).localstorage) {
    (globalThis as any).localstorage = mockLocalStorage;
  }
}
