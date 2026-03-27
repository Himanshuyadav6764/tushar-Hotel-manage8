import { useState, useRef, useEffect, useCallback } from "react";
import "./AdvikaAI.css";
import botVideo from "../assets/bot-video.mp4";
import avatar from "../assets/chatbot-girl.png";

// ─── OpenRouter (custom text fallback only) ───────────────────────────
const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const OR_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";
const OR_MODEL = "meta-llama/llama-3.1-8b-instruct:free";

// ────────────────────────────────────────────────────────────────────
//  INSTANT PRE-WRITTEN RESPONSES (no API, 100% reliable)
// ────────────────────────────────────────────────────────────────────
const INSTANT = {
    "Reservation Process": `📋 RESERVATION PROCESS

🏨 GUEST CAN BOOK VIA:
• Call: +91 98765 43210
• Email: support@bireenaatithi.com
• Walk-in at the hotel front desk

👨‍💼 ADMIN/STAFF STEPS:
1. Login → Reservations → New Reservation
2. Fill Guest Details: Name, Mobile, Email, ID Proof (Aadhaar / Passport / Voter ID / Driving License)
3. Select Room Type and Room Number
4. Set Check-in & Check-out Date/Time
5. Choose Meal Plan: EP (Room Only) | CP (+Breakfast) | MAP (+Dinner) | AP (All Meals)
6. Enter number of Adults and Children
7. Select Booking Source: Walk-in, Phone, OTA, Corporate, Travel Agent
8. Add Extra Charges or Complimentary Services (if any)
9. Choose Payment Mode: Cash / Card / UPI / Bank Transfer
10. Save → Unique Booking ID generated, Room status → "Booked"

📌 BOOKING STATUSES:
• Upcoming – Confirmed, not yet arrived
• Checked-in – Guest has arrived
• Checked-out – Guest departed
• Cancelled – Booking cancelled
• No-show – Guest didn't arrive`,

    "How to Order Food": `🍽️ HOW TO ORDER FOOD

📱 METHOD 1 – QR CODE (In-Room Dining):
1. Admin generates QR per room → Property Setup → Generate Room QR
2. QR code placed on room door
3. Guest scans QR with phone (no app/login needed)
4. Guest browses live food menu → Selects items
5. Order submitted → KOT instantly sent to kitchen
6. Kitchen prepares & delivers, charges auto-added to guest folio

👨 METHOD 2 – WAITER ENTRY (Restaurant/Table):
1. Waiter logs in → Opens Table View
2. Selects guest's table → Clicks New Order
3. Adds food items from menu
4. Submits → KOT generated and sent to kitchen
5. After service → Bill generated from Cashier Section

🎫 KOT (Kitchen Order Ticket):
• Auto-generated the moment food is ordered
• Shows: Item, quantity, table/room, special notes, time
• Kitchen marks: Pending → In Progress → Served
• Multiple order rounds per table supported`,

    "Pricing Information": `💰 BIREENA ATITHI PRICING PLANS

━━━━━━━━━━━━━━━━━━━━━━━━
💎 BASIC – ₹19,999/month
Best for: Small hotels, guesthouses, B&Bs
• Single hotel management
• Basic reservation system | KOT (limited)
• Standard billing & invoicing | Email support
• Max 20 rooms | 5 staff accounts
• QR generation ✅ | Basic reports ✅
• Advanced reports ❌ | Multi-hotel ❌

━━━━━━━━━━━━━━━━━━━━━━━━
⭐ PROFESSIONAL – ₹14,999/month (Most Popular)
Best for: Mid-size hotels, boutique properties
• Up to 3 hotels | Full KOT automation
• Advanced reservation intelligence
• Inventory management | 24/7 priority support
• Max 100 rooms | 20 staff accounts
• Advanced reports ✅ | Analytics ✅ | Activity logs ✅

━━━━━━━━━━━━━━━━━━━━━━━━
🏢 ENTERPRISE – Custom Pricing
Best for: Hotel chains, large resorts
• Unlimited hotels & rooms | Full customization
• Advanced analytics | Dedicated account manager
• Custom API integration (MakeMyTrip, Booking.com)
• All features ✅ | Multi-hotel ✅

📞 Get a quote: support@bireenaatithi.com | +91 98765 43210`,

    "Table Booking Process": `🪑 TABLE BOOKING PROCESS

📋 STEP-BY-STEP:
1. Guest arrives or calls to reserve a table
2. Receptionist/Waiter opens Table View in admin panel
3. Selects an Available table → Assigns to guest
4. Takes food order → Enters items in system
5. KOT auto-sent to kitchen instantly
6. Kitchen prepares and serves
7. After dining → Cashier generates bill → Payment processed

🟢 TABLE STATUSES:
• Available – Free, ready to seat guests
• Occupied – Guest currently dining
• Reserved – Pre-booked for a specific time

⚡ WAITER QUICK FLOW:
Login → Table View → Select Table → Add Order → KOT to Kitchen → Serve → Generate Bill

⚙️ TABLE SETUP:
Tables are configured under Property Configuration → Table Management
Each table: Table Number, Capacity, Current Status
Tables can also be linked to rooms for QR-based in-room orders.`,

    "About Bireena Atithi": `🏨 ABOUT BIREENA ATITHI

"Empowering Modern Hotels With Smart Digital Intelligence"

Bireena Atithi is a complete Hotel & KOT Management Software built by Bireena Info Tech, based in Patna, Bihar, India.

🎯 WHAT WE DO:
We help hotels simplify room reservations, automate food ordering with KOT, manage billing, track housekeeping, and generate smart analytics — all from one platform.

✨ KEY FEATURES:
• Smart Reservation Management
• KOT (Kitchen Order Ticket) Automation
• Real-time Billing & Invoicing
• QR-code based In-Room Dining (no app needed)
• Housekeeping Management
• Analytics & Financial Reports
• Multi-hotel Management (Enterprise plan)
• Role-based Access Control (7 roles)

👥 OUR TEAM:
• Dipika Singh – Founder & Director
• Himanshu Yadav – Full Stack Developer
• Ankit Kumar Gupta – Project Manager
• Tushar Kumar – Backend Developer
• Md Arshad Raza – Frontend Developer
• Shekhar Kumar – Backend Developer

📞 REACH US:
• Email: support@bireenaatithi.com
• Phone: +91 98765 43210
• Website: https://bireenaatithi.com
• Address: B36, Mitra Mandal Colony, Anisabad, Patna, Bihar 800002`,

    "Hotel Features": `🏨 HOTEL FEATURES — BIREENA ATITHI

✅ RESERVATION & FRONT DESK:
• Smart Reservation Management (online, walk-in, OTA, corporate)
• Check-in / Check-out automation
• Guest profile with ID proof, history, preferences
• Group booking & corporate account management
• Multi-room booking support
• Folio management — all charges under one account
• Early check-in / Late check-out tracking
• Registration card printing

✅ BILLING & PAYMENTS:
• Real-time billing & auto invoice generation
• Supports: Cash, Card (Swipe), UPI, Bank Transfer
• Discount management (flat & percentage)
• GST and tax automation
• Split billing, bill routing to company
• Email/print invoice instantly

✅ HOUSEKEEPING:
• Room status tracking: Clean / Dirty / In Progress / Inspected
• Task assignment to housekeeping staff
• Floor-wise room cleaning management
• Maintenance block scheduling

✅ ANALYTICS & REPORTS:
• Occupancy rate gauges (Today / This Month)
• Revenue breakup: Rooms, Restaurant, Extras
• Average Daily Rate (ADR)
• Cashier audit logs and payment logs
• Check-in / Check-out report

✅ ACCESS CONTROL:
• 7 user roles: Super Admin, Admin, Manager, Receptionist, Accountant, Waiter, Staff
• Custom permissions per staff member
• Role-based module visibility

✅ OTHER:
• Multi-hotel management (Enterprise)
• QR-code in-room food ordering
• Mobile-responsive dashboard`,

    "KOT Features": `🎫 KOT SYSTEM FEATURES — BIREENA ATITHI

KOT = Kitchen Order Ticket
It is the digital system that connects the order-taking front to the kitchen.

✅ AUTO-GENERATION:
• KOT is auto-generated the moment a food order is placed
• Works via: QR code order, Waiter entry, Table View
• Instant — no manual slips, no errors

✅ KOT CONTENT (What it shows):
• Item name and quantity
• Table Number / Room Number
• Special instructions or allergy notes
• Time of order placement
• Order round number (1st order, 2nd round, etc.)

✅ ORDER STATUS TRACKING:
• Pending — order just placed
• In Progress — kitchen is preparing
• Served — food delivered to guest
• Billed — included in final invoice

✅ KITCHEN MANAGEMENT:
• Real-time kitchen display / printout
• Multiple KOT rounds per table supported
• Kitchen can update item status individually
• Items can be cancelled with reason

✅ BILLING INTEGRATION:
• KOT charges auto-added to guest room folio
• Or linked to table bill in Cashier Section
• Full F&B payment logs maintained

✅ QR ORDERING (No staff needed):
• Guest scans QR on room door
• Places order directly from phone
• KOT auto-sent to kitchen — zero human touchpoint`,

    "How KOT Works": `⚙️ HOW KOT WORKS — STEP BY STEP

KOT (Kitchen Order Ticket) is the backbone of Bireena Atithi's food service automation.

📱 FLOW 1 — QR CODE ORDERING (In-Room):
1. Hotel admin generates QR code per room from Property Setup → Generate Room QR
2. QR code is printed and placed on the room door
3. Guest scans QR using their mobile phone (no app or login required)
4. Guest sees the live food menu on their phone
5. Guest selects items and places the order
6. ✅ KOT is automatically generated instantly
7. KOT appears on the kitchen display/printer
8. Kitchen staff prepares the food
9. Status updated: Pending → In Progress → Served
10. Charges are auto-added to the guest's folio
11. Guest pays at the time of checkout

🍽️ FLOW 2 — WAITER / TABLE ORDERING:
1. Guest is seated at a restaurant table
2. Waiter opens Table View in the admin panel
3. Selects the table → Clicks "New Order"
4. Adds food items from the digital menu
5. Enters any special instructions
6. Clicks Submit
7. ✅ KOT is instantly generated and sent to kitchen
8. Kitchen prepares the order
9. Waiter serves the food → Marks as "Served"
10. Guest requests bill → Cashier generates final bill

🔄 MULTIPLE ROUNDS:
• Guests can place multiple orders (more rounds)
• Each round generates a new KOT
• All rounds are linked to the same table/room bill

📊 OVERALL FLOW SUMMARY:
Order Placed → KOT Generated → Kitchen Receives → Prepares → Serves → Bill Ready`,
};


