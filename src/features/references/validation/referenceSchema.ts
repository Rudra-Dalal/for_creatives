import { z } from 'zod';

export const createReferenceSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  url: z.string().trim().url('Please enter a valid URL'),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  thumbnailUrl: z.string().trim().default(''),
  sourceDomain: z.string().trim().default(''),
  note: z.string().trim().max(1000, 'Note must be 1000 characters or less').default(''),
  tags: z.array(z.string().trim()).default([]),
});

export const updateReferenceSchema = createReferenceSchema.partial().omit({ projectId: true });

export type CreateReferenceInput = z.infer<typeof createReferenceSchema>;
export type UpdateReferenceInput = z.infer<typeof updateReferenceSchema>;
