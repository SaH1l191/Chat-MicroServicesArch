# Group Chat Implementation Guide

## Overview
This document outlines the changes needed to add group chat functionality to your existing 1-on-1 chat system.

---

## 1. Database Schema Changes

### Update Chat Model (`src/models/Chat.ts`)

Add the following fields to distinguish between 1-on-1 and group chats:

```typescript
export interface IChat {
    chatType: 'direct' | 'group';  // NEW: Type of chat
    users: string[];                // Keep existing
    groupName?: string;             // NEW: Group name (only for groups)
    groupDescription?: string;      // NEW: Group description
    groupImage?: {                  // NEW: Group profile image
        url: string;
        publicId: string;
    };
    admin: string[];                // NEW: Array of admin user IDs
    createdBy: string;              // NEW: User who created the group
    latestMessage: {
        text: string,
        sender: string
    }
    createdAt?: Date;
    updatedAt?: Date;
    _id: Types.ObjectId;
}
```

**Schema Updates:**
- Add `chatType` with enum ['direct', 'group'], default: 'direct'
- Add optional `groupName`, `groupDescription`, `groupImage`
- Add `admin` array (users who can manage the group)
- Add `createdBy` field

---

## 2. Controller Functions to Add/Modify

### A. Create Group Chat (`createGroupChat`)

**New Function:**
```typescript
export const createGroupChat = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req?.user?._id;
        const { groupName, groupDescription, userIds } = req.body;
        const groupImage = req.file; // Optional group image

        if (!groupName) {
            return res.status(400).json({ message: "Group name is required" });
        }
        if (!userIds || !Array.isArray(userIds) || userIds.length < 1) {
            return res.status(400).json({ message: "At least one other user is required" });
        }

        // Add creator to the users array
        const allUsers = [userId, ...userIds];

        const newGroup = await Chat.create({
            chatType: 'group',
            users: allUsers,
            groupName,
            groupDescription: groupDescription || '',
            groupImage: groupImage ? {
                url: groupImage.path,
                publicId: groupImage.filename
            } : undefined,
            admin: [userId], // Creator is admin
            createdBy: userId
        });

        return res.status(201).json({
            message: "Group chat created successfully",
            chatId: newGroup._id,
            group: newGroup
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error creating group chat" });
    }
}
```

### B. Update `createNewChat` (Keep for 1-on-1)

Modify to explicitly set `chatType: 'direct'`:
```typescript
const newChat = await Chat.create({
    chatType: 'direct',
    users: [userId, otherUserId]
})
```

### C. Update `getAllChats` (Handle Both Types)

Modify to handle both direct and group chats:

