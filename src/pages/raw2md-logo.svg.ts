import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { docsDir } from '../pipeline/pages';

/** The logo comes from the public tree, so the site has no copy of its own. */
export const GET: APIRoute = () =>
  new Response(
    fs.readFileSync(path.join(docsDir(), 'docs/assets/raw2md-logo.svg')),
    { headers: { 'Content-Type': 'image/svg+xml' } },
  );
