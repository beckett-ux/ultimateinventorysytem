# Shopify OAuth redirect mismatch: rollback target

First introducing commit: fb7bed273b75930007eca20b78d2c4bdcf476ce5 fix: enforce canonical OAuth redirect_uri

Last commit before changes (target rollback): 5e1fe5601ac781fa74b93fcc9e11b1e899e97c52 Merge pull request #64 from beckett-ux/fix/oauth-return-to-embedded

## Reasoning

- `app/api/shopify/auth/route.js`: `git log --reverse -S 'searchParams.set' -- app/api/shopify/auth/route.js | head -n 1` returns `fb7bed2...`, the first commit that rewrites `redirect_uri` in the begin flow.
- Related follow-on commits for callback origin/callback URL and the diagnostics endpoint land after `fb7bed2...` when filtering to the scoped paths:
  - `lib/shopify.js` / `.env.example`: `git log --reverse -G 'SHOPIFY_OAUTH_CALLBACK_URL' -- lib/shopify.js .env.example | head -n 1`
  - `app/api/shopify/diagnostics/route.js`: `git log --reverse --diff-filter=A -- app/api/shopify/diagnostics/route.js | head -n 1`

## Acceptance / Verification

Run these and confirm the hashes match this doc and the PR body:

1. `git show -s --format='%H %s' fb7bed273b75930007eca20b78d2c4bdcf476ce5`
2. `git show -s --format='%H %s' 5e1fe5601ac781fa74b93fcc9e11b1e899e97c52`
3. `git log --reverse -S 'searchParams.set' -- app/api/shopify/auth/route.js | head -n 1`
4. `git log --reverse -G 'SHOPIFY_OAUTH_CALLBACK_URL' -- lib/shopify.js .env.example | head -n 1`