// ─── Special local replies ────────────────────────────────────────────
const IDENTITY_REPLY = `Hey! 👋 I'm Advika AI! 🤖✨

I'm the intelligent virtual assistant of Bireena Atithi – a Smart Hotel & KOT Management Software.

🛠️ I was built by the Bireena Info Tech development team to help you explore and understand the Bireena Atithi platform.

I can instantly answer questions about:
• 📋 Reservation Process
• 🍽️ How to Order Food
• 💰 Pricing Plans
• 🪑 Table Booking Process
• 🏨 About Bireena Atithi

How can I help you today? 😊`;

const DEMO_REPLY = `🎯 Book a FREE Demo of Bireena Atithi!

To schedule your demo, please share:
1. Your Name
2. Email Address
3. Phone Number
4. Hotel Name
5. Number of Rooms

📞 +91 98765 43210
📧 support@bireenaatithi.com
🌐 https://bireenaatithi.com`;

const CONTACT_REPLY = `📞 CONTACT BIREENA ATITHI

• Email: support@bireenaatithi.com
• Phone: +91 98765 43210
• Website: https://bireenaatithi.com
• Address: B36, Mitra Mandal Colony, Anisabad, Patna, Bihar 800002

🕐 Support Hours:
• Email: 24/7
• Phone: 9 AM – 9 PM (IST), Mon–Sat`;

