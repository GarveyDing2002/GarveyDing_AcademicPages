# Garvey Academia Preview

This is an isolated Astro Academia preview for Jiawei Ding's academic website. The current public Jekyll site is not modified by this project.

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
- Put post images in `public/images/blog/` and link them from Markdown using `/images/blog/<file>` for the custom-domain deployment.
- Mathematical expressions use standard `$...$` and `$$...$$` delimiters.

## Pages CMS

The `.pages.yml` file defines the blog editor and the matching Astro frontmatter fields. CMS image uploads go to `public/images/blog/`.

## Current review status

Obsidian documents and their images are intentionally not included yet. Review the generated Obsidian article list in the Codex task output and approve the notes before migration. The academic CV and publication data were copied from the existing local Academic Pages project; deployment to GitHub Pages and the custom domain has not been performed.

## Checks

```sh
npm run check
npm test
npm run lint
npm run build
```
