import fs from 'fs/promises'
import path from 'path'
import type { Project } from './types'

const PROJECTS_DIR = path.join(process.cwd(), 'content', 'projects')

export async function getProjects(): Promise<Project[]> {
  try {
    const files = await fs.readdir(PROJECTS_DIR)
    const jsonFiles = files.filter((f) => f.endsWith('.json'))

    const projects = await Promise.all(
      jsonFiles.map(async (filename) => {
        const filePath = path.join(PROJECTS_DIR, filename)
        const raw = await fs.readFile(filePath, 'utf-8')
        const data = JSON.parse(raw)
        return {
          ...data,
          slug: filename.replace(/\.json$/, ''),
        } as Project
      })
    )

    return projects
  } catch {
    return []
  }
}
