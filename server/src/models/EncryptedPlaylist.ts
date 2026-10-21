import mongoose, { Schema, Document } from 'mongoose';

export interface IEncryptedPlaylist extends Document {
    userId: string;
    playlistId: string;
    ciphertext: string;
    iv: string;
    tag: string;
    updatedAt: Date;
}

const EncryptedPlaylistSchema = new Schema<IEncryptedPlaylist>({
    userId: {
        type: String,
        required: true,
        index: true
    },
    playlistId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    ciphertext: {
        type: String,
        required: true
    },
    iv: {
        type: String,
        required: true
    },
    tag: {
        type: String,
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

export const EncryptedPlaylist = mongoose.models.EncryptedPlaylist || mongoose.model<IEncryptedPlaylist>('EncryptedPlaylist', EncryptedPlaylistSchema);
