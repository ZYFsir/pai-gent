import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const logDir = join(process.cwd(), '.layout-debug');
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, `report-${Date.now()}.json`);
    writeFileSync(logFile, JSON.stringify(data, null, 2));
    return NextResponse.json({ ok: true, file: logFile });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
