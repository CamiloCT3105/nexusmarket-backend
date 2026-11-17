import { Credential } from "../models/Credential";
import { db } from "../db/transaction";
import { isUuid } from "../db/ids";

// PostgreSQL (tabla credentials), separada de users a propósito (D-12)
export const CredentialRepository = {
  async findByUserId(userId: string): Promise<Credential | undefined> {
    if (!isUuid(userId)) return undefined;
    const row = await db().credential.findUnique({ where: { userId } });
    return row ?? undefined;
  },

  async create(credential: Credential): Promise<Credential> {
    return db().credential.create({ data: credential });
  },
};
