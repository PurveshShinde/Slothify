import mongoose, { Schema, Document } from 'mongoose';

export interface IFollowedArtist extends Document {
    userId: string;
    artistId: string;
    artistName: string;
    artistImage?: string;
    followers?: number;
    followedAt: Date;
}

const FollowedArtistSchema = new Schema<IFollowedArtist>({
    userId: {
        type: String,
        required: true,
        index: true
    },
    artistId: {
        type: String,
        required: true
    },
    artistName: {
        type: String,
        required: true
    },
    artistImage: {
        type: String
    },
    followers: {
        type: Number,
        default: 0
    },
    followedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Composite unique index so a user cannot duplicate follow the same artist
FollowedArtistSchema.index({ userId: 1, artistId: 1 }, { unique: true });

export const FollowedArtist = mongoose.models.FollowedArtist || mongoose.model<IFollowedArtist>('FollowedArtist', FollowedArtistSchema);
