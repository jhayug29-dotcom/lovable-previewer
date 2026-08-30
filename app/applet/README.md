# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Deploying

The app is platform-agnostic: the frontend is a standard Vite build and the
server runs through Nitro, so the same code deploys to Vercel, Netlify,
Cloudflare or a plain Node server.

### Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Build command `vite build`, output directory `.vercel/output`
   (already set in `vercel.json`, which also pins `NITRO_PRESET=vercel`).
3. Add the environment variables from `.env.example` in
   Project Settings -> Environment Variables.

### Other targets

Set `NITRO_PRESET` to `netlify`, `cloudflare-module` or `node-server` and run
`npm run build`.

### Environment variables

Copy `.env.example` to `.env` for local development. `VITE_*` values are
browser-safe; everything else (service role key, Cashfree secret, Gemini key)
is server-only and must never be prefixed with `VITE_`.

### Media

All images live in `src/assets` as `.jpg` / `.webp` and are imported directly,
so nothing depends on external hosting. `.gitattributes` marks media as binary
so GitHub never corrupts it.
