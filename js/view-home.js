// Claude's original homepage composition remains the default. New literary
// features are optional sections the reader chooses to add.
import { renderSection } from './sections.js';
import * as layout from './layout.js';

export const HOME_PAGE_ID = 'home';

export function homeView() {
  return {
    title: '', tab: 'home', banner: false, editorial: true,
    editPage: HOME_PAGE_ID,
    html: layout.get(HOME_PAGE_ID).map((sec) => renderSection(sec)).join(''),
  };
}
