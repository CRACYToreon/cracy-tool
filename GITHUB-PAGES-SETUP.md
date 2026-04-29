# Deploying to GitHub Pages

This tool is a pure static site and works on GitHub Pages out of the box.

## Steps

1. **Create a GitHub repository** (e.g. `cracy-tool`)
2. **Push all these files** to the `main` (or `master`) branch:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/cracy-tool.git
   git push -u origin main
   ```
3. **Enable GitHub Pages** in your repo:
   - Go to **Settings → Pages**
   - Under *Source*, select **Deploy from a branch**
   - Branch: `main`, folder: `/ (root)`
   - Click **Save**
4. After ~1–2 minutes your site will be live at:
   `https://YOUR_USERNAME.github.io/cracy-tool/`

## Notes

- The `.nojekyll` file (already included) tells GitHub Pages to skip Jekyll processing — important for sites with underscored folders.
- No build step needed — this is plain HTML/CSS/JS.
- The `fetch()` calls in `js/app.js` use relative paths and work correctly when served from GitHub Pages.
