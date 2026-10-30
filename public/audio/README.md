# 录音放这里

1. 把文件放进对应目录（推荐 mp3 或 m4a，单声道、44.1kHz、前后留白尽量短）：
   - `phonemes/s.mp3`：字母音 /s/（不是字母名 "ess"）
   - `words/pin.mp3`：单词
   - `prompts/welcome_first.mp3`：中文引导语
2. 在 `manifest.json` 的 `files` 里登记：

```json
{
  "files": {
    "phoneme.s": "phonemes/s.mp3",
    "word.pin": "words/pin.mp3",
    "prompt.welcome_first": "prompts/welcome_first.mp3"
  }
}
```

没有登记的 ID 会自动退回浏览器语音，所以可以一个一个慢慢补。
浏览器语音读不准单独的字母音（比如 /t/ 会读成 "tuh"），**最优先要补的是 phonemes 下的音素录音**。
