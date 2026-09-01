'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { projectService } from '../services/projectService';
import type { Project } from '../types';
import { Link2, Copy, Check, ShieldAlert, Loader2, Globe, Trash2 } from 'lucide-react';

interface ShareProjectModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onUpdateProject?: (updated: Project) => void;
}

export function ShareProjectModal({
  project,
  isOpen,
  onClose,
  onUpdateProject,
}: ShareProjectModalProps) {
  const [shareToken, setShareToken] = useState<string | null>(project.share_token || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync token with project
  React.useEffect(() => {
    setShareToken(project.share_token || null);
    setError(null);
    setIsCopied(false);
  }, [project]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = shareToken ? `${origin}/share/${shareToken}` : '';

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const token = await projectService.generateShareToken(project.id);
      setShareToken(token);
      onUpdateProject?.({ ...project, share_token: token });
    } catch {
      setError('Failed to generate share link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!confirm('Are you sure you want to revoke this share link? Anyone with the link will immediately lose access.')) {
      return;
    }

    setIsRevoking(true);
    setError(null);
    try {
      await projectService.revokeShareToken(project.id);
      setShareToken(null);
      onUpdateProject?.({ ...project, share_token: null });
    } catch {
      setError('Failed to revoke share link');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 gap-5 border-border bg-surface shadow-floating">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-accent" />
            <DialogTitle className="text-base font-medium">Read-Only Share Link</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Share a read-only presentation of this project without granting edit permissions.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-danger/10 border border-danger/30 text-red-400 text-xs">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {shareToken ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Share URL</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  className="font-mono text-xs bg-surface-subtle"
                />
                <Button
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0 gap-1.5 text-xs font-medium"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-white" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-subtle p-3 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 text-foreground font-medium">
                <Globe className="h-3.5 w-3.5 text-accent" />
                <span>Read-only access is active</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Anyone with this link can view references, the moodboard canvas, and creative direction. They cannot make edits or add content.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-border">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleRevokeLink}
                disabled={isRevoking}
                className="gap-1.5 text-xs"
              >
                {isRevoking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                <span>Revoke Access</span>
              </Button>

              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              No public share link is currently active for &ldquo;{project.name}&rdquo;. Generating a link will create a unique, private URL for external review.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Cancel
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleGenerateLink}
                disabled={isGenerating}
                className="gap-1.5 text-xs font-medium bg-accent text-white hover:bg-accent-hover"
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                <span>Generate Share Link</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
