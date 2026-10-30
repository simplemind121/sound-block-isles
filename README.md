# 声音方块岛（Sound Block Isles）

给 5–7 岁中国孩子的方块像素风英语启蒙游戏（第一版 / MVP）。
主角是方块小机器人 **比普 Bip**：暴风雨摔碎了它的声音盒，碎片变成字母散落在岛上，孩子每学会一个字母音，就帮它找回一个声音。

- 技术：Phaser 3 + TypeScript + Vite，构建为纯静态网页，打开即玩，无需登录
- 进度：浏览器 localStorage（世界、掌握度、复习队列、使用时长）
- 引导语音：中文；学习内容：英文。自带一套用开源模型 Kokoro（Apache-2.0）生成的 mp3（`public/audio/`），手机和微信里也能播；某个 ID 没有音频文件时才退回浏览器语音
- 画面、角色、名称全部原创，由代码绘制，不使用任何 Minecraft 的角色、名称、贴图或标志

## 第一版包含什么

| 功能 | 位置 | 说明 |
|---|---|---|
| 方块世界 | 主场景 | 点地面行走；底部选方块后点地面放置，扫帚可以清除；拼出的单词物品会出现在世界里，点一下读出单词；自动保存 |
| 字母岛 | 红屋顶小屋 | 字母 s a t i p n，按蒙特梭利三阶段学习：**命名**（读音 + 比普的原创手势动画 + 配图）→ **描红**（砂纸字母，描对的地方方块会亮起来）→ **辨认**（听音找字母、大小写配对）→ **回忆**（把字母方块拖到对的声音上）。学会后解锁这个字母的方块 |
| 拼读工坊 | 铁砧小屋 | **自由拼**（先“写”后读）：随意拼字母方块，按锤子后系统逐个读音再连读，拼出真词就变出物品。**帮鸭鸭拼**：看图、听词，把字母放进轨道。学会 3 个字母后开放 |
| 押韵热身 | 紫色舞台 | 听两个词，点“两块一样的方块”（押韵）或“两块不一样的方块”（不押韵），每轮 6 题 |
| 修桥主线 | 锤子木牌 | 先回答开放式问题“木头还是石头？为什么？”；每块桥板对应一个小任务，6 块修完走到对岸，“动物农场”显示即将开放 |
| 间隔复习 | 宝箱 + 修桥 | Leitner 五个盒子（当次 / 1 天 / 2 天 / 4 天 / 7 天）。答错回到 1 号盒子，1 分钟后再出现。有到期内容时世界里会出现复习宝箱 |
| 休息提醒 | 全局 | 连续玩满 15 分钟（家长页可改），天色变成黄昏，比普打哈欠，语音提醒休息；不强制退出，选择继续的话 5 分钟后再提醒 |
| 家长页 | 右上角齿轮（要先答一道乘法题） | 字母三阶段进度、单词、押韵正确率、近 7 天使用时长、错得最多的内容、孩子在开放问题上的选择、本岛线下任务、主角改名、提醒时长、导出/导入/重置进度 |

设计原则：游戏里没有“老师”，只有需要帮忙的角色；不打红叉，放错的方块会弹回去并读出它自己的音，由孩子自己调整；第一次去到新地方会奖励星星；推荐方向用跳动的星星标出，但孩子可以去任何地方。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
```

```bash
npm run dev
```

浏览器打开终端里显示的地址（默认 http://localhost:5173 ）。同一局域网的平板也可以用 “Network” 那一行的地址访问。

其他命令：

```bash
npm test            # 单元测试：复习算法、存档、内容数据检查
```

```bash
npm run build       # 类型检查 + 构建到 dist/
```

```bash
npm run preview     # 本地预览构建结果
```

```bash
npm run smoke       # 冒烟测试（需要 Playwright + Chromium）：3 秒内进入游戏、无报错、刷新后进度还在
```

调试小技巧：网址后面加 `?rest` 会在 1.5 秒后直接弹出休息提醒。

## 目录结构

```
public/
  data/                 内容数据（JSON，改完刷新即可，不用改代码）
    letters.json        字母：读音提示、配图、手势、颜色、描红笔画
    words.json          单词：拼读拆分、中文、世界里生成的物品
    rhymes.json         押韵题目
    islands.json        主题岛：字母组、开放式问题、线下任务、开放状态
    prompts.json        中文引导语
  audio/                真人录音（按 ID 登记在 manifest.json；见 audio/README.md）
  art/                  替换用的图片素材（登记在 art/manifest.json）
src/
  core/                 AudioManager（按 ID 播放，退回浏览器语音）、SaveManager、ReviewScheduler、SessionTimer、Game
  art/                  原创像素画（字符画）和贴图生成
  tasks/                可复用的小任务：找声音、大小写配对、回忆、拼词、押韵、描红、手势动画、开放式问题
  scenes/               World / LetterIsland / Workshop / Rhyme / Bridge / UI（休息提醒）
  parent/               家长页
