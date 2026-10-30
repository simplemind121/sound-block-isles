/**
 * 家长页（HTML 覆盖层，方便阅读文字）：掌握情况、使用时长、错误最多的内容、孩子的选择、设置。
 * 进入前有一道算术题，防止孩子误入。
 */
import { G } from '../core/Game';
import { migrate, todayKey } from '../core/SaveManager';
import { BOX_INTERVALS } from '../core/ReviewScheduler';

const CSS = `
#parent-root .pp{position:fixed;inset:0;z-index:50;background:rgba(43,45,66,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;font:16px/1.55 "PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:#2b2d42;touch-action:auto;-webkit-user-select:text;user-select:text}
#parent-root .card{background:#fff6e0;margin:24px 16px;padding:20px 22px;max-width:880px;width:100%;box-shadow:0 0 0 4px #2b2d42,8px 8px 0 4px rgba(0,0,0,.25)}
#parent-root h2{margin:0 0 4px;font-size:24px}
#parent-root h3{margin:22px 0 8px;font-size:18px;border-bottom:3px solid #2b2d42;padding-bottom:4px}
#parent-root .muted{color:#616e7c;font-size:14px}
#parent-root .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
#parent-root .lt{background:#fff;padding:10px;box-shadow:0 0 0 3px #2b2d42;text-align:center}
#parent-root .lt b{font-size:34px;display:block;font-family:"Comic Sans MS","Chalkboard SE",system-ui,sans-serif}
#parent-root .dots span{display:inline-block;width:14px;height:14px;margin:0 2px;border:2px solid #2b2d42;background:#fff}
#parent-root .dots span.on{background:#ffd23f}
#parent-root .ok{color:#2d6a4f;font-weight:bold}
#parent-root table{border-collapse:collapse;width:100%}
#parent-root td,#parent-root th{border-bottom:1px solid #d9c9a0;padding:5px 6px;text-align:left;font-size:15px}
#parent-root .bars{display:flex;align-items:flex-end;gap:8px;height:130px;padding-top:10px}
#parent-root .bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;font-size:12px}
#parent-root .bar i{display:block;width:100%;background:#4ea8de;box-shadow:inset -4px -4px 0 #1d4e89;min-height:2px}
#parent-root button,#parent-root select,#parent-root input{font:inherit;padding:8px 14px;border:3px solid #2b2d42;background:#ffd23f;cursor:pointer;margin:4px 6px 4px 0}
#parent-root input,#parent-root select{background:#fff;cursor:auto}
#parent-root button.ghost{background:#fff}
#parent-root button.danger{background:#f4a3a3}
#parent-root .row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
#parent-root .close{float:right}
`;

const STAGE_NAMES = ['未开始', '命名', '辨认', '回忆（已掌握）'];

