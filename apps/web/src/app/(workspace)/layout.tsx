import { type ReactNode } from 'react';
import { WorkspaceGuard } from '@/components/workspace/workspace-guard';

/**
 * The workspace route group renders without the app chrome: the studio shell
 * owns the full viewport. Only the auth gate is shared with `(app)`.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceGuard>{children}</WorkspaceGuard>;
}
