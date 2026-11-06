import { allChallenges, bookmarkStats, state } from './state.js';

export function collectionsView() {
  const marks = bookmarkStats();
  return {
    title: 'Collections', tab: 'collections', fab: false,
    html: `<div class="literary-notebook lit-collections">
      <header class="lit-page-heading"><p class="lit-overline">THE CABINET OF CURIOSITIES</p>
        <h1>Collected <em>things</em></h1>
        <p>Small projects, familiar words, and everything gathered along the way.</p>
      </header>
      <div class="lit-collection-grid">
        <a href="#/challenges" class="lit-collection-card"><span>01 / READING PROJECTS</span><h2>Reading <em>Challenges</em></h2><p>A little structure for the books still waiting to be read.</p><small>${allChallenges().length} CHALLENGES ↗</small></a>
        <a href="#/bookmarks" class="lit-collection-card"><span>02 / THE ARCHIVE</span><h2>Collected <em>Bookmarks</em></h2><p>Small keepsakes for the milestones worth remembering.</p><small>${marks.collected} OF ${marks.total} COLLECTED ↗</small></a>
        <a href="#/words" class="lit-collection-card"><span>03 / LANGUAGE</span><h2>Words of the <em>Year</em></h2><p>Words stumbled upon and kept like pressed flowers between pages.</p><small>${state.words.length} WORDS ↗</small></a>
      </div>
    </div>`,
  };
}
