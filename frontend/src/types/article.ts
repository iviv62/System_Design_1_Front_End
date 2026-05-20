export interface Article {
  id: number;
  title: string;
  excerpt: string;
  author: string;
  /** Backend model field — populated when fetching from the API. */
  authorId?: string;
  tag: string;
  tagColor: string;
  stars: number;
  readTime: string;
  coverUrl: string;
  starred: boolean;
}
