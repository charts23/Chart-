import { useState, useRef, useCallback, useEffect } from "react";

const SYSTEM_PROMPT = `You are an elite professional forex technical analyst with 20+ years of experience trading all currency pairs. Your job is to analyze candlestick chart images and produce highly accurate trading signals.

When given a chart image, you must:
1. Identify the overall trend direction (bullish, bearish, or sideways)
2. Detect key support and resistance levels (give approximate price values if visible, or describe zones)
3. Identify any chart patterns (head & shoulders, double top/bottom, triangles, flags, wedges, pin bars, engulfing candles, etc.)
4. Determine a clear BUY, SELL, or NEUTRAL (wait) signal
5. Suggest entry price, stop loss, and take profit levels based on the chart structure
6. Give a confidence score from 0-100 based on how strong the setup is
7. Calculate or estimate the risk/reward ratio
8. Provide clear reasoning for your analysis

IMPORTANT: Respond ONLY with a valid JSON object. No markdown, no backticks, no extra text. Use this exact structure:
{
  "signal": "BUY" | "SELL" | "NEUTRAL",
  "trend": "BULLISH" | "BEARISH" | "SIDEWAYS",
  "entry": "price or description",
  "stop_loss": "price or description",
  "take_profit_1": "price or description",
  "take_profit_2": "price or description",
  "confidence": number (0-100),
  "risk_reward": "e.g. 1:2.5",
  "support_levels": ["level1", "level2"],
  "resistance_levels": ["level1", "level2"],
  "patterns_detected": ["pattern1", "pattern2"],
  "timeframe_suitability": ["M1/M5", "M15/M30", "H1/H4"],
  "reasoning": "Detailed explanation of the analysis in 3-5 sentences",
  "caution": "Any important warnings or caveats"
}`;

const GlowOrb = ({ style }) => (
  <div style={{
    position: "absolute", borderRadius: "50%",
    filter: "blur(80px)", opacity: 0.15, pointerEvents: "none",
    ...style
  }} />
);

const ScanLine = () => (
  <div style={{
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,170,0.015) 2px, rgba(0,255,170,0.015) 4px)",
    pointerEvents: "none", borderRadius: "inherit", zIndex: 0
  }} />
);

const Ticker = () => {
  const pairs = ["EUR/USD 1.0842 ▲", "GBP/USD 1.2631 ▼", "XAU/USD 2318.4 ▲", "USD/JPY 157.23 ▲", "AUD/USD 0.6571 ▼", "NZD/USD 0.5981 ▼", "USD/CAD 1.3682 ▲", "EUR/GBP 0.8582 ▼"];
  return (
    <div style={{ overflow: "hidden", borderBottom: "1px solid #0aff9d22", background: "#010a06", padding: "6px 0", position: "relative" }}>
      <div style={{
        display: "flex", gap: 48, whiteSpace: "nowrap",
        animation: "ticker 18s linear infinite",
        width: "max-content"
      }}>
        {[...pairs, ...pairs].map((p, i) => (
          <span key={i} style={{
            fontSize: 11, fontFamily: "'Share Tech Mono', monospace",
            color: p.includes("▲") ? "#0aff9d" : "#ff4d6d",
            letterSpacing: 1
          }}>{p}</span>
        ))}
      </div>
    </div>
  );
};

const PulsingDot = ({ color = "#0aff9d" }) => (
  <span style={{ position: "relative", display: "inline-block", width: 10, height: 10 }}>
    <span style={{
      position: "absolute", inset: 0, borderRadius: "50%",
      background: color, animation: "ping 1.5s ease-out infinite", opacity: 0.6
    }} />
    <span style={{ position: "absolute", inset: 2, borderRadius: "50%", background: color }} />
  </span>
);

