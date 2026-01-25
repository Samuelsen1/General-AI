#!/bin/bash
# Run this in Terminal to push the AI to your General-AI repo:
#   chmod +x /Users/macbook/ai-assistant-site/push-to-github.sh
#   /Users/macbook/ai-assistant-site/push-to-github.sh

set -e
cd /Users/macbook/ai-assistant-site

# Get GitHub username
if [ -n "$GITHUB_USER" ]; then
  GH_USER="$GITHUB_USER"
else
  read -p "Your GitHub username: " GH_USER
fi

if [ -z "$GH_USER" ]; then
  echo "Need GitHub username. Run: GITHUB_USER=yourusername $0"
  exit 1
fi

echo "→ git init"
git init

echo "→ git add ."
git add .

echo "→ git commit"
git commit -m "Initial: AI Assistant"

echo "→ git remote add origin"
git remote add origin "https://github.com/${GH_USER}/General-AI.git"

echo "→ git branch -M main && git push -u origin main"
git branch -M main
git push -u origin main

echo ""
echo "Done. Repo: https://github.com/${GH_USER}/General-AI"
