# AlDoy Athlete Hub — Built to Move

A static, Apple-inspired motion site for **AlDoy Athlete Hub** in City Walk Riffa, Bahrain. The experience opens on a scroll-scrubbed walkthrough of the real hub, then moves through an editorial overview, the four programmes, the Gorilla Grit Method, a scroll-lit manifesto, a pinned gallery of the space, the coaching team and a visit card.

No build step, no framework, no dependencies.

## Preview locally

The hero video is scrubbed by scroll, which needs **HTTP Range** support. Python's built-in `http.server` does not send it, so the video will sit on its first frame. Use the bundled server instead:

```bash
python serve.py          # http://localhost:8123
python serve.py 8000     # custom port
```

`serve.py` is a small stdlib server that adds `206 Partial Content` responses for media and fonts. The site also works by opening `index.html` directly, and behaves correctly on Vercel (which supports ranges natively).

## Deploy to Vercel

1. Import the folder or its GitHub repository into Vercel.
2. Choose **Other** / static project if prompted.
3. Leave the build command empty and set the output directory to `.`.
4. Deploy.

## What’s included

- **Scroll-scrubbed cinema** — the real 10-second hub walkthrough (exterior → Pilates studio → Alpha Tribe wall → strength floor) is pinned and seeked from scroll progress, with three chapter transitions, a timecode and progress rail. The clip is encoded at 1080×1920 / 24 fps with a keyframe every 4 frames so each seek costs ~13 ms instead of ~50–70 ms; seeks are issued only when the decoder is idle and the target frame is buffered.
- **Editorial intro** — oversized type, coordinates, key numbers, an Arabic line and a slow discipline ticker.
- **Programme bento** — four responsive cards for Strength & Fitness, Martial Arts, Reformer Pilates and Gymnastics, with image parallax, cursor spotlight and Arabic labels set in IBM Plex Sans Arabic.
- **The Gorilla Grit Method** — Miles In, Powerhouse, GG Teams and Build & Burn, presented as a numbered editorial list.
- **Scroll-lit manifesto** — word-by-word highlight driven by viewport position.
- **Pinned horizontal gallery** — five real photographs of the hub move sideways on desktop and become a native swipeable rail on mobile.
- **The people** — founder and coach profiles (Reem Aldoy, Coach Halaa, Coach Bruno Moreira & Coach VJ).
- **Visit card** — real location, hours, phone/WhatsApp, directions and Instagram.
- **Adaptive glass navigation** — dark glass over cinema, cream glass over the light editorial sections, page-progress hairline and a full-screen mobile menu.
- **Reduced-motion support** — scrubbing, pinned galleries, parallax and reveals are disabled or simplified for `prefers-reduced-motion`.
- **Self-hosted type** — Inter Tight (300–700) and IBM Plex Sans Arabic (400–500) are served from `assets/fonts`, so the design never depends on Google Fonts being reachable.

## Files

- `index.html` — semantic page structure and content.
- `styles.css` — design tokens, layout, motion states, responsive rules.
- `script.js` — scroll story, gallery, word highlight, nav, menu and reveals.
- `serve.py` — local preview server with Range support.
- `assets/brand/` — real AlDoy media: `hub-tour.mp4` (5.2 MB, keyframe-dense for scrubbing) + `tour-poster.jpg` (hero), and `exterior`, `training-rig`, `turf-field`, `alpha-wall`, `boxing`, `pilates` stills.
- `assets/fonts/` — self-hosted woff2 files.
- `assets/` — original cinematic clip and stock programme imagery kept for reference.

## Brand details used

- Palette: brand blue `#50cef3`, warm cream `#f1f1ec`, near-black `#050607`.
- Address: City Walk Riffa, Bahrain — `26.1376427, 50.5589714`.
- Hours: open daily, 5:00 AM – 12:00 AM.
- Phone / WhatsApp: `+973 3500 0181`.
- Instagram: `@aldoy_athlete_hub`.

## Notes

- All CTAs currently open WhatsApp with a pre-filled message. Swap in the studio's booking system when a class-level link exists.
- Coach profiles use text only — real portraits would strengthen the section.
- A public timetable (class days/times per discipline) is the biggest remaining content gap; the site deliberately avoids inventing one.
- The video is a single continuous walkthrough, so chapter copy is timed to its scene cuts rather than to separate clips.
- Performance: all section geometry (story, pin, manifesto, light-section ranges, card widths) is measured once and on resize, so the scroll frame only writes styles and never reads layout; the hero fade uses opacity/transform only, and there are no per-frame filters, blend modes or backdrop animations over the film.
- Mobile: iOS throttles `scroll` events during momentum scrolling, so a short rAF watcher keeps the story in sync while the page is moving. The video is also unlocked with a muted play/pause on the first touch, because iOS will not seek a paused video that has never played. After the page is backgrounded, the current scroll position is re-applied.
- This is a standalone design experiment and does not modify the live site.
