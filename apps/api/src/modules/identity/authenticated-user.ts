export type AuthenticatedUser = {
  id: string;
  externalAuthId: string;
  email: string | null;
  displayName: string | null;
};

export type AuthenticatedRequest = {
  header(name: string): string | undefined;
  user?: AuthenticatedUser;
};