function el(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild as HTMLElement;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function mount(node: HTMLElement): void {
  const root = document.getElementById('parent-root')!;
  if (!document.getElementById('pp-style')) {
    const st = document.createElement('style');
    st.id = 'pp-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  root.innerHTML = '';
  root.appendChild(node);
}

function close(): void {
  document.getElementById('parent-root')!.innerHTML = '';
}

export function openParentPanel(): void {
  G.audio.stop();
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 4 + Math.floor(Math.random() * 6);
  const gate = el(`<div class="pp"><div class="card" style="max-width:420px">
    <button class="ghost close" data-x>关闭</button>
    <h2>家长入口</h2><p class="muted">请回答：</p>
    <p style="font-size:30px;margin:6px 0">${a} × ${b} = ?</p>
    <div class="row"><input type="number" inputmode="numeric" style="width:120px" /><button data-ok>进入</button></div>
    <p class="muted" data-msg></p></div></div>`);
  mount(gate);
  const input = gate.querySelector('input')!;
  gate.querySelector('[data-x]')!.addEventListener('click', close);
  const ok = () => {
    if (Number(input.value) === a * b) renderDashboard();
    else gate.querySelector('[data-msg]')!.textContent = '答案不对，再试一次。';
  };
  gate.querySelector('[data-ok]')!.addEventListener('click', ok);
  input.addEventListener('keydown', (e) => e.key === 'Enter' && ok());
  setTimeout(() => input.focus(), 50);
}

function fmtMin(sec: number): string {
  return sec < 60 ? `${sec} 秒` : `${Math.round(sec / 60)} 分钟`;
}

function renderDashboard(): void {
  const d = G.data;
  const letters = G.islandLetters();
  const letterCards = letters
    .map((l) => {
      const st = G.letterStage(l.id);
      const r = d.review[`letter:${l.id}`];
      return `<div class="lt"><b>${l.upper} ${l.lower}</b>
        <div class="dots">${[1, 2, 3].map((k) => `<span class="${st >= k ? 'on' : ''}"></span>`).join('')}</div>
        <div class="muted">${STAGE_NAMES[st]}</div>
        <div class="muted">${r ? `对 ${r.correct} · 错 ${r.wrong} · 盒 ${r.box}` : '还没练习'}</div></div>`;
    })
    .join('');

  const wordRows = G.content.words
    .filter((w) => d.wordsBuilt[w.id] || d.review[`word:${w.id}`])
    .map((w) => {
      const r = d.review[`word:${w.id}`];
      return `<tr><td><b>${w.id}</b> <span class="muted">${esc(w.zh)}</span></td><td>${d.wordsBuilt[w.id] ?? 0}</td>
        <td>${r ? `${r.correct}/${r.correct + r.wrong}` : '-'}</td><td>${G.wordMastered(w.id) ? '<span class="ok">✔ 记住了</span>' : '练习中'}</td></tr>`;
    })
    .join('');

  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - (6 - i));
    return { k: todayKey(dt), label: `${dt.getMonth() + 1}/${dt.getDate()}` };
  });
  const max = Math.max(60, ...days.map((x) => d.usage[x.k] ?? 0));
  const bars = days
    .map((x) => {
      const s = d.usage[x.k] ?? 0;
      return `<div class="bar"><span>${s ? Math.round(s / 60) : ''}</span><i style="height:${(s / max) * 100}%"></i><span>${x.label}</span></div>`;
    })
    .join('');

  const errors = Object.entries(d.stats.errors)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 6)
    .map(([k, n]) => {
      const [kind, key] = k.split(':');
      const label = kind === 'letter' ? `字母音 /${key}/` : kind === 'word' ? `拼词 ${key}` : kind === 'case' ? `大小写 ${key.toUpperCase()}${key}` : `押韵 ${key}`;
      return `<tr><td>${esc(label)}</td><td>${n} 次</td></tr>`;
    })
    .join('');

  const questions = G.content.islands.flatMap((i) => i.questions ?? []);
  const choiceRows = d.choices
    .slice(-10)
    .reverse()
    .map((c) => {
      const q = questions.find((x) => x.id === c.q);
      const opt = q?.options.find((o) => o.id === c.option)?.zh ?? c.option;
      const rsn = c.reason ? q?.reasons?.find((o) => o.id === c.reason)?.zh ?? c.reason : '';
      return `<tr><td>${esc(q?.promptZh ?? c.q)}</td><td><b>${esc(opt)}</b> ${esc(rsn)}</td><td class="muted">${new Date(c.ts).toLocaleDateString()}</td></tr>`;
    })
    .join('');

  const due = Object.entries(d.review).filter(([, r]) => r.due <= Date.now()).length;
  const rhymeTotal = d.stats.rhymeCorrect + d.stats.rhymeWrong;
  const home = G.homeIsland;
  const nextIsland = G.content.islands.find((i) => i.status === 'coming');
  const voices = speechSynthesis?.getVoices?.() ?? [];
  const hasZh = voices.some((v) => v.lang.toLowerCase().startsWith('zh'));
  const hasEn = voices.some((v) => v.lang.toLowerCase().startsWith('en'));

  const node = el(`<div class="pp"><div class="card">
    <button class="ghost close" data-x>返回游戏</button>
    <h2>家长页</h2>
    <p class="muted">今天已玩 ${fmtMin(d.usage[todayKey()] ?? 0)} · 星星 ${d.stars} · 待复习 ${due} 项 · 桥板 ${d.bridge.planks}/${home.bridgePlanks ?? 6}</p>

    <h3>字母（三阶段：命名 → 辨认 → 回忆）</h3>
    <div class="grid">${letterCards}</div>
    <p class="muted">已掌握 ${G.learnedLetters().length}/${letters.length}。“盒”是间隔复习的盒子（1–5），盒子越高复习间隔越长：${BOX_INTERVALS.slice(1).map((ms) => (ms ? ms / 86400000 + '天' : '当次')).join(' / ')}。</p>

    <h3>单词</h3>
    ${wordRows ? `<table><tr><th>单词</th><th>拼出次数</th><th>帮忙拼正确率</th><th>状态</th></tr>${wordRows}</table>` : '<p class="muted">还没有拼过单词。学会 3 个字母后，拼读工坊会开放。</p>'}

    <h3>押韵热身</h3>
    <p>${rhymeTotal ? `答对 ${d.stats.rhymeCorrect}/${rhymeTotal}（${Math.round((d.stats.rhymeCorrect / rhymeTotal) * 100)}%）` : '<span class="muted">还没玩过。</span>'}</p>

    <h3>每天使用时长（分钟）</h3>
    <div class="bars">${bars}</div>

    <h3>错得最多的内容</h3>
    ${errors ? `<table>${errors}</table>` : '<p class="muted">暂无。</p>'}

    <h3>孩子的选择（开放式问题）</h3>
    ${choiceRows ? `<table>${choiceRows}</table>` : '<p class="muted">还没有回答过。</p>'}
    <p class="muted">这些问题没有标准答案。可以请孩子说说“为什么”，记下孩子的想法。</p>

    <h3>本岛：${esc(home.nameZh)}（第 ${esc(home.weeks)} 周）</h3>
    <p><b>线下任务：</b>${esc(home.offlineTaskZh ?? '')}</p>
    <p class="muted">下一座岛：${esc(nextIsland?.nameZh ?? '')}（即将开放）</p>

    <h3>设置</h3>
    <div class="row">主角名字：<input data-name value="${esc(d.heroName)}" style="width:140px" /><button data-savename>保存</button></div>
    <div class="row">单次提醒休息：<select data-min>${[10, 15, 20, 30].map((m) => `<option value="${m}" ${m === d.settings.sessionMinutes ? 'selected' : ''}>${m} 分钟</option>`).join('')}</select></div>
    <p class="muted">语音：${hasEn ? '英文语音可用' : '⚠ 此设备没有英文语音'} · ${hasZh ? '中文语音可用' : '⚠ 此设备没有中文语音（建议用 Chrome / Safari，或补录音）'} · 录音文件请放到服务器的 audio/ 目录并登记到 manifest.json。</p>
    <div class="row">
      <button class="ghost" data-export>导出进度</button>
      <label class="ghost" style="border:3px solid #2b2d42;padding:8px 14px;cursor:pointer">导入进度<input type="file" accept="application/json" data-import style="display:none"></label>
      <button class="danger" data-reset>重置全部进度</button>
    </div>
  </div></div>`);
  mount(node);

  node.querySelector('[data-x]')!.addEventListener('click', close);
  node.querySelector('[data-savename]')!.addEventListener('click', () => {
    const v = (node.querySelector('[data-name]') as HTMLInputElement).value.trim().slice(0, 12);
    if (!v) return;
    d.heroName = v;
    G.save.flush();
    G.registerVoices();
    (node.querySelector('[data-savename]') as HTMLButtonElement).textContent = '已保存 ✔';
  });
  node.querySelector('[data-min]')!.addEventListener('change', (e) => {
    d.settings.sessionMinutes = Number((e.target as HTMLSelectElement).value);
    G.save.flush();
  });
  node.querySelector('[data-export]')!.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `声音方块岛-进度-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  node.querySelector('[data-import]')!.addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm('导入会覆盖当前进度，确定吗？')) return;
      G.save.data = migrate(data);
      G.save.flush();
      location.reload();
    } catch {
      alert('文件格式不对。');
    }
  });
  node.querySelector('[data-reset]')!.addEventListener('click', () => {
    if (!confirm('确定要清空全部进度（世界、字母、单词、时长）吗？')) return;
    if (!confirm('真的确定吗？这一步无法撤销。建议先“导出进度”。')) return;
    G.save.reset();
    location.reload();
  });
}
