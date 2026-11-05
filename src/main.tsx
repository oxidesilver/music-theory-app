import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { requestPersistentStorage } from '@/storage/persist';
import '@/styles/index.css';

// iPhone などでデータが自動削除されにくくなるよう、ブラウザに「永続保存」を依頼する
void requestPersistentStorage();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root が見つかりません');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
