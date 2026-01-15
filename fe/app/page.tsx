"use client"
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";


export default   function Home() {
  const router =   useRouter()
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      CHAT APP!
      <Button
      className="bg-blue-500 cursor-pointer text-white hover:bg-blue-600"
      onClick={async() => router.push("/chat")}>Chat</Button>
    </div>
  );
}
