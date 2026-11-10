/** An absolute rectangle in frame coordinates. */
export type Box = { x: number; y: number; w: number; h: number };

/** Per-format numbers. Scenes read only from here, so the portrait cut is a table, not a rewrite. */
export type Layout = {
  format: "landscape" | "portrait";
  width: number;
  height: number;
  /** Lower-third baseline and left edge. */
  lowerX: number;
  lowerY: number;
  lowerSize: number;
  /** Beat 1: hero board. */
  hero: { cx: number; cy: number; s: number };
  /** Beat 2: board inside the browser window, and the window box. */
  today: {
    cx: number;
    cy: number;
    s: number;
    win: { x: number; y: number; w: number; h: number };
    /** Sidebar panels inside the window: history and table chat. */
    history: { x: number; y: number; w: number; h: number };
    chat: { x: number; y: number; w: number; h: number };
  };
  /** Beat 3: exploded planes. */
  ground: {
    cx: number;
    s: number;
    ky: number;
    planeY: [number, number, number, number];
    labelX: number;
    /** Plane-label leader lines stop here (absolute x). */
    leaderEndX: number;
    /** Heartbeat baseline: left edge, y and width. */
    heartbeat: { x: number; y: number; w: number };
    /** Engine status chip: left edge, y and width. */
    engineChip: { x: number; y: number; w: number };
    /** Confirm chip on the Input plane (absolute). */
    confirmChip: { x: number; y: number };
  };
  /** Beat 4: phone box and the flight start. */
  pocket: { phone: { x: number; y: number; w: number; h: number }; miniStart: { cx: number; cy: number; s: number }; copy: { x: number; y: number } };
  /** Beat 5: close crop and lens. */
  feel: { cx: number; cy: number; s: number; lens: { x: number; y: number; r: number }; chip: { x: number; y: number } };
  /** Beat 6: board and share card. */
  alone: {
    cx: number;
    cy: number;
    s: number;
    card: Box;
    /** Seat plaques around the board (absolute boxes). */
    plaques: { north: Box; east: Box; south: Box; west: Box };
    /** Share-card interior, as offsets from the card's top-left: mini-board centre y, URL pill y, chips row y, mini-board scale. */
    cardInner: { miniCy: number; urlY: number; chipsY: number; miniS: number };
  };
  /** Beat 7: tilted board centre, and a multiplier on the pose's board scale (so the zoomed board fits the frame). */
  depth: { cx: number; cy: number; sMul: number };
  /** Beat 8: device boxes, the store pills (first pill's top-left) and the brand lockup. */
  everywhere: { phone: { x: number; y: number; w: number; h: number }; tablet: { x: number; y: number; w: number; h: number }; laptop: { x: number; y: number; w: number; h: number }; store: { x: number; y: number }; brandX: number; brandY: number };
};

export const LAYOUTS: Record<Layout["format"], Layout> = {
  landscape: {
    format: "landscape",
    width: 1920,
    height: 1080,
    lowerX: 96,
    lowerY: 984,
    lowerSize: 78,
    hero: { cx: 960, cy: 470, s: 1.4 },
    today: { cx: 630, cy: 515, s: 0.9, win: { x: 210, y: 90, w: 1500, h: 860 }, history: { x: 1110, y: 240, w: 560, h: 300 }, chat: { x: 1110, y: 570, w: 560, h: 300 } },
    ground: { cx: 1120, s: 1.2, ky: 0.4, planeY: [230, 400, 570, 740], labelX: 300, leaderEndX: 764, heartbeat: { x: 300, y: 912, w: 1140 }, engineChip: { x: 1480, y: 886, w: 300 }, confirmChip: { x: 1370, y: 170 } },
    pocket: { phone: { x: 1160, y: 70, w: 460, h: 940 }, miniStart: { cx: 870, cy: 520, s: 0.52 }, copy: { x: 96, y: 300 } },
    feel: { cx: 960, cy: 594, s: 3.4, lens: { x: 430, y: 470, r: 220 }, chip: { x: 96, y: 112 } },
    alone: {
      cx: 640,
      cy: 520,
      s: 1.36,
      card: { x: 1280, y: 110, w: 540, h: 700 },
      plaques: { north: { x: 495, y: 39.2, w: 290, h: 76 }, east: { x: 1030.8, y: 482, w: 244, h: 76 }, south: { x: 982.72, y: 748.48, w: 244, h: 76 }, west: { x: 25.2, y: 482, w: 224, h: 76 } },
      cardInner: { miniCy: 350, urlY: 560, chipsY: 626, miniS: 0.62 },
    },
    depth: { cx: 960, cy: 600, sMul: 1 },
    everywhere: { phone: { x: 150, y: 290, w: 300, h: 580 }, tablet: { x: 560, y: 390, w: 700, h: 500 }, laptop: { x: 1370, y: 360, w: 460, h: 300 }, store: { x: 1430, y: 740 }, brandX: 760, brandY: 42 },
  },
  portrait: {
    format: "portrait",
    width: 1080,
    height: 1920,
    lowerX: 72,
    lowerY: 1760,
    lowerSize: 64,
    hero: { cx: 540, cy: 820, s: 1.6 },
    today: { cx: 540, cy: 760, s: 1.15, win: { x: 60, y: 200, w: 960, h: 1180 }, history: { x: 80, y: 1110, w: 450, h: 250 }, chat: { x: 550, y: 1110, w: 450, h: 250 } },
    ground: { cx: 540, s: 1.1, ky: 0.4, planeY: [520, 720, 920, 1120], labelX: 72, leaderEndX: 212, heartbeat: { x: 72, y: 1300, w: 936 }, engineChip: { x: 708, y: 1230, w: 300 }, confirmChip: { x: 700, y: 330 } }, // portrait ground.* and pocket.copy values are provisional; check when the portrait cut renders (Task 11)
    pocket: { phone: { x: 310, y: 240, w: 460, h: 940 }, miniStart: { cx: 540, cy: 1400, s: 0.52 }, copy: { x: 72, y: 1460 } },
    feel: { cx: 540, cy: 1000, s: 3.2, lens: { x: 300, y: 560, r: 200 }, chip: { x: 72, y: 160 } }, // portrait feel.* values are provisional; check when the portrait cut renders (Task 11)
    alone: {
      cx: 540,
      cy: 560,
      s: 1.2,
      card: { x: 150, y: 1000, w: 780, h: 640 },
      // portrait alone.plaques and alone.cardInner are provisional; check when the portrait cut renders (Task 11)
      plaques: { north: { x: 395, y: 100, w: 290, h: 76 }, east: { x: 820, y: 230, w: 244, h: 76 }, south: { x: 398, y: 912, w: 244, h: 76 }, west: { x: 16, y: 230, w: 224, h: 76 } },
      cardInner: { miniCy: 320, urlY: 510, chipsY: 574, miniS: 0.6 },
    },
    depth: { cx: 540, cy: 900, sMul: 0.56 }, // portrait depth.sMul and everywhere.store are provisional; check when the portrait cut renders (Task 11)
    everywhere: { phone: { x: 110, y: 760, w: 260, h: 520 }, tablet: { x: 420, y: 820, w: 560, h: 400 }, laptop: { x: 300, y: 1300, w: 480, h: 310 }, store: { x: 72, y: 1500 }, brandX: 380, brandY: 160 },
  },
};
