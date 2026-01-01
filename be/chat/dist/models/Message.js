"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const schema = new mongoose_1.default.Schema({
    chatId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Chat",
        required: true,
    },
    sender: {
        type: String,
        required: true,
    },
    text: String,
    image: {
        url: String,
        publicId: String,
    },
    messageType: {
        type: String,
        enum: ["text", "image", "audio", "video", "location", "voice_note", "system"],
        default: "text",
    },
    seen: {
        type: Boolean,
        default: false
    },
    seenAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});
exports.Message = mongoose_1.default.model("Message", schema);
