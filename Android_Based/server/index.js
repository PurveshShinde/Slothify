import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// Stable Invidious instance
const INSTANCE = "https://inv.nadeko.net";

app.get("/search", async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Query parameter 'q' is required" });

    try {
        console.log(`Searching for: ${q}`);
        const r = await fetch(`${INSTANCE}/api/v1/search?q=${encodeURIComponent(q)}&type=video`);
        if (!r.ok) throw new Error(`Status ${r.status}`);
        const data = await r.json();
        res.json(data);
    } catch (e) {
        console.error("Search failed:", e);
        res.status(500).json({ error: "Instance failed" });
    }
});

app.get("/streams/:id", async (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID is required" });

    try {
        console.log(`Fetching stream for: ${id}`);
        const r = await fetch(`${INSTANCE}/api/v1/videos/${id}`);
        if (!r.ok) throw new Error(`Status ${r.status}`);
        const data = await r.json();
        res.json(data);
    } catch (e) {
        console.error("Stream fetch failed:", e);
        res.status(500).json({ error: "Stream fetch failed" });
    }
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Proxy running on port ${PORT}`));
