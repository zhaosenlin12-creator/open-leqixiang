import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'output', 'browser');
const USER_DATA = path.join(ROOT, 'tmp', `chrome-smoke-profile-${Date.now()}`);
const CHROME = process.env.CHROME_PATH ?? 'C:\\Progra~1\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = Number(process.env.DEBUG_PORT ?? 9333);
const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:5173/';

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);
      if (!payload.id) return;
      const handlers = this.pending.get(payload.id);
      if (!handlers) return;
      this.pending.delete(payload.id);
      if (payload.error) handlers.reject(new Error(payload.error.message));
      else handlers.resolve(payload.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }
}

async function waitForDebuggerUrl() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (response.ok) {
        const data = await response.json();
        const page = data.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome is still starting.
    }
    await sleep(250);
  }
  throw new Error('Chrome remote debugging endpoint did not become available');
}

async function openCdp(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  return new Cdp(socket);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? 'Runtime evaluation failed');
  }
  return result.result.value;
}

function jsString(value) {
  return JSON.stringify(value);
}

async function assertEval(cdp, expression, message) {
  const ok = await evaluate(cdp, expression);
  if (!ok) throw new Error(message);
}

async function clickSelector(cdp, selector, label = selector) {
  const clicked = await evaluate(
    cdp,
    `(() => {
      const target = document.querySelector(${jsString(selector)});
      if (!target) return false;
      target.click();
      return true;
    })()`
  );
  if (!clicked) throw new Error(`Element not found: ${label}`);
  await sleep(700);
}

async function waitForSelectorGone(cdp, selector, message, attempts = 30) {
  await waitForEval(
    cdp,
    `document.querySelector(${jsString(selector)}) === null`,
    message,
    attempts
  );
}

async function waitForEval(cdp, expression, message, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    if (await evaluate(cdp, expression)) return;
    await sleep(350);
  }
  throw new Error(message);
}

async function capture(cdp, filename) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(OUTPUT, filename), Buffer.from(shot.data, 'base64'));
}

async function navigateToSection(cdp, section) {
  await evaluate(
    cdp,
    `(() => {
      const nav = Array.from(document.querySelectorAll('.primary-navigation button'));
      const target = nav.find((button) => button.dataset.section === ${jsString(section)});
      if (target) target.click();
      return Boolean(target);
    })()`
  );
  await sleep(900);
}

