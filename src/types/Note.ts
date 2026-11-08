export type NoteVisibility = 'shared' | 'private';

export interface Note {
  id: string;
  memberId: string;
  content: string;
  visibility: NoteVisibility;
  createdAt: string;
}
