import {toolIcon} from '../../src/site/icons.ts';
import {readableRegion} from '../../src/studio/controls.ts';
import type {Control} from '../../src/engine/parameters.ts';

export interface RailEntry {
  key: string;
  label: string;
  icon: string;
  side: 'left' | 'right';
  swatch?: boolean;
}

export function iconForControl(control: {kind: string; key: string; label: string}): string {
  const text = (control.key + ' ' + control.label).toLowerCase();
  if (control.kind === 'color') return 'palette';
  if (text.includes('width')) return 'width';
  if (text.includes('height') || text.includes('tall')) return 'height';
  if (text.includes('depth') || text.includes('length')) return 'depth';
  if (control.kind === 'choice') return 'layers';
  if (control.kind === 'toggle') return 'build';
  if (text.includes('seed')) return 'more';
  if (text.includes('stripe') || text.includes('tone') || text.includes('shade')) return 'shading';
  return 'shape';
}

const SPARE_ICONS = ['layers', 'build', 'shape', 'frame', 'wobble', 'outline', 'wireframe', 'dither', 'shading', 'pixelate', 'brush', 'more'];

export function entriesForControls(controls: Control[], paletteCount: number): RailEntry[] {
  const shape: RailEntry[] = [];
  const colors: RailEntry[] = [];
  if (paletteCount) colors.push({key: 'palette', label: 'Palette', icon: 'palette', side: 'right'});
  for (const control of controls) {
    if (control.key === 'colorway') continue;
    const entry: RailEntry = {
      key: control.key,
      label: control.kind === 'color' ? readableRegion(control.label) : control.label,
      icon: iconForControl(control),
      side: control.kind === 'color' ? 'right' : 'left',
      swatch: control.kind === 'color',
    };
    (control.kind === 'color' ? colors : shape).push(entry);
  }
  const used = new Set<string>();
  for (const entry of shape) {
    if (used.has(entry.icon)) entry.icon = SPARE_ICONS.find(icon => !used.has(icon)) ?? entry.icon;
    used.add(entry.icon);
  }
  return [...shape, ...colors];
}

export function mountViewportRails(stage: HTMLElement, controls: HTMLElement, panel: {showControl(key?: string): void}, entries: RailEntry[]) {
  stage.classList.add('viewport-stage');
  const left = document.createElement('nav');
  left.className = 'viewport-rail viewport-rail-left';
  left.setAttribute('aria-label', 'Model parameters');
  const right = document.createElement('nav');
  right.className = 'viewport-rail viewport-rail-right';
  right.setAttribute('aria-label', 'Material parameters');
  const pop = document.createElement('div');
  pop.className = 'viewport-popover';
  pop.hidden = true;
  const title = document.createElement('p');
  title.className = 'viewport-popover-title';
  controls.classList.add('recipe-controls', 'viewport-popover-body');
  pop.append(title, controls);
  const hint = document.createElement('p');
  hint.className = 'viewport-orbit-hint';
  hint.textContent = 'Drag to orbit, scroll to zoom';
  const tip = document.createElement('p');
  tip.className = 'viewport-tip';
  tip.hidden = true;
  const showTip = (button: HTMLButtonElement, side: RailEntry['side']) => {
    if (button.getAttribute('aria-expanded') === 'true') return;
    const stageBox = stage.getBoundingClientRect(), box = button.getBoundingClientRect();
    tip.textContent = button.dataset.label ?? '';
    tip.hidden = false;
    tip.style.top = (box.top - stageBox.top + box.height / 2) + 'px';
    if (side === 'left') { tip.style.left = (box.right - stageBox.left + 8) + 'px'; tip.style.right = ''; }
    else { tip.style.right = (stageBox.right - box.left + 8) + 'px'; tip.style.left = ''; }
  };
  const hideTip = () => { tip.hidden = true; };
  const buttons: HTMLButtonElement[] = [];
  let openKey = '';
  const close = () => {
    openKey = '';
    pop.hidden = true;
    panel.showControl('');
    for (const button of buttons) button.setAttribute('aria-expanded', 'false');
  };
  const updateSwatches = () => {
    for (const button of buttons) {
      if (!button.classList.contains('viewport-swatch')) continue;
      const key = button.dataset.key ?? '';
      const selector = '[data-key="' + CSS.escape(key) + '"] input[type="color"]';
      const input = controls.querySelector(selector) as HTMLInputElement | null;
      if (input && input.value) button.style.setProperty('--swatch', input.value);
    }
  };
  const open = (entry: RailEntry, button: HTMLButtonElement) => {
    if (openKey === entry.key) { close(); return; }
    openKey = entry.key;
    panel.showControl(entry.key);
    title.textContent = entry.label;
    title.hidden = false;
    pop.hidden = false;
    pop.dataset.side = entry.side;
    const stageBox = stage.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    const room = stage.clientHeight - pop.offsetHeight - 12;
    pop.style.top = Math.max(8, Math.min(buttonBox.top - stageBox.top, Math.max(8, room))) + 'px';
    for (const other of buttons) other.setAttribute('aria-expanded', String(other === button));
    updateSwatches();
  };
  for (const entry of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'viewport-tool';
    button.dataset.key = entry.key;
    button.dataset.label = entry.label;
    button.title = entry.label;
    button.setAttribute('aria-label', entry.label);
    button.setAttribute('aria-expanded', 'false');
    button.append(toolIcon(entry.icon));
    if (entry.swatch) button.classList.add('viewport-swatch');
    button.addEventListener('click', event => { event.stopPropagation(); hideTip(); open(entry, button); });
    for (const name of ['pointerenter', 'focus'] as const) button.addEventListener(name, () => showTip(button, entry.side));
    for (const name of ['pointerleave', 'blur'] as const) button.addEventListener(name, hideTip);
    (entry.side === 'right' ? right : left).append(button);
    buttons.push(button);
  }
  if (!left.childElementCount) left.hidden = true;
  if (!right.childElementCount) right.hidden = true;
  stage.append(left, right, pop, hint, tip);
  controls.addEventListener('input', updateSwatches);
  controls.addEventListener('change', updateSwatches);
  controls.addEventListener('click', updateSwatches);
  stage.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (pop.contains(target) || buttons.some(button => button.contains(target))) return;
    close();
  });
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  panel.showControl('');
  updateSwatches();
  return {sync: updateSwatches, dispose() { document.removeEventListener('keydown', onKey); close(); }};
}
