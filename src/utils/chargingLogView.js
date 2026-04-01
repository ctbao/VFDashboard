/**
 * chargingLogView.js — view-time snapshot transforms
 *
 * None of these functions mutate stored data. They are called at render time
 * to determine what to show in snapshot tables and charts.
 */

/**
 * Collapse a snapshots array into display entries.
 *
 * Returns an array of entries:
 *   { type: 'snapshot', data: ChargingSnapshot }
 *   { type: 'stale_gap', count, startTime, endTime }
 *   { type: 'dup_group', count, startTime, endTime, sample: ChargingSnapshot }
 *
 * @param {import('../stores/chargingLiveStore').ChargingSnapshot[]} snapshots
 * @param {{ hideStale?: boolean, collapseDuplicates?: boolean }} opts
 * @returns {Array}
 */
export function collapseSnapshots(snapshots, opts = {}) {
  const { hideStale = true, collapseDuplicates = true } = opts;
  if (!snapshots || snapshots.length === 0) return [];

  const result = [];
  let i = 0;

  while (i < snapshots.length) {
    const snap = snapshots[i];

    // --- Stale group: consecutive isStale records ---
    if (hideStale && snap.isStale) {
      let j = i;
      while (j < snapshots.length && snapshots[j].isStale) j++;
      result.push({
        type: 'stale_gap',
        count: j - i,
        startTime: snapshots[i].timestamp,
        endTime: snapshots[j - 1].timestamp,
      });
      i = j;
      continue;
    }

    // Regular snapshot: always emit it
    result.push({ type: 'snapshot', data: snap });
    i++;

    // --- Duplicate group: consecutive snapshots following this one where soc_pct + power_kw are unchanged ---
    if (collapseDuplicates) {
      let j = i;
      while (
        j < snapshots.length &&
        !(hideStale && snapshots[j].isStale) &&
        snapshots[j].soc_pct === snap.soc_pct &&
        snapshots[j].power_kw === snap.power_kw
      ) j++;

      if (j > i) {
        result.push({
          type: 'dup_group',
          count: j - i,
          startTime: snapshots[i].timestamp,
          endTime: snapshots[j - 1].timestamp,
          sample: snap,
        });
        i = j;
      }
    }
  }

  return result;
}

/**
 * Count how many raw snapshots are hidden by the current collapse settings.
 *
 * @param {Array} entries - output of collapseSnapshots()
 * @returns {{ staleCount: number, dupCount: number, visibleCount: number }}
 */
export function getCollapseStats(entries) {
  let staleCount = 0;
  let dupCount = 0;
  let visibleCount = 0;

  for (const e of entries) {
    if (e.type === 'stale_gap') staleCount += e.count;
    else if (e.type === 'dup_group') dupCount += e.count;
    else visibleCount++;
  }

  return { staleCount, dupCount, visibleCount };
}

/**
 * Format a session timestamp as mm:ss or hh:mm relative to a session start time.
 *
 * @param {number} timestamp - epoch ms
 * @param {number} sessionStart - epoch ms
 * @returns {string}
 */
export function formatElapsedShort(timestamp, sessionStart) {
  const sec = Math.round((timestamp - sessionStart) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
