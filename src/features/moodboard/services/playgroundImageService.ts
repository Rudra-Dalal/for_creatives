import { createClient } from '@/lib/supabase/client';
import { resizeImageForPlayground } from '@/lib/utils/image';

export interface UploadedPlaygroundImage {
  url: string;
  width: number;
  height: number;
  fileName: string;
}

export const playgroundImageService = {
  /**
   * Compresses an image on the client to high-res WebP (~1200px max)
   * and uploads it to Supabase Storage scoped to the project folder.
   */
  async uploadPlaygroundImage(
    projectId: string,
    file: File | Blob,
    originalName?: string
  ): Promise<UploadedPlaygroundImage> {
    const supabase = createClient();

    // 1. Compress image to max 1200px preserving natural aspect ratio
    const { blob, width, height } = await resizeImageForPlayground(file, 1200, 0.85);

    // 2. Generate unique storage path: {projectId}/playground/{timestamp}-{random}.webp
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`;
    const filePath = `${projectId}/playground/${filename}`;

    // Diagnostic check for live owner verification
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const { data: projectRow, error: projectFetchError } = await supabase
      .from('projects')
      .select('id, user_id, name')
      .eq('id', projectId)
      .maybeSingle();

    console.log('[STORAGE_UPLOAD_CHECK]', {
      authUid: currentUser?.id ?? null,
      authEmail: currentUser?.email ?? null,
      sessionValid: !!currentSession,
      sessionTokenExpiresAt: currentSession?.expires_at ? new Date(currentSession.expires_at * 1000).toISOString() : null,
      projectId,
      projectRecord: projectRow ?? null,
      projectFetchError: projectFetchError ? { message: projectFetchError.message, code: projectFetchError.code } : null,
      projectUserId: projectRow?.user_id ?? null,
      isOwnerMatch: currentUser?.id && projectRow?.user_id ? currentUser.id === projectRow.user_id : false,
      filePath,
      bucket: 'thumbnails',
    });

    // 3. Upload to Supabase Storage 'thumbnails' bucket
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(filePath, blob, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) {
      const errObj = uploadError as { statusCode?: string | number; error?: string; message?: string };
      const status = errObj.statusCode ? `[${errObj.statusCode}] ` : '';
      const details = errObj.error ? ` (${errObj.error})` : '';
      const message = errObj.message || 'Storage upload rejected';
      throw new Error(`${status}${message}${details}`);
    }

    // 4. Retrieve public URL
    const { data } = supabase.storage.from('thumbnails').getPublicUrl(filePath);

    return {
      url: data.publicUrl,
      width,
      height,
      fileName: originalName || (file instanceof File ? file.name : 'image.webp'),
    };
  },
};
