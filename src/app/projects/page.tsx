import { getProjects } from '@/lib/projects'
import { FadeUp } from '@/components/FadeUp'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Projects',
  description: '项目作品',
}

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <FadeUp>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Projects</h1>
        <p className="text-gray-500 mb-10">我的项目作品</p>
      </FadeUp>

      {projects.length === 0 ? (
        <p className="text-gray-400 text-center py-20">No projects yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {projects.map((project, i) => (
            <FadeUp key={project.slug} delay={i * 0.1}>
              <div className="rounded-xl border border-gray-100 bg-white p-6 hover:shadow-md hover:scale-[1.02] transition-all duration-300">
                {project.image && (
                  <div className="mb-4 -mx-6 -mt-6 rounded-t-xl overflow-hidden bg-gray-100 aspect-video">
                    <img
                      src={project.image}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {project.name}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {project.description}
                </p>
                <div className="flex gap-1.5 flex-wrap mb-4">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-md bg-brand-50 text-brand-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex gap-3">
                  {project.links.live && (
                    <a
                      href={project.links.live}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-brand hover:text-brand-600 transition-colors"
                    >
                      Live &rarr;
                    </a>
                  )}
                  {project.links.github && (
                    <a
                      href={project.links.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      GitHub &rarr;
                    </a>
                  )}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      )}
    </div>
  )
}
