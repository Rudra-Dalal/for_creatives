import { z } from 'zod';

export const createMoodboardItemSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  referenceId: z.string().uuid('Invalid reference ID').nullable().optional(),
  type: z.enum(['reference', 'image', 'text', 'color', 'idea']),
  content: z.record(z.any()).default({}),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().positive().default(300),
  height: z.number().positive().default(220),
  zIndex: z.number().int().default(1),
});

export const updateMoodboardItemSchema = z.object({
  content: z.record(z.any()).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  zIndex: z.number().int().optional(),
});

export type CreateMoodboardItemInput = z.infer<typeof createMoodboardItemSchema>;
export type UpdateMoodboardItemInput = z.infer<typeof updateMoodboardItemSchema>;
