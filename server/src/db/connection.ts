import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB(): Promise<boolean> {
    const uri = process.env.MONGODB_URI;

    if (!uri || uri.includes('<db_password>')) {
        console.log('[Database] ⚠️ MONGODB_URI not configured or contains <db_password>. Running in local fallback mode.');
        return false;
    }

    try {
        console.log('[Database] Connecting to MongoDB Atlas...');
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
        console.log('[Database] ✅ Connected successfully to MongoDB Atlas (Cluster0)!');
        return true;
    } catch (err: any) {
        console.warn('[Database] ⚠️ MongoDB connection failed:', err.message);
        console.log('[Database] Falling back to local storage.');
        isConnected = false;
        return false;
    }
}

export function isDbConnected(): boolean {
    return isConnected && mongoose.connection.readyState === 1;
}
