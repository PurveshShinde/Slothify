import mongoose, { Schema, Document } from 'mongoose';

export interface IEncryptedLikedTrack extends Document {
    userId: string;
    trackId: string;
    ciphertext: string;
    iv: string;
    tag: string;
    addedAt: Date;
}

const EncryptedLikedTrackSchema = new Schema<IEncryptedLikedTrack>({
    userId: {
        type: String,
        required: true,
        index: true
    },
    trackId: {
        type: String,
        required: true
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
    addedAt: {
        type: Date,
        default: Date.now
    }
});

// Composite unique index so a user cannot duplicate like the same track
EncryptedLikedTrackSchema.index({ userId: 1, trackId: 1 }, { unique: true });

export const EncryptedLikedTrack = mongoose.models.EncryptedLikedTrack || mongoose.model<IEncryptedLikedTrack>('EncryptedLikedTrack', EncryptedLikedTrackSchema);
