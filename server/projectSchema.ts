import { z } from 'zod'

const field = (max: number) => z.string().trim().max(max)
export const projectDocsSchema = z.object({
  title: field(160),
  description: field(3000),
  establishment: field(160),
  audience: field(500),
  technologies: field(1000),
  siteUrl: field(500),
  repositoryUrl: field(500),
  codeRef: field(300),
  architecture: field(4000),
  operations: field(4000),
  notes: field(4000),
  aiInstructions: field(6000),
})
export const emptyProjectDocs = (): z.infer<typeof projectDocsSchema> => ({
  title: '',
  description: '',
  establishment: '',
  audience: '',
  technologies: '',
  siteUrl: '',
  repositoryUrl: '',
  codeRef: '',
  architecture: '',
  operations: '',
  notes: '',
  aiInstructions: '',
})
export const captureMetaSchema = z.object({
  title: field(160),
  description: field(500),
  screen: z.enum(['cardapio', 'detalhes', 'carrinho', 'editor', 'outra']),
  device: z.enum(['mobile', 'desktop']),
  mode: z.enum(['light', 'dark']),
  state: field(160),
})
