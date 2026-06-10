import { z } from "zod";

export const articleParamsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Invalid slug format. Use lowercase-hyphenated slugs."),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().min(1).max(200).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export const generateBodySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Invalid slug format"),
});

export const authHeaderSchema = z.object({
  "x-api-key": z.string().min(1).optional(),
});
