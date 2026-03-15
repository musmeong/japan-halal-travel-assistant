import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import cors from 'cors';

dotenv.config();

const app = express();
const upload = multer();
const port = 3000; // later can put this in .env if needed
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview'; // you can use any model based on preference

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 file attachments
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files (HTML, CSS, JS) from the 'public' directory
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

app.post('/generate-text', async (req, res) => {
    const { prompt } = req.body;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL, // do not forget to define the GEMINI_MODEL
            contents: prompt
        });

        res.status(200).json({ result: response.text });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: e.message });
    }
});

app.post("/generate-from-document", upload.single("document"), async (req, res) => {
    const { prompt } = req.body;
    const base64Document = req.file.buffer.toString("base64");

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt ?? "What is this?", type: "text" },
                { inlineData: { data: base64Document, mimeType: req.file.mimetype } }
            ],
        });

        res.status(200).json({ result: response.text });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: e.message });
    }
});

// --- Helper Functions ---
async function fetchPrayerTimes({ city }) {
    try {
        const date = new Date();
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        const formattedDate = `${dd}-${mm}-${yyyy}`;

        console.log(`Fetching prayer times for ${city} on ${formattedDate}`);
        const apiUrl = `https://api.aladhan.com/v1/timingsByCity/${formattedDate}?city=${encodeURIComponent(city)}&country=Japan&method=1`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Aladhan API returned ${response.status}`);
        }

        const data = await response.json();
        return data.data.timings;
    } catch (error) {
        console.error("Error fetching prayer times:", error);
        return { error: "Failed to fetch prayer times." };
    }
}

// Tool definitions for Gemini
const chatTools = [{
    functionDeclarations: [
        {
            name: "getPrayerTimes",
            description: "Fetches today's precise Islamic prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha) for a specified city in Japan.",
            parameters: {
                type: "OBJECT",
                properties: {
                    city: {
                        type: "STRING",
                        description: "The name of the Japanese city (e.g. 'Tokyo', 'Osaka', 'Kyoto')."
                    }
                },
                required: ["city"]
            }
        }
    ]
}];

app.post('/api/chat', async (req, res) => {
    const { conversation } = req.body;
    try {
        if (!conversation || !Array.isArray(conversation)) {
            res.status(400).json({
                error: 'Conversation must be an array of messages',
            });
            return;
        }

        const contents = conversation.map((msg) => {
            const partObj = { text: msg.text || "" };

            // If the frontend passed along inlineData (like an image), attach it to the parts
            // We ignore `fileName` here as it's only for the frontend UI, Gemini just needs data and mimeType
            if (msg.inlineData && msg.inlineData.mimeType && msg.inlineData.data) {
                return {
                    role: msg.role,
                    parts: [
                        partObj,
                        { inlineData: { mimeType: msg.inlineData.mimeType, data: msg.inlineData.data } }
                    ]
                };
            }

            return {
                role: msg.role,
                parts: [partObj]
            };
        });

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            config: {
                temperature: 0.9,
                systemInstruction: `
                Role & Persona:
                You are a cheerful, knowledgeable, and energetic Halal Travel Assistant specializing exclusively in Japan. Your tone is warm, engaging, and culturally Muslim. You naturally weave in common Islamic phrases (e.g., Assalamualaikum, Bismillah, Alhamdulillah, Mashallah, InshaAllah, Afwan) where appropriate, making users feel welcomed and understood.

                Core Objectives:
                Provide accurate, practical travel advice for Muslim tourists in Japan.
                Recommend verified Halal, Muslim-friendly, or strictly seafood/vegetarian dining options and local snacks.
                Help locate prayer facilities (masjids, mushollas, or accommodating spaces) near major tourist areas or train stations.
                Design Muslim-friendly itineraries that factor in prayer times and halal dining logistics.

                Strict Boundaries & Guardrails:
                Geographic Restriction (Japan ONLY): You are strictly limited to discussing travel within Japan. If a user asks about traveling to any other country, city, or region outside of Japan, you must politely decline and pivot back to Japan.
                Example fallback: "Afwan! My passport is only stamped for Japan 🇯🇵. I can't help with trips to [Country/City], but if you ever want to plan a trip to Kyoto or Hokkaido, I'm your guide!"
                Topic Restriction (Travel ONLY): You only answer questions related to Japan travel. You must refuse queries regarding coding, politics, general theology, issuing religious rulings (fatwas), or everyday non-travel topics.
                Example fallback: "Mashallah, that's an interesting topic, but I'm just a humble Japan travel guide! 🌸 I can only help you plan your itinerary. Do you need any Halal wagyu recommendations in Tokyo instead?"
                Disclaimer on Halal Status: Always include a gentle reminder that users should double-check Halal certifications, speak to staff, or verify ingredients (like mirin or alcohol in soy sauce) themselves, as restaurant menus and suppliers in Japan change frequently.

                Response Style:
                Start the very first interaction with a warm "Assalamualaikum!".
                Keep answers concise, structured, and easy to read using bullet points.
                Use relevant emojis to keep the energy fun and lighthearted (🍜, 🕌, 🚅, 🍣, 🌸).
                Be practical: Give specific station names, neighborhood references, and app recommendations (like Halal Gourmet Japan for food). 

                CRITICAL TOOL RULE: 
                Whenever a user asks for 'prayer times', 'sholat times', 'salah', or 'namaz' for a specific city in Japan, YOU MUST call the 'getPrayerTimes' tool to fetch the real-time schedule. DO NOT advise them to download an app instead of giving the times. You MUST use the tool.

                OUTPUT FORMATTING RULES:
                1. STRICT MARKDOWN STRUCTURE: You must use standard Markdown for all responses.
                2. MANDATORY NEWLINES: ALWAYS insert a double line break (\\n\\n) before starting any bulleted or numbered list.
                3. LIST SPACING: Insert a single line break (\\n) between each individual bullet point. Never output multiple bullet points on the same continuous line.
                4. PARAGRAPH SEPARATION: Separate the greeting, the main content, and the closing tips with double line breaks to create readable blocks of text.

                CURRENT CONTEXT:
                The user's current local date is ${new Date().toDateString()}. Always refer to this date as "today".
                `,
            },
            tools: chatTools
        });

        // Handle tool calls if Gemini decides to use one
        if (response.functionCalls && response.functionCalls.length > 0) {
            const call = response.functionCalls[0];

            if (call.name === "getPrayerTimes") {
                const apiResult = await fetchPrayerTimes(call.args);

                // Add the tool execution back into the history
                contents.push({
                    role: 'model',
                    parts: [{ functionCall: call }]
                });

                contents.push({
                    role: 'user', // Gemini requires functionResponse to be from the user
                    parts: [{
                        functionResponse: {
                            name: call.name,
                            response: apiResult
                        }
                    }]
                });

                console.log("Sending Prayer Times Response back to Gemini:", call.name);

                // Call Gemini a second time so it can format the final answer using the newly injected data
                response = await ai.models.generateContent({
                    model: GEMINI_MODEL,
                    contents: contents,
                    config: {
                        temperature: 0.9,
                        systemInstruction: `You are a helpful travel assistant. Format the JSON prayer times returned by the tool into a clean, easy-to-read markdown schedule. Do not explain the tools. Today is ${new Date().toDateString()}.`,
                        tools: chatTools
                    }
                });
            }
        }

        let finalText = "";
        try {
            finalText = response.text;
        } catch (e) {
            console.error("No text in final response (possibly just a tool call or blocked payload):", e);
            finalText = ""; // Default empty string handled below
        }

        if (!finalText) {
            finalText = "I encountered an error generating a response. Please try again or ask something else!";
        }

        res.status(200).json({ result: finalText });
    } catch (e) {
        console.error("Express Global Error Catch:", e);
        res.status(500).json({ error: e.message });
    }
})
