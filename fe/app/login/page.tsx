"use client"

import { useState } from "react"
import { Pencil } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import api from "@/lib/axios"


export default function Component() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [email, setEmail] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [otp, setOtp] = useState(["", "", "", "", "", "", "", ""])

    const handleSendOtp = async () => {
        if (!email.trim()) return
        setIsLoading(true)
        try {
            const { data } = await api.post(`/api/v1/login`, {
                email: email.trim()
            })
            toast.success(`${data.message}`)
            setIsVerifying(true)
        } catch (err:any ) {
            toast.message(`${err?.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    const handleVerify = async () => {
        const otpString = otp.join("")
        if (otpString.length !== 8) {
            toast.error("Please enter the complete 8-digit code")
            return
        }
        setIsLoading(true)
        try {
            const { data } = await api.post(`/api/v1/verify`, {
                email: email.trim(),
                otp: otpString
            })
            toast.success(data.message || "OTP verified successfully!")
            // Invalidate user query to refetch user data
            queryClient.invalidateQueries({ queryKey: ["user", "me"] })
            router.push("/")
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || "Failed to verify OTP"
            toast.error(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const handleOtpChange = (index: number, value: string) => {
        const newOtp = [...otp]
        newOtp[index] = value
        setOtp(newOtp)
        if (value && index < 7) {
            const nextInput = document.getElementById(`otp-${index + 1}`)
            if (nextInput) nextInput.focus()
        }
    }

    return (
        <div className="flex justify-center items-center min-h-screen">
            <div className="relative w-[400px]">

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isVerifying || isLoading}
                        />
                    </div>
                    <Button
                        variant="link"
                        className="h-auto p-0 text-sm font-normal"
                        onClick={handleSendOtp}
                        disabled={!email.trim() || isVerifying || isLoading}
                    >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        {isLoading ? "Sending..." : "Send OTP"}
                    </Button>
                </div>

                {isVerifying && (
                    <div
                        className="z-10 absolute top-1/2 left-1/2   space-y-4 rounded-lg border bg-background p-6 shadow-lg"
                        style={{
                            transform: "translate(-50%, -50%)",
                            animation: "slide-in 300ms cubic-bezier(0, 0, 0.2, 1)",
                        }}
                    >
                        <h2 className="text-lg font-semibold text-center">Verify your email</h2>
                        <p className="text-sm text-muted-foreground text-center">
                            Enter the 8-digit code sent to {email}
                        </p>

                        <div className="space-y-2">
                            <Label htmlFor="otp-0">Verification code</Label>
                            <div className="flex justify-between gap-2">
                                {otp.map((digit, index) => (
                                    <Input
                                        key={index}
                                        id={`otp-${index}`}
                                        type="text"
                                        inputMode="text" // allow letters
                                        maxLength={1}
                                        className="w-12 h-12 text-center text-2xl"
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value.trim())} // trim each char
                                        disabled={isLoading}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsVerifying(false)
                                    setOtp(["", "", "", "", "", "", "", ""])
                                }}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleVerify} disabled={isLoading}>
                                {isLoading ? "Verifying..." : "Verify"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

