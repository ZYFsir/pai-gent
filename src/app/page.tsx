"use client"

import { Panel, Group, Separator, PanelImperativeHandle } from "react-resizable-panels"
import { useRef } from "react"

export default function HomePage() {
  const bRef = useRef<PanelImperativeHandle | null>(null)

  return (
    <Group orientation="horizontal" style={{ height: "100vh", width: "100%" }}>
      {/* A — 工具图标栏 + 伸缩开关 */}
      <Panel defaultSize={48} minSize={48} maxSize={48}>
        <div className="h-full flex flex-col items-center gap-3 py-3 bg-zinc-100">
          <button
            onClick={() => {
              const b = bRef.current
              b?.isCollapsed() ? b?.expand() : b?.collapse()
            }}
            className="w-8 h-8 flex items-center justify-center rounded
                       hover:bg-black/10 text-sm cursor-pointer select-none border-none"
            title="切换侧边栏"
          >
            ☰
          </button>
        </div>
      </Panel>

      <Separator className="flex items-center justify-center" style={{ width: 8 }}>
        <div style={{ width: 2, height: "100%", background: "#d0d0d0" }} />
      </Separator>

      {/* B — 左侧边栏，可完全折叠 */}
      <Panel
        panelRef={bRef}
        collapsible
        collapsedSize={0}
        defaultSize={280}
        minSize={10}
      >
        <div className="h-full flex items-center justify-center bg-orange-100">B</div>
      </Panel>

      <Separator className="flex items-center justify-center" style={{ width: 8 }}>
        <div style={{ width: 2, height: "100%", background: "#d0d0d0" }} />
      </Separator>

      {/* C / D — 中间弹性面板 */}
      <Panel defaultSize="50%" minSize="10%">
        <div className="h-full flex items-center justify-center bg-green-100">C</div>
      </Panel>

      <Separator className="flex items-center justify-center" style={{ width: 8 }}>
        <div style={{ width: 2, height: "100%", background: "#d0d0d0" }} />
      </Separator>

      <Panel defaultSize="50%" minSize="10%">
        <div className="h-full flex items-center justify-center bg-blue-100">D</div>
      </Panel>

      <Separator className="flex items-center justify-center" style={{ width: 8 }}>
        <div style={{ width: 2, height: "100%", background: "#d0d0d0" }} />
      </Separator>

      {/* E — 工具图标栏 48px */}
      <Panel defaultSize={48} minSize={48} maxSize={48}>
        <div className="h-full flex flex-col items-center gap-3 py-3 bg-zinc-100">E</div>
      </Panel>
    </Group>
  )
}
