import { NextResponse } from "next/server";
import { piBridge } from "@/lib/pi-bridge";

export async function GET() {
  try {
    await piBridge.init();
    const models = await piBridge.getAvailableModels();

    const simplified = models.map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      provider: m.provider,
      contextWindow: m.contextWindow,
      input: m.input,
      cost: m.cost,
    }));

    return NextResponse.json({ models: simplified });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list models" },
      { status: 500 }
    );
  }
}
