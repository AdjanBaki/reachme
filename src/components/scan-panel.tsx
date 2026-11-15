"use client";

import { useActionState } from "react";
import { addPost, scanNow, type ScanState } from "@/lib/actions/scan";
import { Button, Card, Notice, inputClass } from "./ui";

function Result({ state }: { state: ScanState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

/** "Sök nu" plus the manual way in: paste a LinkedIn post. */
export function ScanPanel({ linkedinConnected, lastScan }: { linkedinConnected: boolean; lastScan?: string }) {
  const [scanState, scanAction, scanning] = useActionState<ScanState>(scanNow, {});
  const [postState, postAction, adding] = useActionState<ScanState, FormData>(addPost, {});

  return (
    <Card className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Hitta nya leads</h2>
          <p className="text-xs text-muted">
            {linkedinConnected
              ? "Söker bland veckans inlägg på LinkedIn som matchar dina sökord."
              : "LinkedIn är inte inkopplat. Sök nu använder exempeldata. Klistra in inlägg nedan."}
            {lastScan && ` Senast: ${lastScan}.`}
          </p>
        </div>
        <form action={scanAction}>
          <Button type="submit" variant="primary" disabled={scanning}>
            {scanning ? "Söker…" : "Sök nu"}
          </Button>
        </form>
      </div>
      <Result state={scanState} />

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-accent">Lägg till ett inlägg du hittat själv</summary>
        <form action={postAction} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="post-profile" className="mb-1 block text-xs font-medium text-muted">
                Profiladress
              </label>
              <input id="post-profile" name="profileUrl" placeholder="linkedin.com/in/namn" required className={inputClass} />
            </div>
            <div>
              <label htmlFor="post-name" className="mb-1 block text-xs font-medium text-muted">
                Namn
              </label>
              <input id="post-name" name="fullName" required className={inputClass} />
            </div>
            <div>
              <label htmlFor="post-headline" className="mb-1 block text-xs font-medium text-muted">
                Titel (valfritt)
              </label>
              <input id="post-headline" name="headline" placeholder="VD på Företaget AB" className={inputClass} />
            </div>
            <div>
              <label htmlFor="post-url" className="mb-1 block text-xs font-medium text-muted">
                Länk till inlägget (valfritt)
              </label>
              <input id="post-url" name="postUrl" placeholder="https://www.linkedin.com/posts/…" className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="post-text" className="mb-1 block text-xs font-medium text-muted">
              Inläggets text
            </label>
            <textarea id="post-text" name="text" rows={4} required className={inputClass} />
          </div>
          <Result state={postState} />
          <Button type="submit" disabled={adding}>
            {adding ? "Bedömer…" : "Bedöm och lägg till"}
          </Button>
        </form>
      </details>
    </Card>
  );
}
