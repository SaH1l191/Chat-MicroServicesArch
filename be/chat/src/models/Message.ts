import mongoose from "mongoose";
import { Types } from "mongoose";

// export enum MessageType {
//   TEXT = 'text',
//   IMAGE = 'image',
//   FILE = 'file',
//   AUDIO = 'audio',
//   VIDEO = 'video',
//   LOCATION = 'location',
//   VOICE_NOTE = 'voice_note',
//   SYSTEM = 'system'
// }

// export enum MessageStatus {
//   SENDING = 'sending',
//   SENT = 'sent',
//   DELIVERED = 'delivered',
//   READ = 'read',
//   FAILED = 'failed'
// }

// export interface IMessage {
//   chatId: Types.ObjectId;
//   senderId: string;
//   type: MessageType;
//   content: string;
//   metadata?: {
//     fileName?: string;
//     fileSize?: number;
//     mimeType?: string;
//     duration?: number;
//     thumbnail?: string;
//     location?: {
//       lat: number;
//       lng: number;
//       address?: string;
//     };
//   };
//   replyTo?: Types.ObjectId;
//   reactions?: Array<{
//     emoji: string;
//     userId: string;
//   }>;
//   status: MessageStatus;
//   readBy?: Array<{
//     userId: string;
//     readAt: Date;
//   }>;
//   editedAt?: Date;
//   deletedAt?: Date;
//   deletedFor?: string[];
//   scheduledFor?: Date;
//   expiresAt?: Date;
//   createdAt?: Date;
//   updatedAt?: Date;
//   _id: Types.ObjectId;
// }

// const messageSchema = new mongoose.Schema({
//   chatId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Chat',
//     required: true,
//     index: true
//   },
//   senderId: {
//     type: String,
//     required: true,
//     index: true
//   },
//   type: {
//     type: String,
//     enum: Object.values(MessageType),
//     default: MessageType.TEXT
//   },
//   content: {
//     type: String,
//     required: true
//   },
//   metadata: {
//     fileName: String,
//     fileSize: Number,
//     mimeType: String,
//     duration: Number,
//     thumbnail: String,
//     location: {
//       lat: Number,
//       lng: Number,
//       address: String
//     }
//   },
//   replyTo: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Message'
//   },
//   reactions: [{
//     emoji: String,
//     userId: String
//   }],
//   status: {
//     type: String,
//     enum: Object.values(MessageStatus),
//     default: MessageStatus.SENT
//   },
//   readBy: [{
//     userId: String,
//     readAt: { type: Date, default: Date.now }
//   }],
//   editedAt: Date,
//   deletedAt: Date,
//   deletedFor: [String],
//   scheduledFor: Date,
//   expiresAt: Date
// }, {
//   timestamps: true
// });

// Indexes for performance
// messageSchema.index({ chatId: 1, createdAt: -1 });
// messageSchema.index({ senderId: 1, createdAt: -1 });
// messageSchema.index({ 'reactions.userId': 1 });
// messageSchema.index({ content: 'text' }); // Text search index
// export const Message = mongoose.model<IMessage>("Message", messageSchema);

export interface IMessage {
    chatId: Types.ObjectId;
    sender: string;
    text: string;
    image: {
        url: string;
        publicId: string;
    };
    messageType: string;
    messageStatus: boolean;
    seenAt: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    _id: Types.ObjectId;
}

const schema = new mongoose.Schema({
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
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
})

export const Message = mongoose.model<IMessage>("Message", schema);










