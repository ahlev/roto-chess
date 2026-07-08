/**
 * Dashboard sections. Player games: Your turn → Waiting → Draft → Completed
 * (extracted verbatim from the page so it's testable). Observed games get
 * their own shelves — watching is never "your turn", and finished observed
 * games are archived apart from games you played.
 */
export interface Bucketable {
  status: string;
  active_seat: number | null;
  mySeat: number | null;
  role: "player" | "observer";
  last_move_at: string | null;
}

export interface Buckets<T> {
  yourTurn: T[];
  waiting: T[];
  settingUp: T[];
  finished: T[];
  observing: T[];
  observedFinished: T[];
}

export function bucketGames<T extends Bucketable>(rows: T[]): Buckets<T> {
  const yourTurn: T[] = [];
  const waiting: T[] = [];
  const settingUp: T[] = [];
  const finished: T[] = [];
  const observing: T[] = [];
  const observedFinished: T[] = [];
  for (const row of rows) {
    if (row.role === "observer") {
      if (row.status === "lobby" || row.status === "active") observing.push(row);
      else observedFinished.push(row);
    } else if (row.status === "lobby") settingUp.push(row);
    else if (row.status === "active" && row.active_seat === row.mySeat)
      yourTurn.push(row);
    else if (row.status === "active") waiting.push(row);
    else finished.push(row);
  }
  // Your turn: oldest wait first; waiting/observing: most recent activity first.
  yourTurn.sort((a, b) =>
    (a.last_move_at ?? "").localeCompare(b.last_move_at ?? ""),
  );
  waiting.sort((a, b) =>
    (b.last_move_at ?? "").localeCompare(a.last_move_at ?? ""),
  );
  observing.sort((a, b) =>
    (b.last_move_at ?? "").localeCompare(a.last_move_at ?? ""),
  );
  return { yourTurn, waiting, settingUp, finished, observing, observedFinished };
}
