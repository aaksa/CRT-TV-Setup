# Case File 77-1023 — interactive CRT evidence room

A dark, cinematic three.js scene built from the Blender composition in
`Small CRT TV.blend`: a vintage CRT television with a working remote, and a
cork evidence board with pinned documents you can read.

```bash
npm install
npm run dev      # http://localhost:5178
npm run build    # static site in dist/ (relative paths — host anywhere)
```

## Interactions

| Where | Do | Result |
| --- | --- | --- |
| Room | hover the TV / board | warm outline, TV brightens |
| Room | click the TV | camera moves in, the remote rises into your hand |
| TV | click remote buttons | `0–9` tune, `CH ±` / `▲▼` step, `VOL ±` / `◀▶` volume, `MUTE`, `POWER`, `PREV`, `INPUT`, `INFO`/`OK` |
| TV | keyboard | `↑↓` channel, `←→` volume, digits, `P` power, `M` mute |
| Room | click the board | close-up of the whole board |
| Board | hover / click a document | it lifts; click zooms to read it |
| Anywhere | click the dark, right-click, `Esc` | step back one level |

The TV starts on the AV input with **TIDAK ADA SINYAL** over analog snow.
Channel 1 plays real footage (`public/videos/ch1.mp4`, with sound); 2–7 are
placeholder programmes of a fictional Indonesian station,
**TVSN · Televisi Swara Nusantara**; 0, 8 and 9 are dead air.

| CH | Programme |
| --- | --- |
| 1 | *Film Animasi* — your clip, lightly letterboxed (`fit: 0.5` in `src/crt.js`), with pop-up Indonesian subtitles from `public/subtitles/ch1.id.vtt`; restarts from 0:00 every time you tune in (`restart: true`) |
| 2 | *Berita Malam* with a *Sekilas Info* crawl (stories mirror the board) |
| 3 | *Prakiraan Cuaca* over a map of Indonesia (illustrative values) |
| 4 | *Penutup siaran* — Merah Putih, *Selamat malam, sampai jumpa esok hari* |
| 5 | *Pagelaran Wayang Kulit Semalam Suri* |
| 6 | *Kamera Pantau* Anak Krakatau, Level III (Siaga) |
| 7 | test card — *Mohon maaf, ada gangguan teknis* |

## How it works

- **`src/crt.js`** — the picture is rendered into a render target by a CRT
  shader (tube bulge, scanlines, aperture grille, RGB separation, snow,
  flicker, rolling/tearing glitches, power-off collapse) and applied as the
  tube's emissive map. A 1×1 average of the picture drives a `RectAreaLight`
  over the glass, so the screen lights the crates, bucket, radio and floor in
  whatever colour it shows.
- **`src/remote.js`** — the rigged remote was baked in Blender into one mesh
  per button (`RBTN_<LABEL>`), so buttons are raycast, glow on hover and
  physically press. VOL/CH rockers read which half you hit.
- **`src/board.js` + `src/papers.js`** — documents are drawn procedurally on
  canvases (typewriter text, handwriting, stamps, halftone, B&W grain), pinned
  with slight curl, push pins and red string. The surveillance photo is a
  real render of this room taken at load time.
- **`src/environment.js`** — concrete room, swaying hanging lamp (moving
  shadows), board light, moonlight rim, visible beam and lit dust.
- **`src/main.js`** — loading, post (outline → bloom → output → grain,
  vignette, chromatic aberration), view state machine and input.
- **`src/audio.js`** — all sound is synthesised (static bursts, hum, clicks,
  room tone); it starts on the "step inside" click.

## Replacing placeholder content

- **Channels:** drop videos into `public/videos/` and edit `CHANNELS` in
  `src/crt.js`. 4:3 footage fits the tube best; audio tracks play and follow
  the remote's volume. Add `subtitles: 'subtitles/<file>.vtt'` (WebVTT) to a
  channel for pop-up captions under the TV in the room and TV views.
- **Evidence:** edit `EVIDENCE` / `STRINGS` in `src/papers.js` (position in
  metres on the cork, size, rotation, pin colour). Each item's `draw()`
  returns a canvas — return one with a scanned image drawn into it to use real
  documents.
- **Scene:** re-export after changing the Blender scene. Save a *copy* of the
  .blend first (the script deletes unused objects), then:

  ```bash
  /Applications/Blender.app/Contents/MacOS/Blender -b /path/to/copy.blend \
    --python tools/export_scene.py -- "$PWD/public/models/room.glb"
  ```

  The script keeps the props in the composition, names them, splits the remote
  into buttons, decimates the 2M-triangle corkboard and writes a Draco/WebP GLB.
  Object names it expects are listed at the top of `tools/export_scene.py`.
- **News pictures** ship as JPEG in `public/images/news/`; the full-size PNG
  originals are kept in `source-assets/news/` (not part of the site).
- **Placeholder clips** are drawn by `tools/make_channels.py` (Pillow + ffmpeg,
  macOS system fonts): `npm run videos`, or `python3 tools/make_channels.py 2 3`
  for single channels. Headlines and the crawl text live at the top of each
  channel function. The *Krisis BBM Makassar* picture (board card + CH 2 slide)
  is a drawn placeholder from `tools/draw_bbm_illustration.py`; overwrite
  `public/images/news/krisis-bbm-makassar-2026.jpg` with a real photo and
  re-run `python3 tools/make_channels.py 2`.

CH 1 is third-party footage supplied for this build — check you have the
rights before publishing the site. The TVSN station and its programmes are
fictional; the board's news cards cite real reports.
