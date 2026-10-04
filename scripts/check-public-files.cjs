// Heuristic pre-handoff check of tracked + unignored files. Never prints secret values.
const { execFileSync } = require('node:child_process');
const { readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const candidates = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const findings = [];
for (const name of new Set(candidates)) {
  if (/(^|\/)(\.local|node_modules|\.next|\.test-build|uploads|data|minio-data)(\/|$)/.test(name) || /(^|\/)\.env(?:\..*)?$/.test(name) && !name.endsWith('.env.example') || /\.(dump|pem|key|p12|pfx)$/i.test(name)) {
    findings.push(`${name}: private/generated file in Git candidate set`);
    continue;
  }
  const absolute = path.join(root, name);
  let content;
  try {
    if (!statSync(absolute).isFile() || statSync(absolute).size > 2_000_000) continue;
    content = readFileSync(absolute, 'utf8');
  } catch { continue; } // deleted tracked file
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) findings.push(`${name}: private key marker`);
  if (/\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,}|AKIA[A-Z0-9]{16})\b/.test(content)) findings.push(`${name}: credential-like token`);
}
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else console.log(`PASS: ${new Set(candidates).size} Git candidate files checked; no private paths or recognized credential patterns. This is not a full secret/security audit.`);
