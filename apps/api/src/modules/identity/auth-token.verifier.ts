export type VerifiedIdentity = {
  subject: string;
  email?: string;
  displayName?: string;
};

export abstract class AuthTokenVerifier {
  abstract verify(token: string): Promise<VerifiedIdentity>;
}
