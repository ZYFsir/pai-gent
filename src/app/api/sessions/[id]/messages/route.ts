import { NextResponse } from "next/server";
import { piBridge } from "@/lib/pi-bridge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await piBridge.waitReady();

  const inst = piBridge.getSession(id);

  if (inst) {
    const agentMessages = inst.session.agent.state.messages || [];
    piBridge.refreshSessionMeta(id, agentMessages);
    const messages = convertMessages(agentMessages);
    return NextResponse.json({ messages });
  }

  const cachedMessages = piBridge.loadSessionFromDisk(id);
  if (cachedMessages) {
    piBridge.refreshSessionMeta(id, cachedMessages);
    const messages = convertMessages(cachedMessages);
    return NextResponse.json({ messages });
  }

  const restored = await piBridge.restoreSession(id);
  if (restored) {
    const agentMessages = restored.session.agent.state.messages || [];
    piBridge.refreshSessionMeta(id, agentMessages);
    const messages = convertMessages(agentMessages);
    return NextResponse.json({ messages });
  }

  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}

function extractBlockText(content: any): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  let text = "";
  for (const block of content) {
    if (typeof block === "string") text += block;
    else if (block?.type === "text") text += block.text || "";
    else if ((block?.type === "tool_result" || block?.type === "toolResult") && typeof block.content === "string") {
      text += block.content;
    }
  }
  return text;
}

function convertMessages(agentMessages: any[]): any[] {
  const result: any[] = [];
  const toolCallIndex = new Map<string, { messageIndex: number; toolIndex: number }>();
  let counter = 0;

  for (const msg of agentMessages) {
    counter++;

    if (msg?.role === "toolResult") {
      const match = toolCallIndex.get(msg.toolCallId);
      if (match) {
        const toolCall = result[match.messageIndex]?.toolCalls?.[match.toolIndex];
        if (toolCall) {
          toolCall.status = msg.isError ? "error" : "done";
          toolCall.toolOutput = extractBlockText(msg.content);
          toolCall.toolError = msg.isError ? toolCall.toolOutput || "工具执行失败" : undefined;
        }
      }
      continue;
    }

    const role =
      msg.role === "user" ? ("user" as const)
      : msg.role === "assistant" ? ("assistant" as const)
      : ("system" as const);

    let content = "";
    let thinking = "";
    const toolCalls: Array<{
      toolCallId: string;
      toolName: string;
      args: unknown;
      status: "pending" | "done" | "error";
      toolOutput?: string;
      toolError?: string;
    }> = [];

    if (typeof msg.content === "string") {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text") content += block.text || "";
        if (block.type === "thinking") thinking += block.thinking || "";
        if (block.type === "toolCall" || block.type === "tool_use") {
          toolCalls.push({
            toolCallId: block.id || block.toolCallId || "",
            toolName: block.name || block.toolName || "",
            args: block.arguments || block.args || {},
            status: "pending",
          });
        }
      }
    }

    const normalized = {
      id: msg.id || `${role}-${msg.timestamp || Date.now()}-${counter}`,
      role,
      content,
      thinking: thinking || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      timestamp: msg.timestamp || Date.now(),
    };

    result.push(normalized);

    if (normalized.toolCalls?.length) {
      normalized.toolCalls.forEach((toolCall: any, toolIndex: number) => {
        if (toolCall.toolCallId) {
          toolCallIndex.set(toolCall.toolCallId, { messageIndex: result.length - 1, toolIndex });
        }
      });
    }
  }

  return result;
}