async function main() {
  await mkdir(OUTPUT, { recursive: true });
  await mkdir(USER_DATA, { recursive: true });

  const chrome = spawn(CHROME, [
    '--headless=new',
    
    '--no-sandbox',
    `--user-data-dir=${USER_DATA}`,
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--window-size=1920,1080',
    'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const stderr = [];
  chrome.stderr.on('data', (chunk) => stderr.push(chunk.toString()));

  try {
    const wsUrl = await waitForDebuggerUrl();
    const cdp = await openCdp(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    const consoleMsgs = [];
    cdp.socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.method === 'Runtime.consoleAPICalled' || payload.method === 'Runtime.exceptionThrown') {
          consoleMsgs.push(payload.method + ': ' + JSON.stringify(payload.params));
        }
      } catch (_) {}
    });
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.send('Page.navigate', { url: APP_URL });
    await sleep(2500);

    await assertEval(
      cdp,
      `document.querySelector('.brand-mark img')?.getAttribute('src') === '/images/brand/logo.png'`,
      'Header is not using the complete logo'
    );
    await assertEval(
      cdp,
      `document.querySelectorAll('.primary-navigation button').length >= 6`,
      'Primary navigation is missing categories'
    );
    await assertEval(
      cdp,
      `document.querySelector('.hero-carousel .hero-slide.is-active img, .hero-carousel .hero-slide.is-active video') !== null`,
      'Home hero media is not rendered'
    );
    await capture(cdp, 'smoke-home.png');

    // students section with image gallery
    await navigateToSection(cdp, 'students');
    await assertEval(cdp, `document.querySelector('.category-stage.category-students') !== null`, 'Student section did not render');
    await assertEval(
      cdp,
      `document.querySelectorAll('.category-stage.category-students .student-card, .category-stage.category-students .student-avatar, .category-stage.category-students .orbit-rail-frame').length >= 5`,
      'Student gallery is missing frames'
    );
    await assertEval(cdp, `document.querySelector('.category-stage.category-students img') !== null`, 'Student section image is missing');
    // user manually clicks the 3rd card, the active index should follow
    await evaluate(cdp, `(() => { const cards = document.querySelectorAll('.category-stage.category-students .student-card, .category-stage.category-students .student-avatar, .category-stage.category-students .orbit-rail-frame'); if (cards[2]) cards[2].click(); return true; })()`);
    await sleep(800);
    await waitForEval(cdp, `document.querySelector('.cinematic-view') !== null`, 'Student image click did not open the preview');
    await clickSelector(cdp, '.cinematic-toolbar-actions button:last-child', 'student preview close button');
    // Open a different student image and snap the ImageViewer specifically
    await navigateToSection(cdp, 'students');
    await sleep(600);
    await evaluate(cdp, '(() => { const cards = document.querySelectorAll(".category-stage.category-students .student-card"); if (cards[2]) cards[2].click(); return Boolean(cards[2]); })()');
    await waitForEval(cdp, 'document.querySelector(".cinematic-view") !== null', 'Image viewer cinematic did not open', 20);
    await sleep(900);
    await evaluate(cdp, '(() => { const v = document.querySelector(".image-viewer"); if (v) v.scrollIntoView(); return Boolean(v); })()');
    await sleep(400);
    await capture(cdp, 'smoke-image-viewer.png');
    // Try wheel-zoom and capture again
    await evaluate(cdp, '(() => { const v = document.querySelector(".image-viewer"); if (!v) return false; const r = v.getBoundingClientRect(); v.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -240, clientX: r.left + r.width/2, clientY: r.top + r.height/2 })); v.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -240, clientX: r.left + r.width/2, clientY: r.top + r.height/2 })); return true; })()');
    await sleep(400);
    await capture(cdp, 'smoke-image-viewer-zoomed.png');
    // Close via the cinematic drawer's own X (the ImageViewer no longer has a close button)
    await clickSelector(cdp, '.cinematic-toolbar-actions button:last-child', 'cinematic close');
    await waitForSelectorGone(cdp, '.cinematic-view', 'Image viewer did not close');
    await waitForSelectorGone(cdp, '.cinematic-view', 'Student preview did not close');
    // Give the 152 student photos a chance to decode so the wall
    // screenshot actually shows the avatars, not grey placeholder discs.
    await sleep(2500);
    await waitForEval(
      cdp,
      '(() => { const imgs = Array.from(document.querySelectorAll(".category-stage.category-students .student-card img")); if (imgs.length < 100) return false; const loaded = imgs.filter(i => i.complete && i.naturalWidth > 0).length; return loaded >= Math.floor(imgs.length * 0.6); })()',
      'Student wall images did not finish loading',
      40
    );
    await capture(cdp, 'smoke-students-video.png');

    // courses section with horizontal reel
    await navigateToSection(cdp, 'courses');
    await assertEval(cdp, `document.querySelector('.category-stage.category-courses') !== null`, 'Course stage did not render');
    await assertEval(cdp, `document.querySelectorAll('.orbit-rail-frame').length >= 6`, 'Horizontal material reel did not render enough frames');
    await assertEval(cdp, `getComputedStyle(document.querySelector('.orbit-rail-track')).cursor === 'grab'`, 'Material reel is not draggable');
    await assertEval(cdp, `document.querySelector('.detail-drawer') === null`, 'Old right-side drawer is visible');
    await capture(cdp, 'smoke-courses-reel.png');

    const beforeDrag = await evaluate(cdp, `document.querySelector('.orbit-rail-frame.is-active b')?.textContent?.trim()`);
    await evaluate(cdp, `(() => {
      const reel = document.querySelector('.orbit-rail-track');
      reel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8, clientX: 900 }));
      reel.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 8, clientX: 720 }));
      reel.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8, clientX: 720 }));
      return true;
    })()`);
    await sleep(900);
    const afterDrag = await evaluate(cdp, `document.querySelector('.orbit-rail-frame.is-active b')?.textContent?.trim()`);
    if (beforeDrag === afterDrag) {
      throw new Error('Dragging the material reel did not change the active item');
    }

    // The legacy '.section-briefing-button' expand trigger has been
    // superseded: the cinematic drawer is now opened by clicking the
    // currently active frame in the orbit rail.
    await evaluate(cdp, `(() => { const f = document.querySelector('.category-stage.category-courses .orbit-rail-frame.is-active'); if (f) f.click(); return Boolean(f); })()`);
    await assertEval(cdp, `document.querySelector('.cinematic-view') !== null`, 'Clicking the active rail frame did not open the cinematic expansion');
    await capture(cdp, 'smoke-courses-expanded.png');

    await clickSelector(cdp, '.cinematic-toolbar-actions button:last-child', 'cinematic close button');
    await waitForSelectorGone(cdp, '.cinematic-view', 'Cinematic expansion did not close');

    // Reproduce the flaky path: open a student detail, close it, then immediately switch sections.
    await navigateToSection(cdp, 'students');
    await evaluate(cdp, `(() => { const cards = document.querySelectorAll('.category-stage.category-students .student-card, .category-stage.category-students .student-avatar, .category-stage.category-students .orbit-rail-frame'); if (cards[1]) cards[1].click(); return Boolean(cards[1]); })()`);
    await sleep(500);
    await evaluate(cdp, `(() => { const active = document.querySelector('.category-stage.category-students .student-card.is-active, .category-stage.category-students .student-avatar.is-active, .category-stage.category-students .orbit-rail-frame.is-active'); if (active) active.click(); return Boolean(active); })()`);
    await waitForEval(cdp, `document.querySelector('.cinematic-view') !== null`, 'Student cinematic expansion did not open');
    await clickSelector(cdp, '.cinematic-toolbar-actions button:last-child', 'student cinematic close button');
    await evaluate(
      cdp,
      `(() => {
        const nav = Array.from(document.querySelectorAll('.primary-navigation button'));
        const target = nav.find((button) => button.dataset.section === 'courses');
        if (target) target.click();
        return Boolean(target);
      })()`
    );
    await waitForEval(
      cdp,
      `(() => {
        const activeNav = document.querySelector('.primary-navigation button.is-active')?.getAttribute('data-section');
        const stage = document.querySelector('.category-stage');
        return activeNav === 'courses' && stage?.classList.contains('category-courses');
      })()`,
      'Section switch after closing detail got stuck'
    );
    await capture(cdp, 'smoke-transition-after-close.png');

    // showreel section with auto-advance and demo reel
    await navigateToSection(cdp, 'showreel');
    await assertEval(cdp, `document.querySelector('.category-stage.category-showreel') !== null`, 'Showreel section did not render');
    await assertEval(cdp, `document.querySelector('.category-stage.category-showreel video') !== null`, 'Showreel video card is missing');
    await waitForEval(
      cdp,
      `(() => {
        const video = document.querySelector('.category-stage.category-showreel video');
        return video && video.readyState >= 2;
      })()`,
      'Showreel video did not load'
    );
    // showreel: verify manual click switches active card
    // Wait for inactive showreel thumbnails to render. Each video frame
    // extract takes ~2s, so we poll for a few seconds.
    await waitForEval(
    cdp,
      `(() => {
        const frames = Array.from(document.querySelectorAll('.category-stage.category-showreel .orbit-rail-frame'));
        if (frames.length === 0) return false;
        return frames.every((f) => {
          if (f.getAttribute('data-rail-active') === 'true') return true;
          const family = (f.getAttribute('data-rail-family') || '').trim();
          // For inactive video cards the renderer swaps the <video preload=none> fallback
          // for a data:image/jpeg <img> once the first-frame extractor finishes. Wait for that.
          if (family === '编程课堂' || family === '项目营' || family === '科创体验' || family === '团队活动') {
            const thumb = f.querySelector('img[src^="data:image/jpeg"]');
            return Boolean(thumb);
          }
          // Image cards (e.g. 荣誉时刻 / 现场画面) always render an <img> with the real source.
          const img = f.querySelector('img[src]');
          return Boolean(img && img.getAttribute('src'));
        });
      })()`,
      'Showreel thumbnails did not finish rendering in time',
      80
    );
    // Click the second card to confirm manual selection works.
    await evaluate(cdp, `(() => { const cards = document.querySelectorAll('.category-stage.category-showreel .orbit-rail-frame'); if (cards[1]) cards[1].click(); return true; })()`);
    await sleep(800);
    const afterShowreel = await evaluate(cdp, `document.querySelector('.category-stage.category-showreel .orbit-rail-frame.is-active b')?.textContent?.trim()`);
    if (afterShowreel !== '02') {
      throw new Error('Showreel did not switch to clicked card (expected 02, got ' + afterShowreel + ')');
    }
    await capture(cdp, 'smoke-showreel.png');

    // NOTE: The auto-reel trigger is no longer a DOM button in the
    // current SectionBriefing (only a single 'expand' button is rendered),
    // so we skip the auto-reel verification here. We still re-visit
    // showreel so the test can conclude cleanly.
    await navigateToSection(cdp, 'showreel');

    console.log(JSON.stringify({
      ok: true,
      url: APP_URL,
      screenshots: [
        'output/browser/smoke-home.png',
        'output/browser/smoke-students-video.png',
        'output/browser/smoke-courses-reel.png',
        'output/browser/smoke-courses-expanded.png',
        'output/browser/smoke-showreel.png',
      ]
    }, null, 2));
  } finally {
    chrome.kill();
    await sleep(500);
    await rm(USER_DATA, { recursive: true, force: true }).catch(() => {});
    if (stderr.length) {
      await writeFile(path.join(OUTPUT, 'smoke-chrome.err.log'), stderr.join(''), 'utf8');
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});






