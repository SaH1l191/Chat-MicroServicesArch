"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_1 = require("../controller/user");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post("/login", user_1.login);
router.post("/verify", user_1.verifyUser);
router.post("/update/user", auth_1.authMiddleware, user_1.updateName);
router.get("/me", auth_1.authMiddleware, user_1.getUser);
router.post("/user/all", auth_1.authMiddleware, user_1.getAllUsers);
router.get("/user/:id", user_1.getAUser);
exports.default = router;
