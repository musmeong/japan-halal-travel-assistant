# Japan Halal Travel Assistant 🇯🇵🌸

An AI-powered, multi-modal travel assistant chatbot designed specifically for Muslim travelers exploring Japan. Built using the powerful **Google Gemini AI**, this application helps users find Halal food, locate prayer spaces, design itineraries, and fetch real-time prayer schedules.

## ✨ Key Features

*   🕌 **Real-Time Prayer Times (Tool Calling):** Integrated with the [Aladhan API](https://aladhan.com/prayer-times-api). When asked about prayer or sholat times for a specific Japanese city, the AI automatically executes an internal tool to securely fetch and format today's precise schedule.
*   📎 **Multi-Modal Capabilities:** Attach images, audio, video, or PDF files to your chat! Take a picture of a Japanese menu or ingredient list and ask the AI if it is Halal or Muslim-friendly.
*   📋 **Clipboard Support:** Seamlessly paste (Ctrl+V / Cmd+V) images directly from your clipboard into the chat for instant analysis.
*   🗂 **Session Management:** All conversations are persisted locally in the browser (`localStorage`). Use the sidebar to switch between different trip itineraries or start new sessions.
*   🎨 **Premium UI/UX:** A beautiful, responsive interface featuring a custom Sakura/Indigo color palette, glassmorphism overlays, markdown rendering, and smooth animations.

## 🛠 Tech Stack

*   **Backend:** Node.js, Express.js
*   **AI SDK:** `@google/genai` (Google Gemini API)
*   **Frontend:** Vanilla HTML, CSS, JavaScript
*   **Markdown Parsing:** `marked.js`

## 🚀 Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) installed on your machine.
*   A Google Gemini API key. Get one from [Google AI Studio](https://aistudio.google.com/).

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd gemini-ai-chatbot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your API key:
   ```env
   API_KEY=your_gemini_api_key_here
   ```

4. **Start the server:**
   ```bash
   node index.js
   ```

5. **Open the App:**
   Open your browser and navigate to `http://localhost:3000`.

## 🤖 Example Prompts

Try asking the assistant:
*   *"Where can I find Halal ramen in Shinjuku, Tokyo?"*
*   *"What time is Maghrib today in Kyoto?"*
*   *(Attach an image)* *"Is there any alcohol or pork in these ingredients?"*
*   *"Can you build a 3-day Muslim-friendly itinerary for Hokkaido?"*

## 📝 Notes

*   This bot is strictly scoped to Japanese travel and Halal logistics via its system prompt.
*   Base64 file encodings are temporarily stored in `localStorage` for session history.

---
*Created with ❤️ for Muslim Travelers.*
