import { createHashRouter, RouterProvider } from 'react-router';
import { routes } from './routes';

// URL を「#/learn」の形にする方式（HashRouter）。
// GitHub Pages で公開しても、オフラインで開いても、どの画面でも正しく表示できる。
const router = createHashRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
