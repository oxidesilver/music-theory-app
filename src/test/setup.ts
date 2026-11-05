// テスト共通の準備
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto'; // テスト中は本物の代わりに「偽の IndexedDB」を使う
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom には matchMedia が無いので最小限の代用品を用意する
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom には scrollTo が無い
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
