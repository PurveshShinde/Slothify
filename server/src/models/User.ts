import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    username: string;
    passwordHash: string;
    recoveryKeyHash: string;
    createdAt: Date;
}

const UserSchema = new Schema<IUser>({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    passwordHash: {
        type: String,
        required: true
    },
    recoveryKeyHash: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