const GREETING_REPLY = `Hello! 👋 I'm Advika AI, your smart assistant for Bireena Atithi Hotel Management Software.

How can I help you today? You can ask me about:
• 📋 Reservation Process
• 🍽️ How to Order Food
• 💰 Pricing Plans
• 🪑 Table Booking Process
• 🏨 About Bireena Atithi`;

// ─── Pattern match ────────────────────────────────────────────────────
const match = (text, kw) => kw.some(k => text.includes(k));

const getInstantReply = (text) => {
    const t = text.toLowerCase().trim().replace(/[?!.]+$/, "");
    if (match(t, ["hi", "hello", "hey", "namaste", "hii", "hiii", "helo", "hai", "hye", "good morning", "good evening", "good afternoon", "howdy"]))
        return GREETING_REPLY;
    if (match(t, ["who are you", "what are you", "introduce", "your name", "kaun ho", "who made", "who created", "who developed", "who built", "who design", "advika kya", "about yourself"]))
        return IDENTITY_REPLY;
    if (match(t, ["demo", "free demo", "book demo", "trial", "try it"]))
        return DEMO_REPLY;
    if (match(t, ["contact", "phone number", "email address", "address", "reach us", "support", "helpline", "location"]))
        return CONTACT_REPLY;
    if (match(t, ["reservation", "booking", "book room", "reserve room", "check in", "check-in", "check out", "check-out"]))
        return INSTANT["Reservation Process"];
    if (match(t, ["food", "order food", "kot", "kitchen", "menu", "eating", "meal", "dining", "qr code", "in-room"]))
        return INSTANT["How to Order Food"];
    if (match(t, ["price", "pricing", "cost", "plan", "basic", "professional", "enterprise", "subscription", "₹", "fee", "how much"]))
        return INSTANT["Pricing Information"];
    if (match(t, ["table", "restaurant", "seat", "dine", "waiter", "table booking", "reserve table"]))
        return INSTANT["Table Booking Process"];
    if (match(t, ["about", "company", "bireena", "atithi", "team", "founder", "history", "mission", "story"]))
        return INSTANT["About Bireena Atithi"];
    if (match(t, ["hotel feature", "features", "what can it do", "software features", "what does it do", "capabilities", "modules", "what is included"]))
        return INSTANT["Hotel Features"];
    if (match(t, ["kot feature", "kot system", "kitchen order", "what is kot", "kot kya", "kot details"]))
        return INSTANT["KOT Features"];
    if (match(t, ["how kot works", "kot process", "kot flow", "kot kaise", "how does kot", "how kitchen order"]))
        return INSTANT["How KOT Works"];
    return null;
};

