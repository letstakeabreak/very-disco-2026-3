import { mountApp } from './app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing app root');
const unmount = mountApp(root);
if (import.meta.hot) import.meta.hot.dispose(unmount);
