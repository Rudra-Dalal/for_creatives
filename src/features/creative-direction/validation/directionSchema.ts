import { z } from 'zod';

export const createDirectionSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z
    .string()
    .trim()
    .min(1, 'Direction title is required')
    .max(200, 'Title must be 200 characters or less'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be 2000 characters or less')
    .default(''),
  referenceIds: z.array(z.string().uuid()).default([]),
});

export const updateDirectionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Direction title is required')
    .max(200, 'Title must be 200 characters or less')
    .optional(),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be 2000 characters or less')
    .optional(),
  referenceIds: z.array(z.string().uuid()).optional(),
});

export const linkReferenceSchema = z.object({
  directionNoteId: z.string().uuid('Invalid direction note ID'),
  referenceId: z.string().uuid('Invalid reference ID'),
});

export type CreateDirectionInput = z.infer<typeof createDirectionSchema>;
export type UpdateDirectionInput = z.infer<typeof updateDirectionSchema>;
export type LinkReferenceInput = z.infer<typeof linkReferenceSchema>;
