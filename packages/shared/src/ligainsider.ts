/**
 * LigaInsider (ligainsider.de) is a valuable source of injury/lineup/form
 * news that Kickbase's own API does not provide. This project deliberately
 * does not scrape it: player profile URLs there embed a LigaInsider-internal
 * numeric id (e.g. ligainsider.de/silas_21594/) that has no relationship to
 * a Kickbase player id, so constructing a direct profile URL would risk
 * silently linking to the wrong player. There is also no reliable public
 * search endpoint on the site to resolve a name to that id.
 *
 * Instead this builds a search-engine query that a caller with live web
 * search (e.g. Claude Desktop) can run to find the right page itself,
 * scoped to the domain so results stay on-topic.
 */
export function buildLigaInsiderSearchQuery(playerName: string): string {
  return `site:ligainsider.de ${playerName}`;
}
