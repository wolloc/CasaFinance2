import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.join(process.cwd(), 'dist');
const outputPath = path.join(distDir, 'release-manifest.json');
const commitSha = (process.env.GITHUB_SHA || process.env.RELEASE_COMMIT_SHA || '').trim();
const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();

if (!commitSha) {
  console.error('[release-manifest] GITHUB_SHA or RELEASE_COMMIT_SHA is required.');
  process.exit(1);
}

let supabaseOrigin;
try {
  supabaseOrigin = new URL(supabaseUrl).origin;
} catch {
  console.error('[release-manifest] VITE_SUPABASE_URL must be a valid URL.');
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error('[release-manifest] dist/ does not exist. Run the production build first.');
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(absolute);
      if (absolute === outputPath) return [];
      return [absolute];
    });
}

const files = walk(distDir)
  .map((absolute) => {
    const relative = path.relative(distDir, absolute).replaceAll(path.sep, '/');
    const content = fs.readFileSync(absolute);
    return {
      path: relative,
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
      bytes: content.length,
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  schema_version: 1,
  commit_sha: commitSha,
  supabase_origin: supabaseOrigin,
  files,
};

fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[release-manifest] wrote ${files.length} file hashes for ${commitSha}`);
