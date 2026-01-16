"use client"

import { useState } from "react"
import { Pencil, Shield } from 'lucide-react'
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
        } catch (err: any) {
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

    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault()
        const pastedData = e.clipboardData
            .getData("text")
            .replace(/\s/g, "")
            .slice(0, 8)
        if (!/^\d+$/.test(pastedData)) return
        const newOtp = pastedData.split("")
        setOtp(prev => {
            const filled = [...prev]
            newOtp.forEach((char, i) => {
                filled[i] = char
            })
            return filled
        })
        const lastIndex = Math.min(newOtp.length - 1, 7)
        document.getElementById(`otp-${lastIndex}`)?.focus()
    }


    return (
        <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl"></div>
            </div>

            <div className="relative w-full max-w-md z-10">
                {/* Main login card */}
                <div className={`bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl p-8 transition-all duration-500 ${isVerifying ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="text-center space-y-2">
                            {/* <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                                <Mail className="w-8 h-8 text-primary" />
                            </div> */}
                            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
                            <p className="text-muted-foreground">Enter your email to receive a verification code</p>
                        </div>

                        {/* Email input section */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                                <div className="relative">
                                    {/* <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" /> */}
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isVerifying || isLoading}
                                        className="pl-10 h-12 text-base transition-all focus:ring-2 focus:ring-primary/20"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && email.trim() && !isLoading) {
                                                handleSendOtp()
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={handleSendOtp}
                                disabled={!email.trim() || isVerifying || isLoading}
                                className="w-full h-12 text-base font-medium shadow-md hover:shadow-lg transition-all duration-200"
                                size="lg"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2"></div>
                                        Sending code...
                                    </>
                                ) : (
                                    <>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Send verification code
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* OTP Verification Modal */}
                {isVerifying && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-20 animate-in fade-in duration-300"
                            onClick={() => {
                                if (!isLoading) {
                                    setIsVerifying(false)
                                    setOtp(["", "", "", "", "", "", "", ""])
                                }
                            }}
                        />

                        {/* Modal */}
                        <div className="fixed inset-0 z-30 flex items-center justify-center p-4">
                            <div
                                className="bg-card border border-border rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-6 animate-in zoom-in-95 duration-300"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="text-center space-y-2">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                                        <Shield className="w-8 h-8 text-primary" />
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight">Verify your email</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Enter the 8-digit code sent to
                                    </p>
                                    <p className="text-sm font-medium text-foreground break-all">
                                        {email}
                                    </p>
                                </div>

                                {/* OTP Input */}
                                <div className="space-y-3">
                                    <Label htmlFor="otp-0" className="text-sm font-medium">Verification code</Label>
                                    <div className="flex justify-between gap-2">
                                        {otp.map((digit, index) => (
                                            <Input
                                                key={index}
                                                id={`otp-${index}`}
                                                type="text"
                                                inputMode="text"
                                                maxLength={1}
                                                className="w-14 h-14 text-center text-2xl font-semibold transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:scale-105 border-2"
                                                value={digit}
                                                onChange={(e) => {
                                                    const value = e.target.value.trim().slice(0, 1)
                                                    handleOtpChange(index, value)
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Backspace' && !digit && index > 0) {
                                                        const prevInput = document.getElementById(`otp-${index - 1}`)
                                                        if (prevInput) prevInput.focus()
                                                    }
                                                }}
                                                disabled={isLoading}
                                                autoFocus={index === 0}
                                                onPaste={handleOtpPaste}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsVerifying(false)
                                            setOtp(["", "", "", "", "", "", "", ""])
                                        }}
                                        disabled={isLoading}
                                        className="flex-1 h-11"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleVerify}
                                        disabled={isLoading}
                                        className="flex-1 h-11 font-medium shadow-md hover:shadow-lg transition-all duration-200"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2"></div>
                                                Verifying...
                                            </>
                                        ) : (
                                            "Verify"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

