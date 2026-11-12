/**
 * Composition root: the one place that decides which concrete implementation
 * backs each port. Anything unconfigured is left undefined and its routes
 * answer 503 NOT_CONFIGURED.
 */
import { config, hasCapability } from "./config/index.ts";
import { createPgDatabase, type PgDatabase } from "./data/postgres/client.ts";
import { PgSalesforceConnectionRepository } from "./repositories/salesforceConnection.repository.ts";
import { ClerkTokenVerifier } from "./services/identity/clerkTokenVerifier.ts";
import { SalesforceConnectionService } from "./services/salesforce/connection.service.ts";
import { SalesforceClient } from "./services/salesforce/salesforceClient.ts";
import { systemClock, type TokenVerifier } from "./types/ports.ts";

export interface Container {
  db?: PgDatabase;
  verifier?: TokenVerifier;
  salesforce?: SalesforceConnectionService;
}

export function buildContainer(): Container {
  const container: Container = {};
  if (config.databaseUrl) container.db = createPgDatabase(config.databaseUrl);
  if (config.clerk.secretKey) container.verifier = new ClerkTokenVerifier(config.clerk.secretKey, config.clerk.authorizedParties);

  const { clientId, clientSecret, apiVersion, timeoutMs, redirectUri } = config.salesforce;
  const { tokenEncryptionKey, oauthStateSecret } = config.secrets;
  if (hasCapability("salesforce") && container.db && clientId && clientSecret && tokenEncryptionKey && oauthStateSecret) {
    container.salesforce = new SalesforceConnectionService(
      new PgSalesforceConnectionRepository(container.db),
      new SalesforceClient({ clientId, clientSecret, apiVersion, timeoutMs, redirectUri }),
      { tokenKey: tokenEncryptionKey, stateSecret: oauthStateSecret },
      systemClock,
    );
  }
  return container;
}
