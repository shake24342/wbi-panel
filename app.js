/* wbi 控制台 · 共享逻辑（所有页面引用） */
const API = 'https://api.github.com';
const LS_R = 'wbi.repo', LS_T = 'wbi.tok';
const WBI = {
  REPO: localStorage.getItem(LS_R) || 'shake24342/wbi-image-api',
  TOK: localStorage.getItem(LS_T) || '',
  TIMER: null
};
window.WBI = WBI;

const $ = i => document.getElementById(i);
window.$ = $;

/* ---------- Toast ---------- */
function toast(text, kind, ms){
  const box = $('toasts') || (function(){ const d=document.createElement('div'); d.id='toasts'; document.body.appendChild(d); return d; })();
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = text;
  box.appendChild(el);
  setTimeout(function(){ el.style.transition='.3s'; el.style.opacity=0; setTimeout(function(){ el.remove(); }, 320); }, ms || 4200);
  while(box.children.length > 3) box.firstChild.remove();
}
window.toast = toast;

async function busy(btn, fn){
  const old = btn.textContent; btn.classList.add('busy'); btn.disabled = true;
  try { return await fn(); }
  finally { btn.classList.remove('busy'); btn.disabled = false; btn.textContent = old; }
}
window.busy = busy;

/* ---------- 令牌 ---------- */
function cleanTok(v){
  return (v||'').replace(/[\u200B-\u200D\u2060\uFEFF\u00A0]/g,'').replace(/\s+/g,'').replace(/^["'`]+|["'`]+$/g,'');
}
window.cleanTok = cleanTok;

function tokInfoHtml(raw){
  const c = cleanTok(raw);
  if(!c) return {html:'', ok:false};
  const ok = c.indexOf('ghp_')===0 || c.indexOf('github_pat_')===0;
  let s = '长度 ' + c.length + ' · ' + (ok ? '格式 ✓' : '格式 ✗ 应以 ghp_ 开头');
  if(c !== raw) s += ' · <span style="color:var(--warn)">已清理 ' + (raw.length - c.length) + ' 个多余字符</span>';
  return {html:s, ok:ok};
}
window.tokInfoHtml = tokInfoHtml;

/* ---------- GitHub API ---------- */
async function gh(path, opt){
  opt = opt || {};
  if(!WBI.TOK) throw new Error('NO_TOKEN');
  const r = await fetch(API + path, {
    method: opt.method || 'GET',
    headers: { Authorization:'token ' + WBI.TOK, Accept:'application/vnd.github+json', 'Content-Type':'application/json' },
    body: opt.body
  });
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch(e){ j = {}; }
  if(!r.ok) throw new Error((j && (j.message || j.error)) || ('HTTP ' + r.status));
  return j;
}
window.gh = gh;

const enc = s => btoa(unescape(encodeURIComponent(s)));
const dec = s => decodeURIComponent(escape(atob(s.replace(/\n/g,''))));

async function readFile(p){
  try { const j = await gh('/repos/' + WBI.REPO + '/contents/' + p + '?t=' + Date.now()); return { sha:j.sha, text:dec(j.content) }; }
  catch(e){ return { sha:null, text:null }; }
}
window.readFile = readFile;

async function writeFile(p, obj, msg){
  const cur = await readFile(p);
  const b = { message: msg || ('update ' + p), content: enc(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1)) };
  if(cur.sha) b.sha = cur.sha;
  return gh('/repos/' + WBI.REPO + '/contents/' + p, { method:'PUT', body: JSON.stringify(b) });
}
window.writeFile = writeFile;

function dispatch(wf, inp){
  return gh('/repos/' + WBI.REPO + '/actions/workflows/' + wf + '/dispatches',
    { method:'POST', body: JSON.stringify({ ref:'main', inputs: inp || {} }) });
}
window.dispatch = dispatch;

/* ---------- 模型常量 ---------- */
window.DZMM_MODELS = [
  ['anime','anime（二次元 默认）'], ['anima','anima'], ['iroha','Iroha 高质量二次元'],
  ['z-image','z-image（隐藏）'], ['nalang-dream','Nalang Dream 写实·无审核 ★'],
  ['nalang-coser-2','Nalang Coser-2'], ['kagami','kagami 写实最高清（1 credit，有敏感词过滤）']
];
window.PIXAI_MODELS = [
  ['pixai:tsubaki2','Tsubaki.2（26B 旗舰）★'], ['pixai:tsubaki','Tsubaki（7B）'],
  ['pixai:realvisxl','RealVisXL V4.0（写实）'], ['pixai:cyberrealistic','CyberRealistic Pony'],
  ['pixai:jibmix','Jib Mix Realistic XL'], ['pixai:nova-unreal','Nova Unreal XL'],
  ['pixai:analog-madness','Analog Madness'], ['pixai:epicrealism','epiCRealism XL']
];

/* ---------- 底部标签栏 ---------- */
window.renderTabs = function(active){
  const tabs = [
    ['index.html','🎛','控制台'],
    ['gallery.html','🖼','画廊'],
    ['models.html','🧩','模型'],
    ['pool.html','📊','号池']
  ];
  let h = '<div id="tabs">';
  tabs.forEach(function(t){
    h += '<a href="' + t[0] + '"' + (t[0] === active ? ' class="on"' : '') + '><i>' + t[1] + '</i>' + t[2] + '</a>';
  });
  document.body.insertAdjacentHTML('beforeend', h + '</div>');
};

/* ---------- 连接表单（各页共用） ---------- */
window.renderConnCard = function(){
  return '<div class="card" id="cardConn">' +
    '<h3>① 连接仓库</h3>' +
    '<input type="text" id="repo" placeholder="owner/repo" value="' + WBI.REPO + '">' +
    '<div class="lbl"></div>' +
    '<input type="password" id="tok" placeholder="粘贴 GitHub 令牌（ghp_ 开头）">' +
    '<div class="hint" id="tokInfo"></div>' +
    '<div class="row" style="margin-top:11px"><button class="pri" id="btnConn">连接</button>' +
    '<button class="fx" id="btnForget" style="width:auto">清除</button></div>' +
    '<div class="hint">令牌只存在你手机浏览器里，需要 <code>repo</code> + <code>workflow</code> 权限。</div></div>';
};

window.bindConn = function(onDone){
  $('tok').value = WBI.TOK || '';
  const upd = function(){
    const r = tokInfoHtml($('tok').value);
    $('tokInfo').innerHTML = r.html;
    $('tokInfo').style.color = r.ok ? 'var(--ok)' : 'var(--err)';
  };
  $('tok').addEventListener('input', upd);
  $('tok').addEventListener('paste', function(){ setTimeout(upd, 30); });
  upd();
  $('btnForget').onclick = function(){ localStorage.removeItem(LS_T); WBI.TOK=''; $('tok').value=''; upd();
    const t=$('connTag'); if(t) t.textContent='未连接'; const d=$('connDot'); if(d) d.className='dot'; toast('已清除令牌'); };
  $('btnConn').onclick = function(){ busy($('btnConn'), async function(){
    WBI.REPO = $('repo').value.trim(); WBI.TOK = cleanTok($('tok').value); $('tok').value = WBI.TOK; upd();
    if(!WBI.REPO || !WBI.TOK){ toast('请填仓库和令牌','err'); return; }
    if(WBI.TOK.indexOf('ghp_')!==0 && WBI.TOK.indexOf('github_pat_')!==0){ toast('令牌格式不对（应以 ghp_ 开头）','err'); return; }
    try{
      const u = await gh('/user');
      localStorage.setItem(LS_R, WBI.REPO); localStorage.setItem(LS_T, WBI.TOK);
      const ct=$('connTag'); if(ct) ct.textContent = u.login;
      const cd=$('connDot'); if(cd) cd.className='dot on';
      $('cardConn').style.display = 'none';
      toast('✅ 已连接 ' + u.login, 'ok');
      if(onDone) onDone();
    }catch(e){
      const cd=$('connDot'); if(cd) cd.className='dot';
      if(/Bad credentials/i.test(e.message)) toast('令牌无效（Bad credentials）\n①整行复制无空格 ②未过期 ③未撤销','err',9000);
      else if(/Not Found/i.test(e.message)) toast('读不到仓库 ' + WBI.REPO + '\n检查仓库名与 token 的 repo 权限','err',9000);
      else toast('连接失败：' + e.message, 'err', 9000);
    }
  }); };
};

/* 页面统一启动：有令牌自动连接，否则显示连接卡 */
window.bootPage = function(opts){
  opts = opts || {};
  document.body.insertAdjacentHTML('afterbegin',
    '<div class="hd"><i class="dot' + (WBI.TOK ? ' on' : '') + '" id="connDot"></i>' +
    '<b>wbi <i>' + (opts.title || '控制台') + '</i></b>' +
    '<span class="tagx" id="connTag">' + (WBI.TOK ? '已保存' : '未连接') + '</span></div>');
  const holder = document.createElement('div');
  holder.innerHTML = renderConnCard();
  const firstCard = document.body.querySelector('.card');
  document.body.insertBefore(holder.firstChild, firstCard);   // 连接卡永远排在最上面
  if(WBI.TOK) $('cardConn').style.display = 'none';
  bindConn(opts.onReady);
  renderTabs(opts.active || '');
  if(WBI.TOK && opts.onReady) opts.onReady();
};

/* ---------- 私有仓库图片加载（raw 对私有仓库是 404，必须用 API + token） ---------- */
const IMG_CACHE = new Map();
const IMG_MAX = 80;

async function loadImageUrl(path){
  if(IMG_CACHE.has(path)) return IMG_CACHE.get(path);
  const auth = { Authorization: 'token ' + WBI.TOK };
  let blob = null;
  // 方案 A：contents API + raw media type（直出二进制）
  const r = await fetch(API + '/repos/' + WBI.REPO + '/contents/' + path + '?t=' + Date.now(),
    { headers: Object.assign({ Accept: 'application/vnd.github.raw' }, auth) });
  if(r.ok){ blob = await r.blob(); }
  else if(r.status === 404){
    // 方案 B：先拿 sha，再用 git/blobs（支持最大 100MB，且能判断到底是不存在还是没权限）
    const meta = await fetch(API + '/repos/' + WBI.REPO + '/contents/' + path, { headers: auth });
    if(!meta.ok) throw new Error('HTTP ' + meta.status + '（文件不存在或令牌无权访问该文件）');
    const sha = (await meta.json()).sha;
    const bb = await fetch(API + '/repos/' + WBI.REPO + '/git/blobs/' + sha, { headers: auth });
    if(!bb.ok) throw new Error('HTTP ' + bb.status + '（读 blob 失败）');
    const j = await bb.json();
    const bin = atob(j.content.replace(/\n/g, ''));
    const arr = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
    blob = new Blob([arr], { type: 'image/jpeg' });
  } else {
    throw new Error('HTTP ' + r.status);
  }
  const u = URL.createObjectURL(blob);
  IMG_CACHE.set(path, u);
  if(IMG_CACHE.size > IMG_MAX){
    const k = IMG_CACHE.keys().next().value;
    try { URL.revokeObjectURL(IMG_CACHE.get(k)); } catch(e){}
    IMG_CACHE.delete(k);
  }
  return u;
}
window.loadImageUrl = loadImageUrl;

/* 给 <img data-img="path"> 批量填图 */
async function hydrateImages(root){
  const list = (root || document).querySelectorAll('img[data-img]');
  let fail = 0;
  for(let i=0;i<list.length;i++){
    const img = list[i];
    if(img.dataset.done) continue;
    img.dataset.done = '1';
    try{ img.src = await loadImageUrl(img.dataset.img); }
    catch(e){
      fail++;
      img.style.display='none';
      const holder = img.parentElement;
      if(holder && !holder.querySelector('.imgfail'))
        holder.insertAdjacentHTML('beforeend',
          '<div class="imgfail" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
          'font-size:11px;color:var(--fg3);text-align:center;padding:6px">读图失败</div>');
    }
  }
  return fail;
}
window.hydrateImages = hydrateImages;

/* ---------- 大图查看器（手机友好） ---------- */
window.openLightbox = function(path, title){
  const ov = document.createElement('div');
  ov.id = 'lb';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.94);z-index:200;display:flex;' +
    'flex-direction:column;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML =
    '<img id="lbImg" style="max-width:100%;max-height:78vh;border-radius:10px;object-fit:contain">' +
    '<div style="color:#c9d1d9;font-size:12.5px;margin-top:12px;text-align:center;max-width:90%;word-break:break-all">' +
      (title||'') + '</div>' +
    '<div style="display:flex;gap:10px;margin-top:14px;width:100%;max-width:340px">' +
      '<a id="lbDl" download style="flex:1"><button style="width:100%">⬇ 下载</button></a>' +
      '<button id="lbClose" style="flex:1">关闭</button></div>';
  document.body.appendChild(ov);
  const close = function(){ ov.remove(); };
  ov.addEventListener('click', function(e){ if(e.target === ov) close(); });
  $('lbClose').onclick = close;
  toast('加载中…','',1500);
  loadImageUrl(path).then(function(u){
    $('lbImg').src = u; $('lbDl').href = u;
    $('lbDl').download = path.split('/').pop();
  }).catch(function(e){ toast('读图失败：'+e.message,'err',7000); });
};

/* 图片在私有仓库的 raw 地址（仅用于说明，不直接用） */
window.notePrivateRaw = function(){};
