
export const friendlyMarkers = [
  {
    match: /^rd$/i,
    name: 'tick',
  },
  {
    match: /^vsynctimestamp$/i,
    name: 'vsync',
  },
  {
    match: /^scripts$/i,
    name: 'script',
  },
  {
    match: /^styles$/i,
    name: 'style',
  },
  {
    match: /^reflow$/i,
    name: 'layout',
  },
  {
    match: /^displaylist$/i,
    name: 'displaylist',
  },
  {
    match: /^rasterize$/i,
    name: 'rasterize',
  },
  {
    match: /^layer/i,
    name: 'composite-ipc',
  },
  {
    match: /^composite$/i,
    name: 'composite',
  },
  {
    match: /^domLoading: (.*)/i,
    name: 'load',
  },
  {
    match: /^non-blank.*(http.*),\s/i,
    name: 'loadPaint',
  },
  {
    match: /^dominteractive: (.*)/i,
    name: 'loadInteractive',
  },
  {
    match: /^domcomplete: (.*)/i,
    name: 'loadComplete',
  },
  {
    match: /^domcontentloaded: (.*)/i,
    name: 'loadContentLoaded',
    // process: marker => console.log(marker),
  },
  {
    match: /^load: (.*)/i,
    name: 'loadEnd',
  },
  {
    match: /^inputScroll: (.*)/i,
    name: 'inputScroll',
    data: { interval: 'start' },
  },
  {
    match: /^inputScrollEnd: (.*)/i,
    name: 'inputScroll',
    data: { interval: 'end' },
  },
];

export const mainMarkers = ['tick', 'script', 'style', 'layout', 'displaylist', 'rasterize'];
