export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tags: string[];
  contextSummary: string | null;
  documentCount?: number;
  serviceCount?: number;
  createdAt: string;
  updatedAt: string;
}
