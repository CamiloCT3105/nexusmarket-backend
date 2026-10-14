import { Credential } from "../models/Credential";

const credentials: Credential[] = [];

export const CredentialRepository = {
  findByUserId(userId: string): Credential | undefined {
    return credentials.find((credential) => credential.userId === userId);
  },

  create(credential: Credential): Credential {
    credentials.push(credential);
    return credential;
  },
};