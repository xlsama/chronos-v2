export interface Runbook {
  id: string;
  title: string;
  content: string;
  incidentId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
