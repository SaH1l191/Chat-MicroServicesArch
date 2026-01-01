import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinaryConnect from "../config/cloudinary";
import multer from 'multer'

const storage = new CloudinaryStorage({
    cloudinary: cloudinaryConnect,
    params: {
        folder: 'chat-images',
        allowedFormats: ['jpg', 'png', "jpeg", "gif", "webp"],
        transformation: [
            { width: 800, height: 600, crop: "limit" },
            { quality: "auto" }
        ],
    } as any
})
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



export const upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 5, // 5mb
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true)
        } else {
            cb(new Error("Please upload only images"))
        }
    }
})