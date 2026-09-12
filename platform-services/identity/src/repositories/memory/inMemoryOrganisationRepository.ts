import type { OrganisationRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { LegalEntity } from "../../domain/entities.ts";

export function createInMemoryOrganisationRepository(store: InMemoryStore): OrganisationRepository {
  return {
    async findLegalEntityByKey(key: string): Promise<LegalEntity | null> {
      return store.legalEntities.find((e) => e.key === key) ?? null;
    },
    async findLegalEntityById(id: string): Promise<LegalEntity | null> {
      return store.legalEntities.find((e) => e.id === id) ?? null;
    },
    async listLegalEntities(): Promise<LegalEntity[]> {
      return [...store.legalEntities];
    },
  };
}
