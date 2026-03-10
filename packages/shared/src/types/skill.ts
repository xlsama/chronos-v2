export interface Skill {
  id: string;
  name: string;
  summary: string;
  content: string;
  category: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
