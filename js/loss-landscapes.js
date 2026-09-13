// Original illustrative surfaces, not named optimization benchmarks.
// IDs are internal. Coordinates and heights share the explorer world's units.
const {sin, cos, exp, sqrt, tanh} = Math;
const root130 = sqrt(130);
const aligned = fn => (x, z) => fn((7*x + 9*z)/root130, (9*x - 7*z)/root130);
const pocketCenters = [
  [-3.6,-3.2],[-3.4,-.9],[-3.7,1.7],[-3.2,3.8],
  [-1.1,-3.7],[-1.3,-1.2],[-.8,1.1],[-1.2,3.6],
  [1.3,-3.4],[1.0,-.9],[1.5,1.5],[1.1,3.8],
  [3.5,-3.5],[3.8,-1.2],[3.3,1.2],[3.7,3.5]
];

const surfaces = [
  {
    id: 'original-interference',
    // Exact original landscape, including coefficients and phase.
    height: aligned((r,s) => .75 + .35*cos(3.25*r+.3)*cos(3*s-.2)
      + .24*cos(3.8*r-1.7*s+.8) + .14*sin(1.5*r+3.6*s))
  },
  {
    id: 'crossing-swells',
    height: aligned((r,s) => .72 + .26*cos(2.4*r) + .20*cos(2.8*s)
      + .12*cos(1.7*r+2.1*s))
  },
  {
    id: 'woven-channels',
    height: aligned((r,s) => .72 + .31*sin(2.5*r+.50*sin(1.4*s))*cos(2.7*s)
      + .14*cos(1.1*r-2*s) + .09*cos(3.8*r+.2*s))
  },
  {
    id: 'braided-ridges',
    height: aligned((r,s) => .72 + .27*cos(2.6*r+.65*sin(1.5*s))
      + .19*sin(2.3*s-.50*sin(1.4*r)) + .10*cos(3.2*r-2.7*s))
  },
  {
    id: 'basin-lattice',
    height: aligned((r,s) => .98 - .64*exp(-1.65*(sin(1.6*r)**2+sin(1.55*s)**2))
      + .11*cos(1.1*r+.6*s))
  },
  {
    id: 'mound-garden',
    height: aligned((r,s) => .43 + .66*exp(-1.45*(sin(1.7*r+.2)**2+sin(1.6*s)**2))
      + .12*cos(1.1*r-1.5*s))
  },
  {
    id: 'offset-ripples',
    height: aligned((r,s) => .72 + .23*cos(3.5*sqrt((r+1.4)**2+(s-.7)**2+.24))
      + .23*cos(3.3*sqrt((r-1.2)**2+(s+1.1)**2+.30)) + .10*sin(1.3*r-1.9*s))
  },
  {
    id: 'hexagonal-weave',
    height: aligned((r,s) => .72 + .19*(cos(2.8*r)
      + cos(-1.4*r+2.424871130596428*s) + cos(-1.4*r-2.424871130596428*s))
      + .09*sin(1.7*r+.8*s))
  },
  {
    id: 'chirped-folds',
    height: aligned((r,s) => .72 + .24*cos(2.7*r+.095*r*r+.35*sin(.9*s))
      + .22*cos(2.6*s-.085*s*s) + .10*cos(1.5*r+1.2*s))
  },
  {
    id: 'soft-saddle-terraces',
    height: aligned((r,s) => .73 + .40*tanh(1.1*sin(2.2*r)*sin(2.4*s))
      + .12*sin(1.3*r) + .11*cos(1.4*s))
  },
  {
    id: 'meandering-bands',
    height: aligned((r,s) => .70 + .29*cos(3*(s+.4*sin(1.3*r)))
      + .16*cos(2.6*r) + .13*sin(1.5*s-.75*r))
  },
  {
    id: 'scattered-pockets',
    height: aligned((r,s) => {
      let wells = 0;
      for (const [a,b] of pocketCenters) wells += exp(-((r-a)**2+(s-b)**2)/.62);
      return .86 - .50*wells + .13*sin(1.5*r+.3)*cos(1.6*s)
        + .09*cos(1.2*r-1.7*s);
    })
  }
];


const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t*t*t*(t*(t*6-15)+10);
};
// Keep one small entry ridge consistent so the explorer always emerges promptly.
// The rest of each surface retains its own basins, folds, or wave structure.
export const LANDSCAPES = surfaces.map((surface,index) => ({
  id: surface.id,
  height: index===0 ? surface.height : (x,z) => {
    const r=(7*x+9*z)/root130, s=(9*x-7*z)/root130;
    const entry=(1-smooth((Math.abs(r+.5)-.8)/.5))
      *(1-smooth((Math.abs(s)-.18)/.75));
    return surface.height(x,z)*(1-entry)+surfaces[0].height(x,z)*entry;
  }
}));

// A shuffled deck gives every landscape a turn before starting another round.
export function selectLandscape(storage, random=Math.random) {
  const key='sk-landscapes-v1', count=LANDSCAPES.length;
  let saved;
  try { saved=JSON.parse(storage?.getItem(key)||'null'); } catch {}
  const valid=saved && Number.isInteger(saved.last) && saved.last>=0 && saved.last<count
    && Array.isArray(saved.remaining) && saved.remaining.length<count
    && new Set(saved.remaining).size===saved.remaining.length
    && saved.remaining.every(i=>Number.isInteger(i)&&i>=0&&i<count&&i!==saved.last);
  let remaining=valid?saved.remaining:[], last=valid?saved.last:-1;
  if(!remaining.length) {
    remaining=Array.from({length:count},(_,i)=>i);
    for(let i=count-1;i>0;i--) {
      const j=Math.floor(random()*(i+1));
      [remaining[i],remaining[j]]=[remaining[j],remaining[i]];
    }
    if(remaining[0]===last) [remaining[0],remaining[1]]=[remaining[1],remaining[0]];
  }
  const index=remaining.shift();
  try { storage?.setItem(key,JSON.stringify({last:index,remaining})); } catch {}
  return LANDSCAPES[index];
}
