#!/bin/sh
set -e

git diff --exit-code
npm run package
git push
git push --tags
gh-release
