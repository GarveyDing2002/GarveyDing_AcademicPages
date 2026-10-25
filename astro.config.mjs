// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { unified } from "@astrojs/markdown-remark";

import { template } from "./src/settings";

import sitemap from "@astrojs/sitemap";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkDiagrams from "./src/lib/remark-diagrams.mjs";

// https://astro.build/config
export default defineConfig({
    integrations: [react(), sitemap()],
    vite: {
        plugins: [tailwindcss()],
    },
    site: template.website_url,
    base: template.base,
    markdown: {
        processor: unified({
            remarkPlugins: [remarkMath, remarkDiagrams],
            rehypePlugins: [rehypeKatex],
        }),
    },
});