```typescript
export const getAllChats = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        // Fix: Change 'user' to 'users' in query
        const chats = await Chat.find({ users: userId }).sort({ updatedAt: -1 });

        const chatWithData = await Promise.all(
            chats.map(async (chat) => {
                const unseenCount = await Message.countDocuments({
                    chatId: chat._id,
                    sender: { $ne: userId },
                    seen: false
                });

                // Handle group chats
                if (chat.chatType === 'group') {
                    // Fetch all group members
                    const memberPromises = chat.users.map(async (memberId) => {
                        try {
                            const { data } = await axios.get(`${process.env.USER_SERVICE}/api/v1/user/${memberId}`);
                            return data;
                        } catch (error) {
                            return { _id: memberId, name: "Unknown User" };
                        }
                    });
                    const members = await Promise.all(memberPromises);

                    return {
                        chat: {
                            ...chat.toObject(),
                            latestMessage: chat.latestMessage || null,
                            unseenCount
                        },
                        members,
                        isGroup: true
                    };
                }

                // Handle direct chats (existing logic)
                const otherUserId = chat.users.find((id) => id !== userId);
                try {
                    const { data } = await axios.get(`${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`);
                    return {
                        user: data,
                        chat: {
                            ...chat.toObject(),
                            latestMessage: chat.latestMessage || null,
                            unseenCount
                        },
                        isGroup: false
                    };
                } catch (error) {
                    return {
                        user: {
                            _id: otherUserId,
                            name: "Unknown User"
                        },
                        chat: {
                            ...chat.toObject(),
                            latestMessage: chat.latestMessage || null,
                            unseenCount
                        },
                        isGroup: false
                    };
                }
            })
        );

        return res.json({ chats: chatWithData });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error in getting chats" });
    }
}
```

### D. Update `sendMessage` (Remove Other User Check for Groups)

Modify the validation logic:

```typescript
// Replace lines 116-119 with:
if (chat.chatType === 'group') {
    // For groups, just check if user is a member
    // (already checked above)
} else {
    // For direct chats, ensure exactly 2 users
    if (chat.users.length !== 2) {
        return res.status(400).json({ message: "Invalid direct chat" });
    }
    const otherUserId = chat.users.find((userId) => userId.toString() !== senderId.toString());
    if (!otherUserId) {
        return res.status(403).json({ message: "No other user found in this chat" });
    }
}
```

### E. Update `getMessageByChat` (Handle Groups)

Modify to handle group chats:

```typescript
export const getMessageByChat = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { chatId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        const isUserInChat = chat.users.some((id) => id.toString() === userId.toString());
        if (!isUserInChat) {
            return res.status(403).json({ message: "You are not a part of this chat" });
        }

        // Mark messages as seen
        await Message.updateMany({
            chatId: chatId,
            sender: { $ne: userId },
            seen: false
        }, {
            seen: true,
            seenAt: new Date()
        });

        const messages = await Message.find({ chatId }).sort({ createdAt: 1 });

        // Handle group chats
        if (chat.chatType === 'group') {
            // Fetch all group members
            const memberPromises = chat.users.map(async (memberId) => {
                try {
                    const { data } = await axios.get(`${process.env.USER_SERVICE}/api/v1/user/${memberId}`);
                    return data;
                } catch (error) {
                    return { _id: memberId, name: "Unknown User" };
                }
            });
            const members = await Promise.all(memberPromises);

            return res.status(200).json({
                messages,
                members,
                groupInfo: {
                    groupName: chat.groupName,
                    groupDescription: chat.groupDescription,
                    groupImage: chat.groupImage,
                    admin: chat.admin,
                    createdBy: chat.createdBy
                },
                isGroup: true
            });
        }

        // Handle direct chats (existing logic)
        const otherUserId = chat.users.find((id) => id !== userId);
        try {
            const { data } = await axios.get(`${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`);
            return res.status(200).json({
                messages,
                user: data,
                isGroup: false
            });
        } catch (error) {
            return res.json({
                messages,
                user: { _id: otherUserId, name: "Unknown User" },
                isGroup: false
            });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error in getting messages" });
    }
}
```

### F. Add Group Management Functions

#### Add Members to Group
```typescript
export const addMembersToGroup = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req?.user?._id;
        const { chatId } = req.params;
        const { userIds } = req.body; // Array of user IDs to add

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: "User IDs are required" });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        if (chat.chatType !== 'group') {
            return res.status(400).json({ message: "This is not a group chat" });
        }

        // Check if user is admin
        if (!chat.admin.includes(userId)) {
            return res.status(403).json({ message: "Only admins can add members" });
        }

        // Add new members (avoid duplicates)
        const newUsers = userIds.filter(id => !chat.users.includes(id));
        chat.users = [...chat.users, ...newUsers];

        await chat.save();

        return res.status(200).json({
            message: "Members added successfully",
            addedCount: newUsers.length
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error adding members" });
    }
}
```

#### Remove Members from Group
```typescript
export const removeMembersFromGroup = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req?.user?._id;
        const { chatId } = req.params;
        const { userIds } = req.body; // Array of user IDs to remove

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: "User IDs are required" });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        if (chat.chatType !== 'group') {
            return res.status(400).json({ message: "This is not a group chat" });
        }

        // Check if user is admin
        if (!chat.admin.includes(userId)) {
            return res.status(403).json({ message: "Only admins can remove members" });
        }

        // Remove members (can't remove admins)
        chat.users = chat.users.filter(id => 
            !userIds.includes(id) || chat.admin.includes(id)
        );

        // Also remove from admin if they were admins
        chat.admin = chat.admin.filter(id => !userIds.includes(id));

        await chat.save();

        return res.status(200).json({
            message: "Members removed successfully"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error removing members" });
    }
}
```

#### Leave Group
```typescript
export const leaveGroup = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req?.user?._id;
        const { chatId } = req.params;

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        if (chat.chatType !== 'group') {
            return res.status(400).json({ message: "This is not a group chat" });
        }

        // Remove user from chat
        chat.users = chat.users.filter(id => id.toString() !== userId.toString());
        chat.admin = chat.admin.filter(id => id.toString() !== userId.toString());

        // If no members left, delete the group (optional)
        if (chat.users.length === 0) {
            await Chat.findByIdAndDelete(chatId);
            return res.status(200).json({ message: "Group deleted (no members left)" });
        }

        // If last admin left, make first member admin
        if (chat.admin.length === 0 && chat.users.length > 0) {
            chat.admin = [chat.users[0]];
        }

        await chat.save();

        return res.status(200).json({ message: "Left group successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error leaving group" });
    }
}
```

#### Update Group Info
```typescript
export const updateGroupInfo = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req?.user?._id;
        const { chatId } = req.params;
        const { groupName, groupDescription } = req.body;
        const groupImage = req.file;

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        if (chat.chatType !== 'group') {
            return res.status(400).json({ message: "This is not a group chat" });
        }

        // Check if user is admin
        if (!chat.admin.includes(userId)) {
            return res.status(403).json({ message: "Only admins can update group info" });
        }

        if (groupName) chat.groupName = groupName;
        if (groupDescription !== undefined) chat.groupDescription = groupDescription;
        if (groupImage) {
            chat.groupImage = {
                url: groupImage.path,
                publicId: groupImage.filename
            };
        }

        await chat.save();

        return res.status(200).json({
            message: "Group info updated successfully",
            group: chat
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error updating group info" });
    }
}
```

#### Promote/Demote Admins
```typescript
export const updateGroupAdmins = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req?.user?._id;
        const { chatId } = req.params;
        const { userIds, action } = req.body; // action: 'promote' or 'demote'

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: "User IDs are required" });
        }

        if (!['promote', 'demote'].includes(action)) {
            return res.status(400).json({ message: "Action must be 'promote' or 'demote'" });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        if (chat.chatType !== 'group') {
            return res.status(400).json({ message: "This is not a group chat" });
        }

        // Check if user is admin
        if (!chat.admin.includes(userId)) {
            return res.status(403).json({ message: "Only admins can manage other admins" });
        }

        if (action === 'promote') {
            // Add to admin (avoid duplicates)
            userIds.forEach(id => {
                if (!chat.admin.includes(id) && chat.users.includes(id)) {
                    chat.admin.push(id);
                }
            });
        } else {
            // Demote (can't demote yourself if you're the only admin)
            if (chat.admin.length === 1 && chat.admin[0] === userId) {
                return res.status(400).json({ message: "Cannot demote the only admin" });
            }
            chat.admin = chat.admin.filter(id => !userIds.includes(id) || id === userId);
        }

        await chat.save();

        return res.status(200).json({
            message: `Users ${action}d successfully`,
            admins: chat.admin
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error updating admins" });
    }
}
```

---

## 3. Route Updates (`src/routes/route.ts`)

Add new routes:

```typescript
import express from 'express'
import { 
    createNewChat, 
    getAllChats, 
    sendMessage, 
    getMessageByChat,
    createGroupChat,
    addMembersToGroup,
    removeMembersFromGroup,
    leaveGroup,
    updateGroupInfo,
    updateGroupAdmins
} from '../controller/chat'
import { authMiddleware } from '../middleware/auth'
import { upload } from '../middleware/multer'

const router = express.Router()

// Existing routes
router.post('/chat/new', authMiddleware, createNewChat)
router.get("/chat/all", authMiddleware, getAllChats);
router.post("/message", authMiddleware, upload.single('image'), sendMessage)
router.get("/message/:chatId", authMiddleware, getMessageByChat) // Fix: use chatId

// New group chat routes
router.post('/group/create', authMiddleware, upload.single('groupImage'), createGroupChat)
router.post('/group/:chatId/members/add', authMiddleware, addMembersToGroup)
router.post('/group/:chatId/members/remove', authMiddleware, removeMembersFromGroup)
router.post('/group/:chatId/leave', authMiddleware, leaveGroup)
router.put('/group/:chatId', authMiddleware, upload.single('groupImage'), updateGroupInfo)
router.post('/group/:chatId/admins', authMiddleware, updateGroupAdmins)

export default router
```

---

## 4. Migration Strategy

### Option 1: Backward Compatible (Recommended)
- Add `chatType` field with default 'direct' to existing chats
- Existing 1-on-1 chats will continue to work
- No data migration needed

### Option 2: Explicit Migration
- Run a migration script to set `chatType: 'direct'` for all existing chats
- Add `admin` and `createdBy` fields to existing chats (use first user as admin)

---

## 5. Additional Considerations

### A. Message Read Receipts for Groups
- Current `seen` field works for groups, but you might want to track who has seen each message
- Consider adding `readBy: [{ userId, readAt }]` array to Message model for groups

### B. Group Size Limits
- Consider adding a maximum group size (e.g., 256 members)
- Validate in `addMembersToGroup`

### C. System Messages
- Add system messages when members join/leave (use `messageType: 'system'`)
- Example: "John joined the group", "Admin promoted Alice"

### D. Notifications
- Send notifications to all group members when:
  - New message is sent
  - Member is added/removed
  - Group info is updated
  - Admin privileges change

### E. Search Functionality
- Add search within group messages
- Add search for groups by name

---

## 6. Testing Checklist

- [ ] Create 1-on-1 chat (should still work)
- [ ] Create group chat with 3+ members
- [ ] Send messages in group chat
- [ ] Add members to group (admin only)
- [ ] Remove members from group (admin only)
- [ ] Leave group (any member)
- [ ] Update group info (admin only)
- [ ] Promote/demote admins
- [ ] Verify non-members can't access group
- [ ] Verify non-admins can't manage group
- [ ] Test with group image upload

---

## 7. Frontend Considerations

Update frontend to:
- Show group name and image instead of other user's name
- Display member list
- Show admin badges
- Provide UI for group management actions
- Handle system messages differently (centered, different style)

---

## Summary

**Key Changes:**
1. ✅ Add `chatType`, `groupName`, `groupDescription`, `groupImage`, `admin`, `createdBy` to Chat model
2. ✅ Update existing controllers to handle both chat types
3. ✅ Add new group management controllers
4. ✅ Add new routes for group operations
5. ✅ Fix bug in `getAllChats` (change `user` to `users` in query)

**Estimated Implementation Time:** 4-6 hours

**Priority Order:**
1. Update Chat model
2. Update existing controllers (getAllChats, sendMessage, getMessageByChat)
3. Add createGroupChat
4. Add group management functions
5. Add routes
6. Test thoroughly

