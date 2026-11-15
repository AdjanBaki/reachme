"use server";

import { redirect } from "next/navigation";
import { integrations } from "../integrations";
import { getStore } from "../store";

/** Start checkout through the billing provider and send the customer there. */
export async function startCheckout(formData: FormData) {
  const plan = formData.get("plan") === "yearly" ? "yearly" : "monthly";
  const store = await getStore();
  const workspace = await store.getWorkspace();
  const url = await integrations.billing.startCheckout(workspace.id, plan);
  // Only follow relative paths or https URLs from the provider.
  if (!url.startsWith("/") && !url.startsWith("https://")) throw new Error("Invalid checkout URL");
  redirect(url);
}
