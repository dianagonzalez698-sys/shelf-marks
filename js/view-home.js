// The journal's opening. Everything on this page comes from the saved layout
// for 'home' — a list of editorial sections — so the composition is yours to
// rearrange without touching this file.

import { state } from './state.js';
import { renderSection } from './sections.js';
import * as layout from './layout.js';
import { esc } from './ui.js';
import { todayISO } from './periods.js';

export const HOME_PAGE_ID = 'home';

export function homeView() {
  const year = state.settings.year;
  const sections = layout.get(HOME_PAGE_ID);

  const preface = todayISO() < `${year}-01-01`
    ? `<div class="ed sp-tight"><div class="notice">
         <strong>The ${esc(year)} challenge hasn’t opened yet.</strong>
         Anything finished before January 1 won’t count toward these goals.
       </div></div>`
    : '';

  return {
    title: '',
    tab: 'home',
    banner: false,      // the hero section is the banner now
    editorial: true,
    fab: true,
    // The notice belongs under the cover, not above it.
    html: (() => {
      const parts = sections.map((sec) => renderSection(sec));
      if (!preface) return parts.join('');
      return [parts[0] || '', preface, ...parts.slice(1)].join('');
    })(),
  };
}
