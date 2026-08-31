import { createClient } from '@/lib/supabase/client';
import { resizeImageForThumbnail } from '@/lib/utils/image';

export const thumbnailService = {
  /**
   * Compresses an image on the client to ~400px wide WebP
   * and uploads it to Supabase Storage scoped to the project folder.
   */
  async uploadThumbnail(projectId: string, file: File | Blob): Promise<string> {
    const supabase = createClient();

    // 1. Compress image to max 400px width WebP
    const compressedBlob = await resizeImageForThumbnail(file, 400, 0.82);

    // 2. Generate unique storage path: {projectId}/{timestamp}-{random}.webp
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`;
    const filePath = `${projectId}/${filename}`;

    // 3. Upload to Supabase Storage 'thumbnails' bucket
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(filePath, compressedBlob, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // 4. Retrieve public URL or persistent URL
    const { data } = supabase.storage.from('thumbnails').getPublicUrl(filePath);
    return data.publicUrl;
  },

  /**
   * Deletes a thumbnail from storage given its path.
   */
  async deleteThumbnail(filePath: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.storage
      .from('thumbnails')
      .remove([filePath]);

    if (error) throw error;
  },
};
