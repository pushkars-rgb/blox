export interface Project {
  id: string
  name: string
  componentCount: number
  lastEdited: string
  colors: [string, string, string]
  primaryColor: string
}

export const projects: Project[] = [
  {
    id: 'sunrise-ui',
    name: 'Sunrise UI',
    componentCount: 14,
    lastEdited: '2 days ago',
    colors: ['#F97316', '#FB923C', '#FCD34D'],
    primaryColor: '#F97316',
  },
  {
    id: 'midnight-ds',
    name: 'Midnight DS',
    componentCount: 8,
    lastEdited: '5 days ago',
    colors: ['#1E3A5F', '#3B5998', '#6366F1'],
    primaryColor: '#3B5998',
  },
  {
    id: 'forest-kit',
    name: 'Forest Kit',
    componentCount: 11,
    lastEdited: '1 day ago',
    colors: ['#16A34A', '#0D9488', '#4ADE80'],
    primaryColor: '#16A34A',
  },
  {
    id: 'blush-design',
    name: 'Blush Design',
    componentCount: 6,
    lastEdited: '3 days ago',
    colors: ['#F43F5E', '#FB7185', '#FBBF24'],
    primaryColor: '#F43F5E',
  },
  {
    id: 'slate-system',
    name: 'Slate System',
    componentCount: 19,
    lastEdited: '6 hours ago',
    colors: ['#475569', '#64748B', '#94A3B8'],
    primaryColor: '#475569',
  },
  {
    id: 'aurora-ds',
    name: 'Aurora DS',
    componentCount: 9,
    lastEdited: '4 days ago',
    colors: ['#7C3AED', '#A855F7', '#C084FC'],
    primaryColor: '#7C3AED',
  },
]
