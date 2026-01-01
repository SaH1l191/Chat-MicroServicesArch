"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const multer_1 = __importDefault(require("multer"));
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.default,
    params: {
        folder: 'chat-images',
        allowedFormats: ['jpg', 'png', "jpeg", "gif", "webp"],
        transformation: [
            { width: 800, height: 600, crop: "limit" },
            { quality: "auto" }
        ],
    }
});
//Express cannot read files by itself
//So when a client uploads an image:
// Express sees raw binary data
// It has no idea how to handle it
// Normally Multer stores files:
// On disk
// Or in memory
// But here:
// import { CloudinaryStorage } from "multer-storage-cloudinary";
// This replaces local storage with Cloudinary storage.
// So:
// Multer receives the file
// Immediately streams it to Cloudinary
// Cloudinary returns a URL
// Multer attaches that info to req.file
exports.upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 5, // 5mb
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        }
        else {
            cb(new Error("Please upload only images"));
        }
    }
});
