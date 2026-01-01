import jwt from "jsonwebtoken";
import { IUser } from "../models/User";

export const signAccessToken = (user: IUser) => {
    return jwt.sign(
        { user },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "15m" }
    );
};

export const signRefreshToken = (userId: string) => {
    return jwt.sign(
        { userId },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "15d" }
    );
};
