import { NextResponse } from "next/server";
import { piBridge } from "@/lib/pi-bridge";

export async function GET() {
  try {
    await piBridge.waitReady();
    const models = await piBridge.getAvailableModels();

    const simplified = models.map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      provider: m.provider,
    }));

    // Collect providers with key status
    const providerSet = new Map<string, { id: string; name: string; hasKey: boolean }>();
    for (const m of models) {
      const p = m.provider;
      if (p && !providerSet.has(p)) {
        providerSet.set(p, { id: p, name: p.charAt(0).toUpperCase() + p.slice(1), hasKey: false });
      }
    }

    return NextResponse.json({
      models: simplified,
      providers: Array.from(providerSet.values()),
      thinkingLevel: "off",
      modelId: simplified[0]?.id || "",
      modelName: simplified[0]?.name || "",
    });
  } catch {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await piBridge.waitReady();
    const body = await request.json();

    // Set API key
    if (body.apiKey) {
      piBridge.setApiKey(body.apiKey.provider, body.apiKey.key);
      return NextResponse.json({ success: true });
    }

    // Change model for current session
    if (body.modelId) {
      const result = piBridge.switchModel(body.modelId);
      return NextResponse.json({ success: true, ...result });
    }

    // Set thinking level
    if (body.thinkingLevel) {
      piBridge.setThinkingLevel(body.thinkingLevel);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "No valid setting provided" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
