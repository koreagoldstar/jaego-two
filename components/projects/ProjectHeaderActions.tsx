'use client'

import { ProjectDeleteButton } from '@/components/projects/ProjectDeleteButton'
import { ProjectRenameInline } from '@/components/projects/ProjectRenameInline'

export function ProjectHeaderActions({ projectName }: { projectName: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 shrink-0">
      <ProjectRenameInline projectName={projectName} />
      <ProjectDeleteButton projectName={projectName} />
    </span>
  )
}
