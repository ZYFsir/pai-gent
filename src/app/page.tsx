"use client"

import { Panel, Group, Separator } from "react-resizable-panels"

export default function HomePage() {
  return (
    <Group orientation="horizontal" style={{ height: "100vh" }}>
      <Panel defaultSize={20} minSize={15}>
        <div className="h-full flex items-center justify-center bg-red-100">A</div>
      </Panel>
      <Separator className="flex items-center justify-center" style={{ width: 8 }}>
        <div style={{ width: 2, height: "100%", background: "#d0d0d0" }} />
      </Separator>
      <Panel defaultSize={60} minSize={30}>
        <div className="h-full flex items-center justify-center bg-green-100">B</div>
      </Panel>
      <Separator className="flex items-center justify-center" style={{ width: 8 }}>
        <div style={{ width: 2, height: "100%", background: "#d0d0d0" }} />
      </Separator>
      <Panel defaultSize={20} minSize={15}>
        <div className="h-full flex items-center justify-center bg-blue-100">C</div>
      </Panel>
    </Group>
  )
}
