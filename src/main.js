import './style.css';
import { App } from './viewer/viewer.js';
import { initUI } from './viewer/ui.js';

const loader = document.getElementById('loader');
const loaderMsg = document.getElementById('loader-msg');

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

async function start() {
  if (!webglAvailable()) {
    loaderMsg.textContent = 'This viewer needs WebGL 2. Please open it in a recent Chrome, Edge, Safari or Firefox.';
    loader.classList.add('error');
    return;
  }
  const app = new App(document.getElementById('stage'));
  window.homeApp = app; // handy for debugging from the console
  const t0 = performance.now();
  await app.build((msg) => { loaderMsg.textContent = `${msg}…`; });
  console.info(`[home3d] ready in ${Math.round(performance.now() - t0)} ms`);
  initUI(app);
  app.setView('exterior', { instant: true });
  app.renderer.shadowMap.needsUpdate = true;
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 700);
}

start().catch((err) => {
  console.error(err);
  loaderMsg.textContent = `Something went wrong: ${err.message}`;
  loader.classList.add('error');
});
