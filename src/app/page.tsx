import { ChatView } from "@/components/chat/chat-view";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function HomePage() {
  return (
    <main className="h-full w-full">
      <ErrorBoundary>
        <ChatView />
      </ErrorBoundary>
    </main>
  );
}
