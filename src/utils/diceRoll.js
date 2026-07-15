// Bursts of real 3D dice: CSS cubes with pip faces that get tossed
// from an origin point, tumble on all three axes and fall off the
// screen. Styles live in index.css (.dice-overlay, .die3d*).

const PIPS = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]]
};

// Standard die layout: opposite faces sum to 7
const FACES = [
  { value: 1, transform: '' },
  { value: 6, transform: 'rotateY(180deg)' },
  { value: 2, transform: 'rotateY(90deg)' },
  { value: 5, transform: 'rotateY(-90deg)' },
  { value: 3, transform: 'rotateX(90deg)' },
  { value: 4, transform: 'rotateX(-90deg)' }
];

const MAX_DICE = 30;

let overlay = null;

function getOverlay() {
  if (!overlay || !document.body.contains(overlay)) {
    overlay = document.createElement('div');
    overlay.className = 'dice-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
  }
  return overlay;
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function buildDie(sizePx) {
  const die = document.createElement('div');
  die.className = 'die3d';

  const arc = document.createElement('div');
  arc.className = 'die3d-arc';

  const cube = document.createElement('div');
  cube.className = 'die3d-cube';

  for (const face of FACES) {
    const el = document.createElement('div');
    el.className = 'die3d-face';
    el.style.transform = `${face.transform} translateZ(${sizePx / 2}px)`;
    for (const [row, col] of PIPS[face.value]) {
      const pip = document.createElement('div');
      pip.className = 'die3d-pip';
      pip.style.gridRow = row;
      pip.style.gridColumn = col;
      el.appendChild(pip);
    }
    cube.appendChild(el);
  }

  arc.appendChild(cube);
  die.appendChild(arc);
  return die;
}

/**
 * Throw a burst of tumbling 3D dice.
 * @param {Object} options
 * @param {number} options.count - How many dice to throw (capped at 30)
 * @param {{x?: number, y?: number}} options.origin - Where the dice
 *   burst from, as viewport fractions (x: 0 left to 1 right, y: 0 top
 *   to 1 bottom). Defaults to horizontal center, 60% down.
 */
export function diceRoll({ count = 12, origin = {} } = {}) {
  if (typeof document === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const host = getOverlay();
  const originX = (origin.x ?? 0.5) * window.innerWidth;
  const originY = (origin.y ?? 0.6) * window.innerHeight;
  const diceCount = Math.min(count, MAX_DICE);

  for (let i = 0; i < diceCount; i++) {
    const size = random(16, 30);
    const die = buildDie(size);

    const duration = random(1.6, 2.6);
    const delay = random(0, 0.15);
    const drift = random(-1, 1) * random(60, 280);
    const toss = -random(80, 260);
    const fall = window.innerHeight - originY + 80;

    die.style.left = `${originX}px`;
    die.style.top = `${originY}px`;
    die.style.setProperty('--die-size', `${size}px`);
    die.style.setProperty('--duration', `${duration}s`);
    die.style.setProperty('--delay', `${delay}s`);
    die.style.setProperty('--drift', `${drift}px`);
    die.style.setProperty('--toss', `${toss}px`);
    die.style.setProperty('--fall', `${fall}px`);
    die.style.setProperty('--rx', `${random(-2, 2) * 360}deg`);
    die.style.setProperty('--ry', `${random(-2, 2) * 360}deg`);
    die.style.setProperty('--rz', `${random(-1, 1) * 360}deg`);

    host.appendChild(die);
    setTimeout(() => die.remove(), (duration + delay) * 1000 + 100);
  }
}
