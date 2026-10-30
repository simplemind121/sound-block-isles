# 美术素材替换目录

第一版的所有画面都由代码绘制（见 `src/art/sprites.ts`）。
以后要换成 CC0 素材（如 Kenney.nl）或原创图片：把 PNG 放进这里，文件名用贴图名（如 `bip.png`、`snake.png`、`block_wood.png`），
然后在 `art/manifest.json` 里登记，游戏启动时会用图片覆盖同名的代码绘制贴图。
