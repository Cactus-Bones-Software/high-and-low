# Project Overview

What the High & Low app is — a local-first mood-tracking PWA for bipolar/unipolar cycles.

**High & Low** is a local-first, offline-capable PWA for rapid, friction-free tracking of bipolar and unipolar mood cycles. Vanilla HTML/CSS/ES6, no build step, no dependencies, no accounts/cloud — all data stays on-device in IndexedDB (`config` + `logs` stores; ISO-8601 timestamps as keys, human-readable for debugging).

Design philosophy: zero friction, reduced cognitive load (1–5 scales, not 1–10), tracks BOTH depressive (low) and manic/hypomanic (high) poles, and an always-available touch-safe "Skip the Rest" escape hatch for the lowest-energy days. Big full-width vertically-stacked tap targets for low motor control. 220ms orthogonal slide transitions. Themed (dark/light × low/high contrast).

Owner is building this as a genuine mental-health tool and plans to seek accessibility-expert and psychiatrist consultation (grant/volunteers) before finalizing sensitive choices. See [Design decisions](design-decisions.md) for locked design decisions and open questions.
