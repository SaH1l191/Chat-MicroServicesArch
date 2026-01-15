"use client"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4 font-sans">
      {/* subtle “breathing” gradient background */}
    

      <div className="relative w-full max-w-md rounded-xl border bg-white/90 p-6 shadow-sm backdrop-blur">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">Chat App</h1>
          <p className="text-sm text-slate-600">
            A minimal chat UI. Jump into your conversations.
          </p>
        </div>

        <div className="mt-6">
          <Button
            className="w-full bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => router.push("/chat")}
          >
            Open chat
          </Button>
        </div>
      </div>
    </div>
  )
}
