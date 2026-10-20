#!/usr/bin/env bash
# Gera o app e publica a pasta dist/ no branch gh-pages (GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Publicar Nina Book's"
git push -f "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
