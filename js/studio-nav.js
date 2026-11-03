// The little tab strip shared by the three studio workbenches.

export function studioNav(active) {
  const tabs = [
    ['design', '#/customize', 'Design'],
    ['layout', '#/layout', 'Layouts'],
    ['assets', '#/assets', 'Pictures'],
  ];
  return `<nav class="studio-nav" aria-label="Design studio">
    ${tabs.map(([id, href, label]) =>
      `<a class="studio-tab${id === active ? ' is-active' : ''}" href="${href}">${label}</a>`).join('')}
  </nav>`;
}
