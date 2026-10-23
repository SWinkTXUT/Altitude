"""Generate the bundled voice cues with Kokoro TTS (voice: af_heart).

Usage: python3 tools/gen_voice.py <kokoro-v1.0.onnx> <voices-v1.0.bin> [clip_key ...]
Writes audio/voice/*.mp3 and audio/voice/manifest.json (clip durations).
"""
import json, os, subprocess, sys, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()

def words(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])
    rest = n % 100
    return ONES[n // 100] + " hundred" + ("" if rest == 0 else " and " + words(rest))

P = {
    "welcome": "Welcome to Altitude. Let's get started.",
    "welcome_baseline": "Welcome to Altitude. Today is your baseline test.",
    "welcome_retest": "Welcome back. Today is a retest, to see how far you've come.",
    "welcome_light": "Welcome back. Today is a lighter recovery session. Nice and easy.",
    "start_walking": "Start walking at an easy, comfortable pace. Breathe in and out through your nose.",
    "sigh_intro": "Let's do a physiological sigh.",
    "sigh_in": "Deep breath in through your nose.",
    "sigh_top": "Now a short sip of air on top.",
    "sigh_out": "And a long, slow exhale through your mouth.",
    "relax": "Relax your shoulders. Keep your breathing light, quiet, and through the nose.",
    "safety": "Remember, if you ever feel dizzy or uncomfortable, just breathe. You can always release a hold early.",
    "final_round": "Final round.",
    "prep_in": "Take a normal breath in through your nose.",
    "prep_out": "And gently breathe out.",
    "hold_go": "Pinch your nose and hold. Keep walking.",
    "halfway": "Halfway.",
    "ten_left": "Ten seconds.",
    "breathe": "Breathe. Small, calm breaths through your nose.",
    "recover_1": "Nice work. Let your breathing settle.",
    "recover_2": "Good. Keep walking, and recover through your nose.",
    "recover_3": "Well done. Easy, gentle breaths.",
    "recover_4": "Great hold. Calm your breathing down.",
    "enc_1": "Stay relaxed.",
    "enc_2": "Loose shoulders. Keep moving.",
    "enc_3": "You've got this.",
    "enc_4": "Strong and steady.",
    "get_ready": "Get ready for the next one.",
    "baseline_explain": "In a moment, you'll breathe out gently, and hold for as long as is comfortable, up to twenty seconds, "
                        "while you keep walking. I'll count the seconds. When you need to breathe, tap stop on your screen, "
                        "or tap your earbuds, and breathe.",
    "retest_explain": "In a moment, you'll breathe out gently, and hold for as long as is comfortable, up to forty seconds, "
                      "while you keep walking. I'll count the seconds. When you need to breathe, tap stop on your screen, "
                      "or tap your earbuds, and breathe.",
    "test_cap": "Twenty seconds. Great hold. Breathe now.",
    "test_cap_40": "Forty seconds. Incredible hold. Breathe now.",
    "baseline_done": "Good. Breathe normally, nice and easy.",
    "last_done": "That's the last hold. Great work today.",
    "cooldown": "Keep walking easy, breathing through your nose. Let your heart rate come down.",
    "complete": "Session complete. You're one step higher. See you tomorrow.",
    "complete_test": "Session complete. Take out your phone to check your result.",
}
for i in range(1, 13):
    P[f"round_{i}"] = f"Round {words(i)}."
for n in range(1, 41):
    P[f"n_{n}"] = words(n).capitalize() + "."
for n in range(5, 181, 5):
    P[f"count_{n}"] = words(n).capitalize() + "."
for n in range(5, 151):
    P[f"hold_{n}"] = f"{words(n).capitalize()} second hold."

def trim(x, sr, thresh=0.01, pad=0.04):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0: return x
    a = max(0, idx[0] - int(pad * sr)); b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]

def main(model, voices, only=None):
    k = Kokoro(model, voices)
    out = os.path.join(os.path.dirname(__file__), "..", "audio", "voice")
    mpath = os.path.join(out, "manifest.json")
    manifest = json.load(open(mpath)) if only and os.path.exists(mpath) else {}
    for key, text in P.items():
        if only and key not in only: continue
        mp3 = os.path.join(out, key + ".mp3")
        s, sr = k.create(text, voice="af_heart", speed=0.95, lang="en-us")
        s = trim(np.asarray(s, dtype=np.float32), sr)
        s = s / max(1e-6, np.abs(s).max()) * 0.89
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            sf.write(tmp.name, s, sr)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-ac", "1",
                            "-ar", "24000", "-b:a", "48k", mp3], check=True)
        manifest[key] = round(len(s) / sr, 3)
        print(key, manifest[key], flush=True)
    with open(mpath, "w") as f:
        json.dump(manifest, f, separators=(",", ":"))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], set(sys.argv[3:]) or None)
