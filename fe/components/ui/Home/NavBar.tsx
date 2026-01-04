"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useUser, useLogout } from "@/lib/queries/user"

export default function Navbar() {
  const router = useRouter()
  const { data: user, isLoading: loading } = useUser()
  const logoutMutation = useLogout()

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync()
      toast.success("Logged out successfully")
      router.push("/login")
    } catch (err: any) {
      toast.error("Failed to logout")
    }
  }

  return (
    <nav className="bg-gray-100 p-4 flex justify-between items-center">
      <div className="font-bold text-xl cursor-pointer" onClick={() => router.push("/")}>
        MyApp
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : user ? (
        <div className="flex items-center gap-4">
          <span>{user.email}</span>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>
      ) : (
        <div className="flex gap-4">
          <Button onClick={() => router.push("/login")}>Login</Button>
        </div>
      )}
    </nav>
  )
}
