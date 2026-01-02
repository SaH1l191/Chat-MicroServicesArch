import express from 'express'
import { createNewChat, getAllChats, getMessageByChat, sendMessage } from '../controller/chat'
import { authMiddleware } from '../middleware/auth'
import { upload } from '../middleware/multer'

const router = express.Router()

router.post('/chat/new', authMiddleware, createNewChat)
router.get("/chat/all", authMiddleware, getAllChats);
router.post("/message", authMiddleware, upload.single('image'), sendMessage) 
router.get("/message/:chatId",authMiddleware,getMessageByChat)
export default router