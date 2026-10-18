// Icon primitives self-hosted in SVG sprite; no external font or icon API.
// Rendering paths are public static assets only.
const NS = 'http://www.w3.org/2000/svg';
export function makeIcon(name,extra='') {
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('class','raf-icon'+(extra?' '+extra:''));
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  const use=document.createElementNS(NS,'use');
  use.setAttribute('href','./assets/icons.svg#'+name);
  svg.append(use);
  return svg;
}
