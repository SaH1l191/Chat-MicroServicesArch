import { Request, Response } from "express";
import { redisClient } from "..";
import { generateOTP } from "otp-agent";
import { publishToQueue } from "../config/rabbitmq";
import { User } from "../models/User";
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv';
import { AuthRequest } from "../middleware/auth";
import { signAccessToken, signRefreshToken } from "../utils/token";
dotenv.config()


export const login = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Please provide all fields' });
        }

        //reDis 
        // 2 keys : 
        //otp:ratelimit:email@example.com : true/false
        // otp:email@example.com : 123123123
        const rateLimitKey = `otp:ratelimit:${email}`;
        const rateLimit = await redisClient.get(rateLimitKey)
        if (rateLimit) {
            res.status(429).json({
                message: 'You are sending too many requests'
            })
            return;
        }

        const otp = generateOTP({
            length: 8,
            numbers: true,
            alphabets: true,
            upperCaseAlphabets: true,
        })
        const otpKey = `otp:${email}`
        await redisClient.set(otpKey, otp, {
            EX: 300
        })
        await redisClient.set(rateLimitKey, "true", {
            EX: 60
        })
        const message = {
            to: email,
            subject: "Your OTP Code",
            body: `Your OTP Code is ${otp}.It will expire after 5 minutes`
        }
        await publishToQueue('send-otp', message)
        res.status(400).json({
            message: "OTP sent successfully"
        })

    }
    catch (error) {
        console.log("Error in login", error)
        // return res.status(500).json({message: error.message});
    }
}


export const verifyUser = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body
        if (!email || !otp) {
            return res.status(400).json({ message: "Please provide all fields" })
        }
        //otpkey in form
        //otp:haldankarsahil98@gmail.com
        const otpKey = `otp:${email}`
        const storedOtp = await redisClient.get(otpKey)
        if (!storedOtp || storedOtp !== otp) {
            return res.status(400).json({
                message: "Invalid or Expired OTP"
            })
        }
        await redisClient.del(otpKey)

        let user = await User.findOne({ email: email })
        if (!user) {
            const name = email.slice(0, email.indexOf('@'))
            user = await User.create({ name: name, email })

            // const token = await jwt.sign({ user }, process.env.JWT_SECRET!, { expiresIn: "15d" })

            const accessToken = signAccessToken(user);
            const refreshToken = signRefreshToken(user._id.toString());


            //refresh:USER_ID: REFRESH_TOKEN (15 days expiry)
            await redisClient.set(
                `refresh:${user._id}`,
                refreshToken,
                { EX: 15 * 24 * 60 * 60 }
            );

            res.cookie("accessToken", accessToken, {
                httpOnly: true,
                sameSite: "lax",  // instead of "strict"
                secure: false,
                maxAge: 15 * 60 * 1000// 15 days
            });

            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: false,
                maxAge: 15 * 24 * 60 * 60 * 1000
            });

            return res.status(200).json({
                message: "User Verified",
                user
            });
        } else {
            //user already exists 
            const accessToken = signAccessToken(user);
            const refreshToken = signRefreshToken(user._id.toString());

            await redisClient.set(`refresh:${user._id}`, refreshToken, { EX: 15 * 24 * 60 * 60 });

            res.cookie("accessToken", accessToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                maxAge: 15 * 60 * 1000
            });

            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                maxAge: 15 * 24 * 60 * 60 * 1000
            });

            return res.status(200).json({
                message: "User Verified",
                user
            });
        }
    } catch (error) {
        console.log("Error in verifying User", error)
        return res.status(500).json({ message: "Internal Server Error" });
    }
}


// Access token
// Short-lived (10–15 min)
// Used on every API request
// If stolen → limited damage
// Refresh token
// Long-lived (7–30 days)
// Used only to get new access tokens
// Stored securely (HTTP-only cookie)


// Flow 
// User logs in
// ↓
// Access token (15 min) + Refresh token (15 days)
// ↓
// 15 minutes later
// ↓
// API returns 401 (Access token expired)
// ↓
// Frontend calls /auth/refresh
// ↓
// New access token issued
// ↓
// User continues without logging in again


export const refreshAccessToken = async (req: Request, res: Response) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

        const payload = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET!
        ) as { userId: string };

        const savedToken = await redisClient.get(`refresh:${payload.userId}`);
        if (savedToken && savedToken !== refreshToken) {
            return res.status(401).json({ message: "Invalid refresh token" });
        }

        const user = await User.findById(payload.userId);
        if (!user) return res.status(401).json({ message: "User not found" });

        const newAccessToken = signAccessToken(user);

        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 15 * 60 * 1000
        });

        res.json({ message: "Access token refreshed" });
    } catch {
        return res.status(401).json({ message: "Refresh expired" });
    }
};



export const getAUser = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById({ _id:req.params.id })
        if (!user) {
            return res.status(200).json({
                message: "Invalid User "
            });
        }
        return res.status(200).json({
            user
        });
    }
    catch (error) {
        console.log("Error in getting User", error)
        return res.status(500).json({ message: "Internal Server Error" });
    }
}



export const getUser = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user
        console.log("/me user ",req.user)
        return res.status(200).json({
            user
        });
 
    }
    catch (error) {
        console.log("Error in getting User", error)
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

export const updateName = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById({ _id: req.user?._id })
        if (!user) {
            return res.status(200).json({
                message: "Please Login"
            });
        }
        user.name = req.body.name
        await user.save()
        const token = await jwt.sign({ user }, process.env.JWT_SECRET!, { expiresIn: "15d" })
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 15 * 24 * 60 * 60 * 1000
        });
        res.json({
            message: "User Updated",
            user,
            token
        });


    }
    catch (error) {
        console.log("Error in getting User", error)
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

export const getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
        const users = await User.find();
        return res.status(200).json({
            message: "fetched all Users successfully",
            users
        })

    } catch (error) {
        console.log("Error in getting all users", error)
        return res.status(500).json({ message: "Internal Server Error" });
    }
}


export const logout = async (req: AuthRequest, res: Response) => {
    if (req.user?._id) {
        await redisClient.del(`refresh:${req.user._id}`);
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.json({ message: "Logged out successfully" });
};


