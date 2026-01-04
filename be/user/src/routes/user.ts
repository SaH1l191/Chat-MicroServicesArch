

import express from 'express'
import { getAllUsers, getAUser, getUser, login, refreshAccessToken, updateName, verifyUser, logout } from '../controller/user'
import { authMiddleware } from '../middleware/auth'

const router = express.Router()
router.post("/login", login)
router.post("/verify", verifyUser)
router.post("/update/user",authMiddleware, updateName)
router.get("/me",authMiddleware, getUser)
router.post("/logout", authMiddleware, logout)

router.post("/user/all",authMiddleware,getAllUsers)
router.get("/user/:id", getAUser)

router.get("/auth/refresh",refreshAccessToken)
export default router    