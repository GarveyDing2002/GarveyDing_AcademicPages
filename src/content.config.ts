// 1. Import utilities from `astro:content`
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

// 2. Import loader(s)
import { glob } from "astro/loaders";

// 3. Define your collection(s)
const blog = defineCollection({
    loader: glob({
        pattern: "**/*.md",
        base: "./src/content/BlogPosts",
    }),
    schema: z.object({
        title: z.string(),
        date: z.coerce.date().transform((value) => value.toISOString().slice(0, 10)),
        excerpt: z.string(),
        tags: z.array(z.string()).optional(),
    }),
});
// 4. Export a single `collections` object to register your collection(s)
export const collections = { blog };
