// Tipos compartidos entre backend y web dashboard.
// Se irán expandiendo sprint a sprint según las historias de usuario.

export type UserRole = 'patient' | 'psychologist' | 'sponsor' | 'family';

export interface BaseUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
