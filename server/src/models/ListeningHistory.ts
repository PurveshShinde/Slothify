import mongoose, { Schema, Document } from 'mongoose';

export interface IListeningHistory extends Document {
    userId: string;
    trackId: string;
    trackName: string;
    artistName: string;
    albumName?: string;
    albumImage?: string;
    duration_ms?: number;
    preview_url?: string;
    playedAt: Date;
}

const ListeningHistorySchema = new Schema<IListeningHistory>({
    userId: { type: String, required: true, index: true },
    trackId: { type: String, required: true },
    trackName: { type: String, required: true },
    artistName: { type: String, required: true },
    albumName: { type: String },
    albumImage: { type: String },
    duration_ms: { type: Number, default: 180000 },
    preview_url: { type: String },
    playedAt: { type: Date, default: Date.now, index: true }
});

export const ListeningHistory = mongoose.models.ListeningHistory || mongoose.model<IListeningHistory>('ListeningHistory', ListeningHistorySchema);
