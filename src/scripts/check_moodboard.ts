import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
const projectId = process.argv[2];
if (!projectId) {
  console.error('Usage: ts-node src/scripts/check_moodboard.ts <projectId>');
  process.exit(1);
}

(async () => {
  const { data, error } = await supabase
    .from('moodboard_items')
    .select('*')
    .eq('project_id', projectId);
  if (error) {
    console.error('Error fetching moodboard items:', error);
    process.exit(1);
  }
  console.log('Moodboard items for project', projectId, ':', data);
})();
