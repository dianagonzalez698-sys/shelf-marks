// The journal's opening. Everything on this page comes from the saved layout
// for 'home' — a list of editorial sections — so the composition is yours to
// rearrange without touching this file.

import { renderSection } from './sections.js';
import * as layout from './layout.js';

export const HOME_PAGE_ID = 'home';

export function homeView() {
  const sections = layout.get(HOME_PAGE_ID);

  return {
    title: '',
    tab: 'home',
    banner: false,      // the hero section is the banner now
    editorial: true,
    fab: true,
    html: sections.map((sec) => renderSection(sec)).join(''),
  };
}
