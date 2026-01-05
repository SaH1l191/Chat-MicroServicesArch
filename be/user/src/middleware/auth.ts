import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from 'jsonwebtoken'
import { IUser } from "../models/User";

 
export interface AuthRequest extends Request {
    user?: IUser
}
export interface MyJwtPayload extends JwtPayload {
    user?: IUser;
}
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {

        const token = req.cookies?.accessToken;
        // console.log("cookie parsed ! ")
        if (!token) {
            return res.status(401).json({
                message: "Unauthorized in Auth Middleware"
            })
        }
        const decode = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as MyJwtPayload;
        if (!decode) {
            return res.status(401).json({
                message: "Please Login - Invalid Token"
            })
        }
        req.user = decode.user;
        // console.log("req.user ",req.user)
        next()
    } catch (error) {
        console.log('Error in auth middleware', error)
        return res.status(401).json({ message: 'Unauthorized' })
    }
}

