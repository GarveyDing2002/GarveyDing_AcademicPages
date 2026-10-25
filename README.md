# GarveyDing Academic Pages

Astro Academia personal academic website.

Jiawei Ding's academic website, published at https://garveyding2002.github.io/GarveyDing_AcademicPages/.

## Deployment

GitHub Pages uses GitHub Actions. Pushing to `main` runs `.github/workflows/deploy.yml` to build and publish the site. The site origin and repository base path are configured in `src/settings.ts`. No custom domain is configured.

## Local preview

Use Node.js `26.3.0` as recorded in `.nvmrc`, then run:

```sh
npm ci
npm run dev
```

## Website content

- Update the profile and social links in `src/settings.ts`.
- Update education, interests, skills and publications in `src/data/cv.ts`.
- Add Markdown posts under `src/content/BlogPosts/` with `title`, quoted `date` (`YYYY-MM-DD`), `excerpt`, and optional `tags` frontmatter.
- Put post images in `public/images/blog/` and link them from Markdown using `/GarveyDing_AcademicPages/images/blog/<file>`.
- Mathematical expressions use standard `$...$` and `$$...$$` delimiters.

## Pages CMS

The `.pages.yml` file defines the blog editor and the matching Astro frontmatter fields. CMS image uploads go to `public/images/blog/`.

## Imported learning notes

The Blog includes 15 learning notes (including the reading index), 32 images and two reference attachments. Obsidian links resolve to published articles and assets. Source files remain unchanged; `content-import-manifest.json` records their relative paths and SHA-256 hashes.

The importer defaults to a dry run. Pass the learning-notes folder as its argument and add `--write` to write the generated content. It refuses to overwrite differing existing files. It preserves formulas and fenced code, normalizes display-math delimiters, and removes machine-specific paths from the public figure provenance JSON.

```sh
node scripts/import-learning-notes.mjs "<learning-notes-folder>"
```

Mermaid diagrams render on article pages only. The build verification checks all imported article URLs, anchors, images, contact links and KaTeX output before deployment.

## Checks

```sh
npm run check
npm test
npm run lint
npm run build
npm run verify:blog
```
