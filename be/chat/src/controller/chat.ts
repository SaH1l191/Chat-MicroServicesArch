import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";


export const createNewChat =async(req:AuthRequest,res:Response)=>{
    try{
        const userId = req?.user?._id;
        const {otherUserId} = req.body;
        // 2:21:51//
    }catch(error){
        console.log(error)
        res.status(500).json({message:"Error"})
    }
}