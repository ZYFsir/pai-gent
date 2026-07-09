import { NextResponse } from "next/server";
import { piBridge } from "@/lib/pi-bridge";

export async function GET() {
  try {
    const sessions = await piBridge.listSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list sessions" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const { id } = await piBridge.createSession();
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 }
    );
  }
}
