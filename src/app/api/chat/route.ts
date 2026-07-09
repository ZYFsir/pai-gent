import { piBridge } from "@/lib/pi-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequest {
  sessionId: string;
  message: string;
}

export async function POST(request: Request) {
  try {
    await piBridge.waitReady();
    const body: ChatRequest = await request.json();
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return new Response(
        JSON.stringify({ error: "sessionId and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let inst = piBridge.getSession(sessionId);

    if (!inst) {
      const restored = await piBridge.restoreSession(sessionId);
      if (!restored) {
        return new Response(
          JSON.stringify({ error: "Session not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      inst = piBridge.getSession(sessionId)!;
    }

    const { session } = inst;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {}
        };

        const unsubscribe = session.subscribe((event: any) => {
          try {
            switch (event.type) {
              case "message_update": {
                const ev = event.assistantMessageEvent;
                if (ev?.type === "text_delta") send("text_delta", { delta: ev.delta });
                else if (ev?.type === "thinking_delta") send("thinking_delta", { delta: ev.delta });
                else if (ev?.type === "toolcall_start") {
                  send("tool_start", { toolCallId: ev.toolCall?.id, toolName: ev.toolCall?.name, args: ev.toolCall?.arguments });
                }
                break;
              }

              case "tool_execution_start":
                send("tool_execution_start", { toolCallId: event.toolCallId, toolName: event.toolName, args: event.args });
                break;

              case "tool_execution_update": {
                // Forward tool output deltas (the event content that streams from tools)
                const delta = event.content || event.delta || "";
                if (delta) {
                  send("tool_execution_update", { toolCallId: event.toolCallId, toolName: event.toolName, delta });
                }
                break;
              }

              case "tool_execution_end": {
                // Extract tool result text if available
                let output = "";
                let error = "";
                if (event.result?.content) {
                  const parts = Array.isArray(event.result.content) ? event.result.content : [event.result.content];
                  for (const p of parts) {
                    if (typeof p === "string") output += p;
                    else if (p?.type === "text") output += p.text;
                    else if (p?.type === "tool_result") output += p.content || "";
                  }
                }
                if (event.isError) error = output;
                send("tool_execution_end", {
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  isError: event.isError,
                  output,
                  error: error || undefined,
                });
                break;
              }

              case "compaction_start": send("compaction_start", { reason: event.reason }); break;
              case "compaction_end": send("compaction_end", {}); break;

              case "auto_retry_start": send("retry_start", { attempt: event.attempt, maxAttempts: event.maxAttempts }); break;
              case "auto_retry_end": send("retry_end", { success: event.success, attempt: event.attempt }); break;

              case "agent_start": send("agent_start", {}); break;
              case "agent_end": send("agent_end", { messages: event.messages?.length ?? 0 }); break;
            }
          } catch {}
        });

        try {
          await session.prompt(message);
          piBridge.saveSessionToDisk(sessionId);
          send("done", {});
        } catch (err) {
          send("error", { message: err instanceof Error ? err.message : "Unknown error" });
        } finally {
          unsubscribe();
          controller.close();
        }
      },

      cancel() {
        session.abort().catch(() => {});
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
