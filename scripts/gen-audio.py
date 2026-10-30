#!/usr/bin/env python3
"""
用开源语音模型 Kokoro（Apache-2.0）给游戏里所有的音频 ID 生成 mp3，并写入 public/audio/manifest.json。
生成的是“占位录音”：比浏览器语音稳定（手机、微信里也能播），但仍建议以后换成真人录音。
真人录音放进 public/audio/ 后，在 manifest.json 里改成对应文件即可；本脚本不会覆盖 manifest 里标了 "keep" 的条目。

准备（一次）：
  python3 -m venv .tts && .tts/bin/pip install kokoro-onnx soundfile "misaki[zh]"
  下载模型到 scripts/models/（约 120MB，不提交到仓库）：
    https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
    https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
  还需要 ffmpeg（转 mp3）。

运行：
  .tts/bin/python scripts/gen-audio.py            # 只生成缺少的文件
  .tts/bin/python scripts/gen-audio.py --force    # 全部重新生成
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from misaki import zh

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
AUDIO = ROOT / "public" / "audio"
MODELS = Path(__file__).resolve().parent / "models"

EN_VOICE = "af_heart"
ZH_VOICE = "zf_xiaoxiao"
FORCE = "--force" in sys.argv


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def jobs():
    """返回 [(音频ID, 相对路径, 语言, 文本或音标, 是否音标, 语速)]"""
    letters = load("letters.json")["letters"]
    words = load("words.json")
    rhymes = load("rhymes.json")["pairs"]
    islands = load("islands.json")["islands"]
    prompts = load("prompts.json")["prompts"]
    out = []
    for l in letters:
        out.append((f"phoneme.{l['id']}", f"phonemes/{l['id']}.mp3", "en", l["ipa"]["sound"], True, 0.8))
        out.append((f"letter.{l['id']}", f"letters/{l['id']}.mp3", "en", l["ipa"]["name"], True, 0.85))
    ws = {w["id"] for w in words["words"]} | {w["id"] for w in words["pictureWords"]}
    ws |= {r["a"] for r in rhymes} | {r["b"] for r in rhymes}
    for w in sorted(ws):
        out.append((f"word.{w}", f"words/{w}.mp3", "en", w + ".", False, 0.8))
    for k, v in prompts.items():
        if k.startswith("_"):
            continue
        texts = v if isinstance(v, list) else [v]
        for i, t in enumerate(texts):
            suffix = f".{i}" if isinstance(v, list) else ""
            out.append((f"prompt.{k}", f"prompts/{k}{suffix}.mp3", "zh", t, False, 0.92))
    for isl in islands:
        for q in isl.get("questions", []):
            out.append((f"q.{q['id']}", f"prompts/q_{q['id']}.mp3", "zh", q["promptZh"], False, 0.92))
            out.append((f"q.{q['id']}.why", f"prompts/q_{q['id']}_why.mp3", "zh", q["whyZh"], False, 0.92))
            for o in q["options"] + q.get("reasons", []):
                out.append((f"opt.{q['id']}.{o['id']}", f"prompts/opt_{q['id']}_{o['id']}.mp3", "zh", o["zh"], False, 0.92))
    return out


def main():
    kokoro = Kokoro(str(MODELS / "kokoro-v1.0.int8.onnx"), str(MODELS / "voices-v1.0.bin"))
    g2p = zh.ZHG2P()
    manifest_path = AUDIO / "manifest.json"
    old = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    keep = set(old.get("keep", []))
    files = {}
    made = 0
    for aid, rel, lang, text, is_ph, speed in jobs():
        if aid in keep:
            files[aid] = old["files"][aid]
            continue
        dest = AUDIO / rel
        if FORCE or not dest.exists():
            if lang == "zh":
                r = g2p(text)
                ph = r[0] if isinstance(r, tuple) else r
                samples, sr = kokoro.create(ph, voice=ZH_VOICE, speed=speed, is_phonemes=True)
            elif is_ph:
                samples, sr = kokoro.create(text, voice=EN_VOICE, speed=speed, is_phonemes=True)
            else:
                samples, sr = kokoro.create(text, voice=EN_VOICE, speed=speed, lang="en-us")
            # 去掉首尾静音，峰值统一到 -1dB，前后各留 60ms
            act = np.abs(samples) > 0.01
            if act.any():
                samples = samples[max(0, act.argmax() - 600): len(samples) - max(0, act[::-1].argmax() - 600)]
            samples = samples / max(1e-6, np.abs(samples).max()) * 0.89
            pad = np.zeros(int(sr * 0.06), dtype=samples.dtype)
            samples = np.concatenate([pad, samples, pad])
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
                sf.write(tmp.name, samples, sr)
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-ac", "1", "-b:a", "48k", str(dest)], check=True)
            made += 1
            print("生成", aid, rel)
        prev = files.get(aid)
        files[aid] = rel if prev is None else (prev if isinstance(prev, list) else [prev]) + [rel]
    manifest = {
        "_说明": old.get("_说明", ""),
        "_生成": f"scripts/gen-audio.py（Kokoro：英文 {EN_VOICE}，中文 {ZH_VOICE}）。想保留手工替换的录音，把它的 ID 写进 keep。",
        "keep": sorted(keep),
        "files": files,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"完成：新生成 {made} 个，manifest 共 {len(files)} 个 ID")


if __name__ == "__main__":
    main()
