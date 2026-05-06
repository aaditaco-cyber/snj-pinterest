# SNJ Pinterest

Mobile-first wholesale jewelry trend and product discovery. Swipe through new arrivals from monitored retailers, save promising styles into client/folder buckets, and curate notes for buyer conversations.

## What's working in v0

- **Tinder-style swipe deck** of new-arrival products with visible Skip / Save / Undo buttons
- **Save into multiple folders** — color-coded buckets like Trends, Bridal Ideas, client names; one product can live in many folders
- **Folder views** with thumbnails, counts, per-product notes, rename/delete
- **Source management** — list of jewelry sites you want monitored, with active/inactive toggle and notes
- **Settings** — stats, restore-skipped, full reset
- **Mobile PWA** — save to phone home screen for full-screen, no-browser-chrome experience
- **Keyboard shortcuts** on desktop: `←` skip, `→` save, `↑` undo
- **Local persistence** — everything saves to your browser's localStorage; survives refresh

The seed data has 32 mock products across 10 retailers (Blue Nile, Brilliant Earth, Mejuri, Aurate, etc.) so the app is fully functional on first run.

## What's coming next

1. **Manual product import** — paste a product URL, the app fetches OG metadata, adds it to the deck
2. **Per-site scrapers** — one adapter per retailer (Blue Nile, Brilliant Earth, etc.) to auto-pull new arrivals
3. **Cloud sync** — swap localStorage for Supabase so the same data appears on phone + laptop
4. **Search & filter** across all saved products (price range, retailer, notes)
5. **Export folder** as JSON / CSV / PDF lookbook for client meetings

## Run it locally

```bash
cd snj-pinterest
npm install        # only first time
npm run dev
```

Then open http://localhost:3000 (or 3001 if 3000 is busy).

Other scripts:
- `npm run build` — production build (verifies typecheck + bundles)
- `npm run start` — serve the production build
- `npm run typecheck` — TypeScript check, no emit

## Deploy to Vercel

This project has its own git repo at `snj-pinterest/.git`. To deploy:

1. **Create a GitHub repo** (one-time):
   - Go to https://github.com/new
   - Name it `snj-pinterest` (or anything you like)
   - Leave it empty (no README, no .gitignore)
   - Click Create

2. **Push this code to it:**
   ```bash
   cd snj-pinterest
   git remote add origin https://github.com/<your-username>/snj-pinterest.git
   git branch -M main
   git push -u origin main
   ```

3. **Import to Vercel:**
   - Go to https://vercel.com/new
   - Pick the `snj-pinterest` repo
   - Accept all defaults (Next.js auto-detected)
   - Click Deploy

That's it. Vercel will give you a URL like `snj-pinterest.vercel.app`. Open it on your phone and tap "Add to Home Screen" in Safari/Chrome share menu to install as a PWA.

Subsequent deploys: just `git push origin main` — Vercel auto-deploys.

## Tech stack

- [Next.js 16](https://nextjs.org) — App Router, Turbopack, Server Components
- [React 19](https://react.dev)
- [Tailwind CSS 4](https://tailwindcss.com) — CSS-first config via `@theme`
- [Zustand 5](https://github.com/pmndrs/zustand) — client state with `persist` middleware → localStorage
- [Motion](https://motion.dev) (framer-motion successor) — swipe gestures and card animations
- [Lucide](https://lucide.dev) — icons
- TypeScript strict mode

## Project structure

```
snj-pinterest/
├── app/
│   ├── layout.tsx           Root layout, metadata, bottom nav, viewport
│   ├── page.tsx             Discover (home) — swipe deck
│   ├── folders/
│   │   ├── page.tsx         Folders index — grid with thumbnails + counts
│   │   └── [id]/page.tsx    Folder detail — products + notes
│   ├── sources/page.tsx     Source website management
│   ├── settings/page.tsx    Stats, skipped restore, reset
│   ├── icon.svg             Favicon (charcoal + champagne S monogram)
│   ├── apple-icon.tsx       180x180 iOS home-screen icon (generated)
│   ├── manifest.ts          PWA manifest
│   └── globals.css          Tailwind theme tokens
├── components/
│   ├── SwipeDeck.tsx        Stack of cards + action buttons
│   ├── SwipeCard.tsx        Single draggable product card
│   ├── SaveSheet.tsx        Bottom-sheet folder picker (after a save)
│   ├── BottomNav.tsx        4-tab navigation (Discover/Folders/Sources/Settings)
│   ├── CategoryFilter.tsx   Horizontal scrolling chip row
│   ├── NewFolderForm.tsx    Inline create-folder form with color picker
│   └── Badge.tsx            Reusable info chip
└── lib/
    ├── types.ts             All TypeScript types
    ├── categories.ts        Category constants + folder color palette
    ├── seed.ts              10 sources, 10 folders, 32 mock products
    └── store.ts             Zustand store with localStorage persistence
```

## Notes for the next session

- All product images in seed data are placeholders from `picsum.photos`. They'll be replaced with real product images as we wire up ingestion.
- The store has a clean abstraction for swipe actions, so swapping localStorage for cloud sync (Supabase) later is contained to `lib/store.ts`.
- When adding real data ingestion, write per-site adapters under a new `lib/ingest/` directory and have each return `Omit<Product, "id" | "dateDiscovered" | "status">[]`. The store's `addProduct` accepts that shape.
