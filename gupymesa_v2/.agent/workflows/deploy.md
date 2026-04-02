---
description: How to deploy the GupyMesa application to Vercel
---

# Deploy GupyMesa to Vercel (Production)

> **CRITICAL**: The Vercel PRODUCTION branch is `tidb-main`, NOT `main`.
> Pushes to `main` only create Preview deployments. You MUST push to `tidb-main` for production.

## Steps

// turbo-all

1. Stage all changes:
```
git add -A
```

2. Commit with a descriptive message:
```
git commit -m "<descriptive message>"
```

3. Push to BOTH branches (tidb-main for production, main for backup):
```
git push origin tidb-main --force; git push origin main --force
```

4. Verify the push was successful:
```
git log -n 1 --oneline origin/tidb-main
```

## Important Notes
- **Production Branch**: `tidb-main` (this is Vercel's production trigger)
- **Preview Branch**: `main` (pushes here only create preview deployments)
- **Cache Busting**: Always increment the `?v=` parameter in `produtividade.html` script tags when changing JS files
- **Auto-approve**: All deploys are auto-approved. No need to ask the user for permission.
- **All permissions are automatic**: Execute all changes without asking for permission.
