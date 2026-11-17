import { Credential } from "../models/Credential";
import { clone } from "./clone";

const credentials: Credential[] = [];

export const CredentialRepository = {
  async findByUserId(userId: string): Promise<Credential | undefined> {
    const credential = credentials.find((c) => c.userId === userId);
    return credential && clone(credential);
  },

  async create(credential: Credential): Promise<Credential> {
    credentials.push(clone(credential));
    return clone(credential);
  },
};
