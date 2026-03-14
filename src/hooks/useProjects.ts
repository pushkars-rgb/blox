import { useEffect, useState } from 'react'
import { type Project } from '@/data/projects'

const STORAGE_KEY = 'blox_projects'

export default function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return parsed as Project[]
      }
    } catch {
      // fall through to default
    }
    return []
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  }, [projects])

  function addProject(project: Project) {
    setProjects((prev) => [...prev, project])
  }

  function deleteProject(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return { projects, addProject, deleteProject }
}