// ─── OpenRouter call (unknown queries fallback) ───────────────────────
const KB_SUMMARY = `Bireena Atithi is a Hotel & KOT Management Software. Features: reservations, KOT automation, billing, housekeeping, QR food ordering, analytics. Plans: Basic ₹19,999/mo, Professional ₹14,999/mo, Enterprise custom. Contact: support@bireenaatithi.com | +91 98765 43210.`;

const callOpenRouter = async (text) => {
    const res = await apiCall(OR_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OR_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://bireenaatithi.com",
            "X-Title": "Advika AI",
        },
        body: JSON.stringify({
            model: OR_MODEL,
            messages: [
                { role: "system", content: `You are Advika AI for Bireena Atithi. Answer using only: ${KB_SUMMARY}. Be concise.` },
                { role: "user", content: text },
            ],
            temperature: 0.3,
            max_tokens: 400,
        }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
};

// ─── TTS — StreamElements (Amazon Polly "Joanna" – natural female voice) ─
let currentAudio = null;

const stopCurrentAudio = () => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    try { window.speechSynthesis.cancel(); } catch { }
};

const speakStreamElements = (text, onEnd) => {
    stopCurrentAudio();
    // Strip emojis & special chars for cleaner TTS
    const clean = text
        .replace(/[^\x00-\x7F]/g, " ")
        .replace(/[•━─]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 450);

    const url = `https://api.streamelements.com/kappa/v2/speech?voice=Joanna&text=${encodeURIComponent(clean)}`;
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => { currentAudio = null; onEnd(); };
    audio.onerror = () => {
        // Fallback: browser Web Speech
        currentAudio = null;
        try {
            const utt = new SpeechSynthesisUtterance(clean);
            const voices = window.speechSynthesis.getVoices();
            const best = voices.find(v =>
                ["Zira", "Samantha", "Google UK English Female", "Victoria", "Karen", "Aria"].some(n => v.name.includes(n))
                && v.lang.startsWith("en")
            ) || voices.find(v => v.lang.startsWith("en"));
            if (best) utt.voice = best;
            utt.rate = 0.9; utt.pitch = 1.1;
            utt.onend = onEnd; utt.onerror = onEnd;
            window.speechSynthesis.speak(utt);
        } catch { onEnd(); }
    };
    audio.play().catch(() => audio.onerror?.());
};

