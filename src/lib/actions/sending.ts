"use server";

import { revalidatePath } from "next/cache";
import { sendingSettings } from "../domain/pacing";
import { getStore } from "../store";

export type SendingFormState = { error?: string; message?: string };

export async function saveSendingSettings(_prev: SendingFormState, formData: FormData): Promise<SendingFormState> {
  const invitesPerDay = Number(formData.get("invitesPerDay"));
  const messagesPerDay = Number(formData.get("messagesPerDay"));
  const startHour = Number(formData.get("startHour"));
  const endHour = Number(formData.get("endHour"));
  if (![invitesPerDay, messagesPerDay, startHour, endHour].every(Number.isInteger)) {
    return { error: "Ange hela tal." };
  }
  if (endHour <= startHour) return { error: "Sluttiden måste vara efter starttiden." };

  const settings = sendingSettings({
    invitesPerDay,
    messagesPerDay,
    startHour,
    endHour,
    rampUp: formData.get("rampUp") === "on",
    weekdaysOnly: formData.get("weekdaysOnly") === "on",
  });
  const store = await getStore();
  const workspace = await store.getWorkspace();
  await store.saveWorkspace({ ...workspace, sending: settings });
  revalidatePath("/", "layout");
  const capped = settings.invitesPerDay !== invitesPerDay || settings.messagesPerDay !== messagesPerDay;
  return { message: capped ? "Sparat. Värden över maxgränsen sänktes." : "Sparat." };
}

/** Resume sending after LinkedIn reported a restriction. */
export async function resumeSending() {
  const store = await getStore();
  const workspace = await store.getWorkspace();
  const state = { ...workspace.sendingState };
  delete state.pausedAt;
  delete state.pauseReason;
  await store.saveWorkspace({ ...workspace, sendingState: state });
  revalidatePath("/", "layout");
}