const ConfidenceBar = ({ value, color }) => (
  <div style={{ marginTop: 8 }}>
    <div style={{ height: 6, background: "#0d1f14", borderRadius: 99, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${value}%`,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        borderRadius: 99,
        transition: "width 1.2s cubic-bezier(.16,1,.3,1)",
        boxShadow: `0 0 10px ${color}88`
      }} />
    </div>
  </div>
);

export default function WeltradeAnalyzer() {
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState("image/png");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef();

  useEffect(() => { setMounted(true); }, []);

  const loadingSteps = [
    "Scanning candlestick formations...",
    "Mapping support & resistance zones...",
    "Detecting chart patterns...",
    "Calculating entry & exit levels...",
    "Computing confidence score...",
    "Generating signal report...",
  ];

  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const iv = setInterval(() => setLoadingStep(s => (s + 1) % loadingSteps.length), 900);
    return () => clearInterval(iv);
  }, [loading]);

  const processFile = (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please upload a valid image file (PNG, JPG, WEBP).");
      return;
    }
    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(",")[1];
      setImage(e.target.result);
      setImageBase64(base64);
      setAnalysis(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, []);

  const analyzeChart = async () => {
    if (!imageBase64) return;
    setLoading(true); setError(null); setAnalysis(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: imageMime, data: imageBase64 } },
              { type: "text", text: "Analyze this forex candlestick chart and provide a full trading signal in the exact JSON format specified. Be precise, professional, and accurate." }
            ]
          }]
        })
      });
      const data = await response.json();
      const raw = data.content?.map(b => b.text || "").join("").trim();
      const cleaned = raw.replace(/```json|```/g, "").trim();
      setAnalysis(JSON.parse(cleaned));
    } catch {
      setError("Analysis failed. Please ensure your chart is a clear candlestick image and try again.");
    } finally { setLoading(false); }
  };

  const sigColor = (s) => s === "BUY" ? "#0aff9d" : s === "SELL" ? "#ff4d6d" : "#f5c518";
  const confColor = (v) => v >= 75 ? "#0aff9d" : v >= 50 ? "#f5c518" : "#ff4d6d";
  const reset = () => { setImage(null); setImageBase64(null); setAnalysis(null); setError(null); };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#01090a",
      fontFamily: "'Share Tech Mono', 'Courier New', monospace",
      color: "#a8ffda",
      overflowX: "hidden",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes ping { 0% { transform: scale(1); opacity: .8 } 100% { transform: scale(2.5); opacity: 0 } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes glow-pulse { 0%,100% { box-shadow: 0 0 20px #0aff9d33 } 50% { box-shadow: 0 0 50px #0aff9d77 } }
        @keyframes scan { 0% { top: -100% } 100% { top: 100% } }
        @keyframes spin-slow { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        ::-webkit-scrollbar { width: 4px } ::-webkit-scrollbar-track { background: #010a06 } ::-webkit-scrollbar-thumb { background: #0aff9d44; border-radius: 2px }
        .upload-zone:hover { border-color: #0aff9daa !important; background: #010f08 !important; }
        .analyze-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 40px #0aff9d44 !important; }
        .reset-btn:hover { color: #0aff9d !important; border-color: #0aff9d44 !important; }
        .card-glow { transition: box-shadow 0.3s; }
        .card-glow:hover { box-shadow: 0 0 30px #0aff9d18; }
      `}</style>

      {/* Background orbs */}
      <GlowOrb style={{ width: 600, height: 600, top: -200, left: -200, background: "#0aff9d" }} />
      <GlowOrb style={{ width: 400, height: 400, bottom: 0, right: -100, background: "#00b4ff" }} />
      <GlowOrb style={{ width: 300, height: 300, top: "40%", right: "20%", background: "#ff4d6d" }} />

      {/* Ticker */}
      <Ticker />

      {/* Header */}
      <div style={{
        padding: "18px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid #0aff9d18",
        background: "linear-gradient(180deg, #010f0822 0%, transparent 100%)",
        animation: mounted ? "fadeUp 0.6s ease both" : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 44, height: 44,
            border: "2px solid #0aff9d55",
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#0aff9d11",
            animation: "glow-pulse 3s ease infinite",
          }}>
            <span style={{ fontSize: 22 }}>📡</span>
          </div>
          <div>
            <div style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 17, fontWeight: 900,
              color: "#ffffff",
              letterSpacing: 3,
              textShadow: "0 0 20px #0aff9d66"
            }}>WELTRADE</div>
            <div style={{ fontSize: 9, color: "#0aff9d", letterSpacing: 4 }}>SIGNAL INTELLIGENCE · AI CORE v2.4</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {["FOREX", "GOLD", "ALL PAIRS"].map((t) => (
            <span key={t} style={{ fontSize: 9, color: "#0aff9d88", letterSpacing: 2 }}>{t}</span>
          ))}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <PulsingDot />
            <span style={{ fontSize: 10, color: "#0aff9d", letterSpacing: 1 }}>ONLINE</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px" }}>

        {/* Hero title */}
        {!analysis && (
          <div style={{
            textAlign: "center", marginBottom: 40,
            animation: mounted ? "fadeUp 0.8s ease 0.1s both" : "none"
          }}>
            <div style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 34, fontWeight: 900,
              color: "#fff",
              letterSpacing: 4,
              lineHeight: 1.2,
              textShadow: "0 0 40px #0aff9d55"
            }}>CHART SIGNAL<br />
              <span style={{ color: "#0aff9d" }}>ANALYZER</span>
            </div>
            <div style={{ fontSize: 12, color: "#4a8a65", marginTop: 12, letterSpacing: 2 }}>
              UPLOAD YOUR WELTRADE CANDLESTICK CHART · GET INSTANT AI SIGNALS
            </div>
          </div>
        )}

        {/* Upload Zone */}
        {!analysis && (
          <div style={{ animation: mounted ? "fadeUp 0.8s ease 0.2s both" : "none", marginBottom: 20 }}>
            <div
              className="upload-zone"
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => !image && fileRef.current.click()}
              style={{
                border: `2px dashed ${dragging ? "#0aff9d" : image ? "#0aff9d66" : "#0aff9d33"}`,
                borderRadius: 16,
                padding: image ? "20px" : "0",
                minHeight: image ? "auto" : 260,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                cursor: image ? "default" : "pointer",
                background: dragging ? "#0aff9d08" : "#010d08",
                transition: "all 0.25s",
                position: "relative", overflow: "hidden",
              }}
            >
              <ScanLine />
              {/* scanning beam when dragging */}
              {dragging && (
                <div style={{
                  position: "absolute", left: 0, right: 0, height: 2,
                  background: "linear-gradient(90deg, transparent, #0aff9d, transparent)",
                  animation: "scan 1s linear infinite", zIndex: 2
                }} />
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => processFile(e.target.files[0])} />

              {image ? (
                <div style={{ width: "100%", position: "relative", zIndex: 1 }}>
                  <img src={image} alt="chart"
                    style={{ width: "100%", maxHeight: 420, objectFit: "contain", borderRadius: 10, display: "block" }} />
                  <div style={{
                    marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0 4px"
                  }}>
                    <span style={{ fontSize: 11, color: "#0aff9d", letterSpacing: 1 }}>
                      ✓ Chart ready for analysis
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); reset(); }} style={{
                      background: "none", border: "1px solid #ff4d6d44", color: "#ff4d6d",
                      fontSize: 10, padding: "3px 10px", borderRadius: 4, cursor: "pointer",
                      fontFamily: "inherit", letterSpacing: 1
                    }}>✕ REMOVE</button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", zIndex: 1, padding: "40px 20px" }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: "50%",
                    border: "2px solid #0aff9d33",
                    margin: "0 auto 20px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#0aff9d0a",
                    fontSize: 32,
                    animation: "glow-pulse 3s ease infinite"
                  }}>📊</div>
                  <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 14, color: "#fff", letterSpacing: 2, marginBottom: 8 }}>
                    DROP CHART HERE
                  </div>
                  <div style={{ fontSize: 11, color: "#4a8a65", letterSpacing: 1, marginBottom: 16 }}>
                    or click to browse your files
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    {["PNG", "JPG", "WEBP", "Candlestick Only"].map(t => (
                      <span key={t} style={{
                        fontSize: 9, padding: "3px 10px",
                        border: "1px solid #0aff9d22",
                        borderRadius: 99, color: "#0aff9d88", letterSpacing: 1
                      }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Or paste URL hint */}
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 10, color: "#2a5a3a", letterSpacing: 1 }}>
              SUPPORTS ALL WELTRADE CHART SCREENSHOTS · SCALPING · SWING · ALL PAIRS
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "#ff4d6d0d", border: "1px solid #ff4d6d44",
            borderRadius: 10, padding: "14px 18px", marginBottom: 16,
            display: "flex", gap: 10, alignItems: "center",
            animation: "fadeUp 0.3s ease both"
          }}>
            <span style={{ fontSize: 18 }}>⚠</span>
            <span style={{ fontSize: 12, color: "#ff9aaa" }}>{error}</span>
          </div>
        )}

        {/* Analyze Button */}
        {image && !analysis && !loading && (
          <button className="analyze-btn" onClick={analyzeChart} style={{
            width: "100%", padding: "16px",
            background: "linear-gradient(135deg, #0aff9d22, #00b4ff22)",
            border: "1px solid #0aff9d77",
            borderRadius: 12, color: "#0aff9d",
            fontSize: 13, fontWeight: "bold", letterSpacing: 3,
            cursor: "pointer", fontFamily: "'Orbitron', monospace",
            transition: "all 0.25s",
            boxShadow: "0 0 20px #0aff9d22",
            animation: "fadeUp 0.4s ease both"
          }}>
            ⚡ GENERATE SIGNAL
          </button>
        )}

        {/* Loading */}
        {loading && (
          <div style={{
            textAlign: "center", padding: "50px 20px",
            animation: "fadeUp 0.4s ease both"
          }}>
            <div style={{
              width: 80, height: 80, margin: "0 auto 28px",
              border: "2px solid #0aff9d22",
              borderTop: "2px solid #0aff9d",
              borderRadius: "50%",
              animation: "spin-slow 1s linear infinite"
            }} />
            <div style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 11, color: "#0aff9d", letterSpacing: 3,
              animation: "blink 1s ease infinite"
            }}>
              {loadingSteps[loadingStep]}
            </div>
            <div style={{ fontSize: 10, color: "#2a5a3a", marginTop: 8, letterSpacing: 2 }}>
              AI CORE PROCESSING · PLEASE WAIT
            </div>
          </div>
        )}

        {/* RESULTS */}
        {analysis && (
          <div style={{ animation: "fadeUp 0.6s ease both" }}>

            {/* Signal Hero Card */}
            <div style={{
              background: `linear-gradient(135deg, ${sigColor(analysis.signal)}0d 0%, #010d08 60%)`,
              border: `1px solid ${sigColor(analysis.signal)}44`,
              borderRadius: 16, padding: "28px 28px 24px",
              marginBottom: 16, position: "relative", overflow: "hidden",
            }} className="card-glow">
              <ScanLine />
              <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#4a8a65", letterSpacing: 4, marginBottom: 8 }}>PRIMARY SIGNAL</div>
                  <div style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: 48, fontWeight: 900,
                    color: sigColor(analysis.signal),
                    textShadow: `0 0 40px ${sigColor(analysis.signal)}99`,
                    letterSpacing: 4, lineHeight: 1
                  }}>
                    {analysis.signal === "BUY" ? "▲ BUY" : analysis.signal === "SELL" ? "▼ SELL" : "◆ WAIT"}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#4a8a65" }}>TREND: <span style={{
                      color: analysis.trend === "BULLISH" ? "#0aff9d" : analysis.trend === "BEARISH" ? "#ff4d6d" : "#f5c518"
                    }}>{analysis.trend}</span></span>
                    <span style={{ fontSize: 11, color: "#4a8a65" }}>R:R <span style={{ color: "#a8ffda" }}>{analysis.risk_reward}</span></span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "#4a8a65", letterSpacing: 4, marginBottom: 8 }}>CONFIDENCE</div>
                  <div style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: 52, fontWeight: 900,
                    color: confColor(analysis.confidence),
                    textShadow: `0 0 30px ${confColor(analysis.confidence)}88`
                  }}>{analysis.confidence}<span style={{ fontSize: 22 }}>%</span></div>
                  <ConfidenceBar value={analysis.confidence} color={confColor(analysis.confidence)} />
                </div>
              </div>
            </div>

            {/* Levels Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 10 }}>
              {[
                { label: "ENTRY", value: analysis.entry, color: "#00b4ff", icon: "⟶" },
                { label: "STOP LOSS", value: analysis.stop_loss, color: "#ff4d6d", icon: "✕" },
                { label: "TAKE PROFIT 1", value: analysis.take_profit_1, color: "#0aff9d", icon: "★" },
                { label: "TAKE PROFIT 2", value: analysis.take_profit_2, color: "#69ffc4", icon: "★★" },
              ].map(item => (
                <div key={item.label} style={{
                  background: `linear-gradient(135deg, ${item.color}08, #010d08)`,
                  border: `1px solid ${item.color}33`,
                  borderRadius: 12, padding: "16px 18px",
                  position: "relative", overflow: "hidden"
                }} className="card-glow">
                  <ScanLine />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ fontSize: 9, color: "#4a8a65", letterSpacing: 3, marginBottom: 6 }}>{item.icon} {item.label}</div>
                    <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 16, fontWeight: 700, color: item.color, letterSpacing: 1 }}>
                      {item.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Patterns + Levels */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ background: "#010d08", border: "1px solid #0aff9d1a", borderRadius: 12, padding: "16px 18px" }} className="card-glow">
                <div style={{ fontSize: 9, color: "#4a8a65", letterSpacing: 3, marginBottom: 12 }}>◆ PATTERNS DETECTED</div>
                {analysis.patterns_detected?.length > 0
                  ? analysis.patterns_detected.map((p, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#f5c518", marginBottom: 6, letterSpacing: 1 }}>› {p}</div>
                  ))
                  : <div style={{ fontSize: 11, color: "#2a5a3a" }}>No clear patterns</div>}
              </div>

              <div style={{ background: "#010d08", border: "1px solid #0aff9d1a", borderRadius: 12, padding: "16px 18px" }} className="card-glow">
                <div style={{ fontSize: 9, color: "#4a8a65", letterSpacing: 3, marginBottom: 12 }}>⬆⬇ KEY ZONES</div>
                {analysis.resistance_levels?.map((r, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#ff4d6d", marginBottom: 4, letterSpacing: 1 }}>R› {r}</div>
                ))}
                {analysis.support_levels?.map((s, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#0aff9d", marginBottom: 4, letterSpacing: 1 }}>S› {s}</div>
                ))}
              </div>
            </div>

            {/* Timeframes */}
            <div style={{ background: "#010d08", border: "1px solid #0aff9d1a", borderRadius: 12, padding: "16px 18px", marginBottom: 10 }} className="card-glow">
              <div style={{ fontSize: 9, color: "#4a8a65", letterSpacing: 3, marginBottom: 12 }}>◎ VALID ON TIMEFRAMES</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {analysis.timeframe_suitability?.map((tf, i) => (
                  <span key={i} style={{
                    fontFamily: "'Orbitron', monospace",
                    background: "#0aff9d11", border: "1px solid #0aff9d33",
                    borderRadius: 6, padding: "5px 14px", fontSize: 11, color: "#0aff9d", letterSpacing: 1
                  }}>{tf}</span>
                ))}
              </div>
            </div>

            {/* Reasoning */}
            <div style={{ background: "#010d08", border: "1px solid #0aff9d1a", borderRadius: 12, padding: "18px", marginBottom: 10 }} className="card-glow">
              <div style={{ fontSize: 9, color: "#4a8a65", letterSpacing: 3, marginBottom: 10 }}>▸ ANALYST REASONING</div>
              <div style={{ fontSize: 12, color: "#a8ffda", lineHeight: 1.8, letterSpacing: 0.5 }}>{analysis.reasoning}</div>
            </div>

            {/* Caution */}
            {analysis.caution && (
              <div style={{
                background: "#f5c5180a", border: "1px solid #f5c51833",
                borderRadius: 12, padding: "14px 18px", marginBottom: 16
              }}>
                <div style={{ fontSize: 9, color: "#f5c518", letterSpacing: 3, marginBottom: 8 }}>⚠ RISK CAUTION</div>
                <div style={{ fontSize: 12, color: "#ffe08a", lineHeight: 1.7 }}>{analysis.caution}</div>
              </div>
            )}

            {/* Chart thumbnail */}
            {image && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, color: "#2a5a3a", letterSpacing: 3, marginBottom: 8 }}>ANALYZED CHART</div>
                <img src={image} alt="chart" style={{ width: "100%", borderRadius: 10, border: "1px solid #0aff9d1a" }} />
              </div>
            )}

            {/* Disclaimer */}
            <div style={{
              fontSize: 9, color: "#1a4a2a", textAlign: "center", marginBottom: 16, lineHeight: 1.8, letterSpacing: 1
            }}>
              AI SIGNAL FOR EDUCATIONAL USE · ALWAYS USE YOUR OWN RISK MANAGEMENT<br />
              MAX 1-2% RISK PER TRADE · PAST SIGNALS DO NOT GUARANTEE FUTURE RESULTS
            </div>

            <button className="reset-btn" onClick={reset} style={{
              width: "100%", padding: "13px",
              background: "transparent", border: "1px solid #0aff9d22",
              borderRadius: 10, color: "#4a8a65",
              fontSize: 11, cursor: "pointer",
              fontFamily: "'Orbitron', monospace", letterSpacing: 2,
              transition: "all 0.2s"
            }}>↺ ANALYZE NEW CHART</button>
          </div>
        )}
      </div>
    </div>
  );
}
