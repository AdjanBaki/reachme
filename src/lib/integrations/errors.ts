/**
 * An error from an outside service with a message that is safe to show in the
 * UI (Swedish, no secrets, no raw response bodies).
 */
export class IntegrationError extends Error {
  constructor(
    readonly userMessage: string,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = "IntegrationError";
  }
}

/** Message to show for any error thrown by an integration. */
export function userMessageFor(error: unknown, fallback: string): string {
  return error instanceof IntegrationError ? error.userMessage : fallback;
}
