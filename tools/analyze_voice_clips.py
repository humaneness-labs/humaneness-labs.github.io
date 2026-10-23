"""Extract loudness envelopes and phrase timings for the Voice Large 1.3 Alpha clips.

Usage: python3 tools/analyze_voice_clips.py docs docs/assets/js/voice-clips.js
Reads the scene scripts from the release page, decodes each MP3 with ffmpeg
(must be on PATH), finds pauses, aligns punctuation-delimited phrases to them and
writes the JS data module used for captions and waveforms. Re-run it whenever
clips or scripts change.
"""
import base64
import html
import json
import math
import os
import re
import struct
import subprocess
import sys

DOCS = sys.argv[1]
OUT = sys.argv[2]
PAGE = f"{DOCS}/blog/humaneness-voice-large-1-3-alpha/index.html"
AUDIO = f"{DOCS}/assets/audio/voice-large-1-3-alpha"
SR = 8000
HOP = 0.02  # 20 ms analysis windows
ENV_RATE = 25  # envelope samples per second shipped to the browser

page = open(PAGE, encoding="utf-8").read()
scene_scripts = {}
for scene, body in re.findall(r'<article class="vr-scene" data-scene="([a-z_]+)".*?>(.*?)</article>', page, re.S):
    for lang, text in re.findall(r'<p lang="([a-z]+)" data-script>(.*?)</p>', body, re.S):
        scene_scripts[(scene, lang)] = html.unescape(text).strip()
scripts = {}
for name in sorted(os.listdir(AUDIO)):
    clip = name[:-4]
    scene, lang = re.match(r"(.+)_(en|de|fr|es|nl)_(?:reference|prompt_only)$", clip).groups()
    scripts[clip] = scene_scripts[(scene, lang)]


def pcm(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        check=True, capture_output=True).stdout
    return struct.unpack(f"<{len(raw) // 2}h", raw)


def rms_frames(samples, hop):
    n = int(SR * hop)
    out = []
    for i in range(0, len(samples) - n + 1, n):
        chunk = samples[i:i + n]
        out.append(math.sqrt(sum(s * s for s in chunk) / n) / 32768)
    return out


def pauses(frames, threshold_db=-38, min_len=0.2):
    thr = 10 ** (threshold_db / 20)
    result, start = [], None
    for i, value in enumerate(frames + [1.0]):
        silent = value < thr
        if silent and start is None:
            start = i
        elif not silent and start is not None:
            if (i - start) * HOP >= min_len:
                result.append((start * HOP, i * HOP))
            start = None
    return result


def chunks(text):
    """Split at punctuation that can carry a pause; keep the punctuation."""
    parts = re.findall(r'[^,;:.!?…]+(?:\.\.\.|[,;:.!?…])*\s*', text)
    return [p for p in (s.strip() for s in parts) if p]


def sentence_ids(parts):
    ids, sid = [], 0
    for p in parts:
        ids.append(sid)
        if re.search(r'(?<!\.)[.!?]$', p) and not p.endswith('...'):
            sid += 1
    return ids


def align(parts, frames, gaps, duration):
    """Pair consecutive groups of speech islands with consecutive groups of phrases.

    Islands are the voiced stretches between pauses. The DP keeps the speaking rate
    of every group close to the clip's average, prefers phrase boundaries at long
    pauses and tolerates short hesitations inside a phrase.
    """
    lead = gaps[0][1] if gaps and gaps[0][0] == 0 else 0.0
    tail = gaps[-1][0] if gaps and gaps[-1][1] >= duration - HOP else duration
    inner = [g for g in gaps if g[0] > lead and g[1] < tail]
    islands = []
    cursor = lead
    for a, b in inner:
        islands.append((cursor, a))
        cursor = b
    islands.append((cursor, tail))
    weights = [len(p) + 3 for p in parts]
    rate = sum(e - s for s, e in islands) / sum(weights)  # seconds per weighted char
    m, n = len(islands), len(parts)
    cum_c = [0]
    for w in weights:
        cum_c.append(cum_c[-1] + w)
    cum_s = [0]
    for s, e in islands:
        cum_s.append(cum_s[-1] + e - s)

    def cost(a, b, i, j):  # islands a..b-1 with phrases i..j-1
        speech = cum_s[b] - cum_s[a]
        chars = cum_c[j] - cum_c[i]
        c = math.log(max(speech, .05) / (rate * chars)) ** 2 * (chars / 40 + .6)
        c += sum(.25 + 1.6 * (inner[k][1] - inner[k][0]) for k in range(a, b - 1))  # swallowed pauses
        c += .04 * (j - i - 1)  # phrase boundaries spoken without a pause
        return c

    INF = float("inf")
    dp = [[INF] * (n + 1) for _ in range(m + 1)]
    back = [[None] * (n + 1) for _ in range(m + 1)]
    dp[0][0] = 0
    for a in range(m):
        for i in range(n):
            if dp[a][i] == INF:
                continue
            for b in range(a + 1, m + 1):
                for j in range(i + 1, n + 1):
                    c = dp[a][i] + cost(a, b, i, j)
                    if c < dp[b][j]:
                        dp[b][j], back[b][j] = c, (a, i)
    groups = []
    b, j = m, n
    while back[b][j]:
        a, i = back[b][j]
        groups.append((a, b, i, j))
        b, j = a, i
    groups.reverse()

    timings = []
    for a, b, i, j in groups:
        isl = islands[a:b]
        speech = sum(e - s for s, e in isl)

        def clock(fr):  # fraction of the group's speech -> clock time
            target = fr * speech
            for s, e in isl:
                if target <= e - s + 1e-9:
                    return s + target
                target -= e - s
            return isl[-1][1]

        span = cum_c[j] - cum_c[i]
        for k in range(i, j):
            timings.append((round(clock((cum_c[k] - cum_c[i]) / span), 3),
                            round(clock((cum_c[k + 1] - cum_c[i]) / span), 3)))
    return timings, sum(1 for g in groups) - 1, len(inner)


data = {}
for clip, text in scripts.items():
    samples = pcm(f"{AUDIO}/{clip}.mp3")
    duration = len(samples) / SR
    frames = rms_frames(samples, HOP)
    gaps = pauses(frames)
    parts = chunks(text)
    timings, matched, n_gaps = align(parts, frames, gaps, duration)
    sids = sentence_ids(parts)

    env_frames = rms_frames(samples, 1 / ENV_RATE)
    peak = max(env_frames) or 1
    # Perceptual-ish curve so quiet syllables stay visible.
    env = bytes(min(255, round(255 * math.sqrt(v / peak))) for v in env_frames)

    data[clip] = {
        "duration": round(duration, 3),
        "envRate": ENV_RATE,
        "env": base64.b64encode(env).decode(),
        "phrases": [[s, e, p, sid] for (s, e), p, sid in zip(timings, parts, sids)],
    }
    print(f"{clip}: {duration:.2f}s, {len(parts)} phrases, {n_gaps} pauses, {matched} matched, {max(sids) + 1} sentences")
    for (s, e), p in zip(timings, parts):
        print(f"   {s:6.2f}-{e:6.2f}  {p}")

with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("/* Generated from the release MP3s: loudness envelopes (25 Hz) and phrase timings\n"
             "   aligned to detected pauses. Timings are approximate; used for captions and visuals. */\n")
    fh.write("window.HumaneVoiceClips = ")
    json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\n")
