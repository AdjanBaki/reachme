import Anthropic from "@anthropic-ai/sdk";
import { readIntegrationConfig, type IntegrationConfig } from "../config";
import { AnthropicAiProvider } from "./anthropic-ai";
import { UnipileLinkedInProvider } from "./unipile";
import {
  standInAi,
  standInBilling,
  standInContacts,
  standInEmail,
  standInLinkedIn,
} from "./standins";
import type { AiProvider, BillingProvider, ContactProvider, EmailProvider, LinkedInProvider } from "./types";

export interface Integrations {
  linkedin: LinkedInProvider;
  ai: AiProvider;
  contacts: ContactProvider;
  email: EmailProvider;
  billing: BillingProvider;
}

/**
 * Pick the real provider for each service whose keys are configured,
 * otherwise the offline stand-in.
 */
export function createIntegrations(config: IntegrationConfig): Integrations {
  const ai = config.anthropic
    ? new AnthropicAiProvider({
        client: new Anthropic({ apiKey: config.anthropic.apiKey }),
        model: config.anthropic.model,
      })
    : standInAi;

  return {
    linkedin: config.unipile ? new UnipileLinkedInProvider(config.unipile) : standInLinkedIn,
    ai,
    contacts: standInContacts,
    email: standInEmail,
    billing: standInBilling,
  };
}

export const integrations: Integrations = createIntegrations(readIntegrationConfig());

export type * from "./types";
