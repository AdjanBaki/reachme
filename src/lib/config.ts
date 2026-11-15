/**
 * Reads integration settings from the environment (`.env.local` in development).
 * Only reports whether keys are present; key values are never exposed or logged.
 */

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

export interface IntegrationConfig {
  anthropic: { apiKey: string; model: string } | null;
  unipile: { apiKey: string; dsn: string; accountId: string } | null;
}

function value(env: Record<string, string | undefined>, name: string): string | undefined {
  const v = env[name]?.trim();
  return v ? v : undefined;
}

export function readIntegrationConfig(env: Record<string, string | undefined> = process.env): IntegrationConfig {
  const anthropicKey = value(env, "ANTHROPIC_API_KEY");
  const unipileKey = value(env, "UNIPILE_API_KEY");
  const unipileDsn = value(env, "UNIPILE_DSN");
  const unipileAccount = value(env, "UNIPILE_ACCOUNT_ID");

  return {
    anthropic: anthropicKey
      ? { apiKey: anthropicKey, model: value(env, "ANTHROPIC_MODEL") ?? DEFAULT_ANTHROPIC_MODEL }
      : null,
    unipile:
      unipileKey && unipileDsn && unipileAccount
        ? { apiKey: unipileKey, dsn: unipileDsn, accountId: unipileAccount }
        : null,
  };
}

export interface IntegrationStatus {
  ai: boolean;
  linkedin: boolean;
}

export function integrationStatus(config: IntegrationConfig = readIntegrationConfig()): IntegrationStatus {
  return { ai: config.anthropic !== null, linkedin: config.unipile !== null };
}