deploy/                 VPS 部署脚本和 nginx 配置
tests/                  单元测试
```

## 怎样扩展内容

- **加字母**：在 `letters.json` 加一项（笔画坐标说明写在文件开头），在 `islands.json` 的岛屿 `letters` 里加上它。配图名要在 `src/art/sprites.ts` 里有对应的像素画；方块上的小字形可以在 `SMALL_GLYPHS` 里手绘，没有的话会用笔画自动生成。
- **加单词**：在 `words.json` 加一项。`guided: true` 且有 `item` 的词会出现在“帮鸭鸭拼”里；只有字母都学会了才会出现。
- **加录音**：见 `public/audio/README.md`。真人录音放进去后，在 `manifest.json` 里改成新文件，并把这个 ID 写进 `keep`，以后重新生成时就不会被覆盖。
- **改了文字后重新生成音频**：改了 `prompts.json`、加了单词或字母后，运行 `scripts/gen-audio.py`（准备步骤写在脚本开头），只会生成缺少的文件；改了已有句子的文字要加 `--force`，或者先删掉对应的 mp3。
- **换美术**：把 PNG 放进 `public/art/`，在 `public/art/manifest.json` 里登记同名贴图即可覆盖。
- **开放下一座岛**：把 `islands.json` 里对应岛屿的 `status` 改成 `open`，并补上字母和单词（第一版的场景只使用第一座岛）。

## 部署到 VPS（GitHub 私有仓库 → VPS 拉取并构建）

以下以 Ubuntu / Debian + nginx 为例，命令在 VPS 上执行。

**1. 安装 Node.js 20、git、rsync、nginx**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```

```bash
sudo apt-get install -y nodejs git rsync nginx
```

**2. 让 VPS 能读取私有仓库（部署密钥，只读）**

```bash
ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/sound_block_isles -N ""
```

```bash
cat ~/.ssh/sound_block_isles.pub
```

把输出的公钥添加到 GitHub 仓库 → Settings → Deploy keys → Add deploy key（不要勾选写权限）。然后告诉 ssh 用这把钥匙：

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-sbi
  HostName github.com
  User git
  IdentityFile ~/.ssh/sound_block_isles
  IdentitiesOnly yes
EOF
```

**3. 克隆代码（把 `<owner>` 换成仓库所属的 GitHub 用户名）**

```bash
sudo mkdir -p /opt/sound-block-isles /var/www/sound-block-isles && sudo chown -R "$USER" /opt/sound-block-isles /var/www/sound-block-isles
```

```bash
git clone git@github-sbi:<owner>/sound-block-isles.git /opt/sound-block-isles
```

**4. 构建并发布**

```bash
bash /opt/sound-block-isles/deploy/deploy.sh
```

脚本会：拉取最新的 `main` → `npm ci` → `npm run build` → 把 `dist/` 同步到 `/var/www/sound-block-isles`。以后每次更新代码，只要重新运行这一条命令。

**5. 配置 nginx**

```bash
sudo cp /opt/sound-block-isles/deploy/nginx.conf /etc/nginx/sites-available/sound-block-isles
```

把文件里的 `server_name example.com;` 改成你的域名或服务器 IP，然后：

```bash
sudo ln -sf /etc/nginx/sites-available/sound-block-isles /etc/nginx/sites-enabled/sound-block-isles && sudo nginx -t && sudo systemctl reload nginx
```

**6.（建议）开启 HTTPS**

```bash
sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d 你的域名
```

说明：

- 录音和图片素材请提交到仓库的 `public/audio/`、`public/art/` 再部署；部署脚本会用 `rsync --delete` 让网站目录和构建结果完全一致，直接放在服务器网站目录里的文件会被清掉。
- 进度保存在孩子使用的那台设备的浏览器里。换设备或清浏览器数据前，可以在家长页“导出进度”，到新设备上“导入进度”。
- 页面已设置为只能用相对路径访问资源，所以也可以放在子目录下（例如 `https://example.com/abc/`）。

## 已知限制（第一版）

- 自带音频是 AI 生成的。字母音用国际音标合成（/s/ 拉长，/t/ /p/ 是短促的送气音），请家长先试听；不满意的话可以换成真人录音（优先补字母音）。
- iPhone 侧边静音开关打开时，旧版 iOS（16.4 以下）可能没有声音。
- 回忆阶段用“把字母拖到对的声音上”代替开口说，因为第一版没有语音识别。
- 只做了第一座岛（我的家）；后续岛屿在 `islands.json` 里已列出，显示为“即将开放”。
