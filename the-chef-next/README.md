# The Chef — Luxury Catering & Music

Cinematic dual-identity website for **The Chef**: one side luxury private-chef catering, the other side original music. Converted from the original static HTML/CSS/JS site to **Next.js (App Router) + React + TypeScript**, ready for GitHub → Vercel.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Production check:

```bash
npm run build
npm run start
```

## Deploy: GitHub → Vercel

1. Create a new GitHub repo (e.g. `the-chef`).
2. From this folder:
   ```bash
   git init
   git add .
   git commit -m "The Chef — Next.js site"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/the-chef.git
   git push -u origin main
   ```
3. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
4. Vercel auto-detects Next.js — no settings needed. Click **Deploy**.
5. After deploy, add your custom domain in Vercel → Project → Settings → Domains.

When the final domain is known, update the `TODO` URLs in:
`app/layout.tsx` (metadataBase), `app/sitemap.ts`, `app/robots.ts`.

## Project structure

```
app/
  layout.tsx        # fonts, global metadata, JSON-LD schema
  page.tsx          # homepage (split-screen experience)
  globals.css       # full original stylesheet, preserved
  gallery/page.tsx  # gallery with filters + lightbox
  reviews/page.tsx  # client reviews page
components/
  SplitStage.tsx    # drag / lock / unlock split-screen logic ("use client")
  SplitHandle.tsx   # the DRAG pill handle
  CatererWorld.tsx  # catering side (nav, hero, about)
  RapperWorld.tsx   # music side (nav, hero, about, tracks, shows)
  CatererMenu.tsx   # accordion menu, menu documents, packages, CTA
  MenuModal.tsx     # full-size menu viewer
  GalleryGrid.tsx   # gallery sections + category filtering
  Lightbox.tsx      # fullscreen image viewer
  ReviewsPreview.tsx / ReviewsSection.tsx
  BookingCTA.tsx    # booking call-to-action
  BodyClass.tsx     # helper for page-level body classes
data/
  contact.ts        # ALL contact info lives here — edit once, updates everywhere
  menu.ts           # menu categories, items, documents, packages
  gallery.ts        # gallery images, captions, categories
  reviews.ts        # all client testimonials
public/assets/      # all images
```

## Editing content

- **Phone/email:** `data/contact.ts`
- **Menu items or packages:** `data/menu.ts`
- **Add a gallery photo:** drop the image in `public/assets/`, add an entry in `data/gallery.ts`
- **Add a review:** `data/reviews.ts`
- **Music tracks / show dates:** `components/RapperWorld.tsx` (placeholders, same as original site)

## Known TODOs

- `data/contact.ts` → `MUSIC_EMAIL` is `cheftherapperr@email.com` (looks like a placeholder — confirm the real music booking email).
- Music tracks and show listings are placeholders carried over from the original site.
- Press Kit button links nowhere yet (same as original).
- Future: replace the mailto booking CTA with a form + API route (`app/api/inquiry/route.ts`), keeping the email provider key in a Vercel environment variable — never hardcoded.