// ────────────────────────────────────────────────────────────────────
//  COMPONENT
// ────────────────────────────────────────────────────────────────────
export default function AdvikaAI() {
    const [showVideo, setShowVideo] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [speakingIdx, setSpeakingIdx] = useState(-1);   // which msg is speaking

    const videoRef = useRef(null);
    const chatBodyRef = useRef(null);
    const msgRefs = useRef([]);           // ref per dynamic message

    // ── Scroll: show TOP of newest bot message — within chat-body ONLY ─
    useEffect(() => {
        const lastBotIdx = [...messages].reverse().findIndex(m => m.role === "bot");
        if (lastBotIdx === -1) return;
        const idx = messages.length - 1 - lastBotIdx;
        const el = msgRefs.current[idx];
        const box = chatBodyRef.current;
        if (el && box) {
            // Scroll ONLY inside the chat container — page stays still
            const topInsideBox = el.offsetTop - box.offsetTop;
            box.scrollTo({ top: topInsideBox, behavior: "smooth" });
        }
    }, [messages]);


    // ── Scroll to bottom for loading indicator ─────────────────────
    useEffect(() => {
        if (isLoading && chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [isLoading]);

    // Stop speech on chat close
    useEffect(() => {
        if (!showChat) {
            stopCurrentAudio();
            setSpeakingIdx(-1);
        }
    }, [showChat]);

    // ── TTS speak / stop toggle — StreamElements Polly Joanna voice ──
    const handleSpeak = useCallback((text, idx) => {
        if (speakingIdx === idx) {
            stopCurrentAudio();
            setSpeakingIdx(-1);
            return;
        }
        setSpeakingIdx(idx);
        speakStreamElements(text, () => setSpeakingIdx(-1));
    }, [speakingIdx]);

    const handleIconClick = () => {
        setShowVideo(true);
        setTimeout(() => videoRef.current?.play(), 150);
    };
    const handleVideoEnd = () => { setShowVideo(false); setShowChat(true); };
    const handleCloseChat = () => { setShowChat(false); };

    // ── Send message (3-tier) ───────────────────────────────────────
    const sendMessage = async (userText, isButton = false) => {
        if (!userText.trim() || isLoading) return;
        const trimmed = userText.trim();
        setMessages(prev => [...prev, { role: "user", text: trimmed }]);
        setInputValue("");
        setIsLoading(true);

        // Tier 1 – predefined button
        if (isButton && INSTANT[trimmed]) {
            setTimeout(() => {
                setMessages(prev => [...prev, { role: "bot", text: INSTANT[trimmed] }]);
                setIsLoading(false);
            }, 300);
            return;
        }
        // Tier 2 – keyword match
        const local = getInstantReply(trimmed);
        if (local) {
            setTimeout(() => {
                setMessages(prev => [...prev, { role: "bot", text: local }]);
                setIsLoading(false);
            }, 400);
            return;
        }
        // Tier 3 – OpenRouter AI
        try {
            const ai = await callOpenRouter(trimmed);
            setMessages(prev => [...prev, {
                role: "bot",
                text: ai || "I'm not sure about that. Please contact support@bireenaatithi.com or call +91 98765 43210 😊"
            }]);
        } catch {
            setMessages(prev => [...prev, {
                role: "bot",
                text: "I'm not sure about that specific question.\n\n📧 support@bireenaatithi.com\n📞 +91 98765 43210\n\nOr ask me about Reservations, Food Ordering, Pricing, or Table Booking! 😊"
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="advika-wrapper">

            {/* VIDEO — UNTOUCHED */}
            {showVideo && (
                <div className="w-[240px] h-[240px] bg-black rounded-full overflow-hidden shadow-2xl border-4 border-pink-400 z-[1000] flex items-center justify-center mb-5">
                    <video ref={videoRef} src={botVideo} autoPlay playsInline
                        onEnded={handleVideoEnd} className="w-full h-full object-cover" />
                </div>
            )}

            {/* CHATBODY */}
            {showChat && (
                <div className="chat-container">

                    <div className="chat-header">
                        <span>✨ Advika AI</span>
                        <button onClick={handleCloseChat}>✕</button>
                    </div>

                    <div className="chat-body" ref={chatBodyRef}>

                        {/* Static welcome */}
                        <div className="bot-message">
                            👋 Welcome to Bireena Atithi!<br />
                            How can I assist you today?
                        </div>

                        {/* Quick options — RENAMED */}
                        <div className="quick-options">
                            <button onClick={() => sendMessage("Reservation Process", true)}>📋 Reservation Process</button>
                            <button onClick={() => sendMessage("How to Order Food", true)}>🍽️ How to Order Food</button>
                            <button onClick={() => sendMessage("Pricing Information", true)}>💰 Pricing Information</button>
                            <button onClick={() => sendMessage("Table Booking Process", true)}>🪑 Table Booking Process</button>
                            <button onClick={() => sendMessage("About Bireena Atithi", true)}>🏨 About Bireena Atithi</button>
                            <button onClick={() => sendMessage("Hotel Features", true)}>🏢 Hotel Features</button>
                            <button onClick={() => sendMessage("KOT Features", true)}>🎫 KOT Features</button>
                            <button onClick={() => sendMessage("How KOT Works", true)}>⚙️ How KOT Works</button>
                        </div>

                        {/* Dynamic messages */}
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                ref={el => msgRefs.current[i] = el}
                                className={msg.role === "user" ? "user-message" : "bot-message"}
                                style={msg.role === "user" ? {
                                    background: "linear-gradient(135deg, #e11d48, #be123c)",
                                    color: "#fff",
                                    borderRadius: "20px 20px 4px 20px",
                                    marginLeft: "auto",
                                    width: "fit-content",
                                    maxWidth: "80%",
                                    padding: "12px 16px",
                                    fontSize: "13px",
                                    marginBottom: "12px",
                                    wordBreak: "break-word",
                                    lineHeight: 1.5,
                                } : {
                                    position: "relative",
                                    marginBottom: "12px",
                                    whiteSpace: "pre-wrap",
                                    lineHeight: 1.7,
                                    paddingTop: "28px",   // space for voice icon
                                }}
                            >
                                {/* Voice icon — bot messages only */}
                                {msg.role === "bot" && (
                                    <button
                                        onClick={() => handleSpeak(msg.text, i)}
                                        title={speakingIdx === i ? "Stop voice" : "Play voice"}
                                        style={{
                                            position: "absolute",
                                            top: 6,
                                            right: 8,
                                            background: speakingIdx === i
                                                ? "linear-gradient(135deg,#e11d48,#be123c)"
                                                : "rgba(225,29,72,0.1)",
                                            border: "none",
                                            borderRadius: "50%",
                                            width: 24,
                                            height: 24,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 12,
                                            transition: "all 0.3s ease",
                                            flexShrink: 0,
                                        }}
                                        aria-label={speakingIdx === i ? "Stop" : "Speak"}
                                    >
                                        {speakingIdx === i ? "⏹️" : "🔊"}
                                    </button>
                                )}
                                {msg.text}
                            </div>
                        ))}

                        {/* Typing dots */}
                        {isLoading && (
                            <div className="bot-message" style={{ display: "flex", gap: 5, alignItems: "center", width: "fit-content", padding: "12px 18px" }}>
                                {[0, 0.2, 0.4].map((d, i) => (
                                    <span key={i} style={{
                                        width: 8, height: 8, borderRadius: "50%",
                                        background: "#e11d48", display: "inline-block",
                                        animation: `advika-bounce 1.2s ${d}s infinite ease-in-out`,
                                    }} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="chat-input-wrapper">
                        <div className="chat-input">
                            <button className="mic">🎤</button>
                            <input
                                placeholder="Type a message..."
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage(inputValue, false);
                                    }
                                }}
                                disabled={isLoading}
                            />
                            <button className="send"
                                onClick={() => sendMessage(inputValue, false)}
                                disabled={isLoading || !inputValue.trim()}
                            >➤</button>
                        </div>
                    </div>

                </div>
            )}

            {/* BOT ICON */}
            <div
                className={`bot-icon transition-all duration-300 ${showChat ? "opacity-0 pointer-events-none scale-75" : "opacity-100 scale-100"}`}
                onClick={handleIconClick}
            >
                <img src={avatar} alt="Advika AI" />
            </div>
        </div>
    );
}
