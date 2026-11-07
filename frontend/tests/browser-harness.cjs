// Local-only Native Bridge double for manual browser regression; never included in dist.
const http = require('node:http');
const mock = `
(() => {
  const listeners = new Set();
  const calls = [];
  const toolbar = document.createElement('aside');
  toolbar.setAttribute('aria-label', 'Native 測試控制');
  toolbar.style.cssText = 'position:fixed;right:0;top:0;z-index:100;background:#fff;border:1px solid #777;padding:4px;font-size:12px;max-width:180px';
  toolbar.innerHTML = '<details><summary>Native 測試控制</summary><label><input type="checkbox" id="fail-ocr">第二頁 OCR 失敗</label><br><label><input type="checkbox" id="fail-six">六何格式錯誤</label><br><label><input type="checkbox" id="slow-six">延遲六何回應</label><br><output id="native-test-log"></output></details>';
  document.addEventListener('DOMContentLoaded', () => document.body.append(toolbar));
  const enabled = id => toolbar.querySelector('#' + id).checked;
  window.govclearNative = {
    addEventListener(_, callback) { listeners.add(callback); },
    removeEventListener(_, callback) { listeners.delete(callback); },
    postMessage(raw) {
      const request = JSON.parse(raw).data;
      calls.push(request.action);
      toolbar.querySelector('output').textContent = JSON.stringify(calls.reduce((counts, action) => { counts[action] = (counts[action] || 0) + 1; return counts; }, {}));
      if (request.action === 'cancel') return;
      const amount = request.payload?.text?.includes('300') ? '300' : '200';
      let ok = true;
      let result = '測試橋接已連線';
      if (request.action === 'transcribe') {
        ok = !(enabled('fail-ocr') && calls.filter(action => action === 'transcribe').length === 2);
        result = '合成通知：請於115年11月30日前辦理。費用200元，65歲以上免收。需帶身分證及申請表。';
      }
      if (request.action === 'summarize') result = request.payload.policy.includes('問題：')
        ? '請於115年11月30日前辦理。'
        : '先看重點\\n請於115年11月30日前辦理，費用' + amount + '元。\\n別漏掉\\n65歲以上免收，需帶身分證及申請表。';
      if (request.action === 'sixQuestions') result = enabled('fail-six') ? '{"who": "缺少其他欄位"}' : JSON.stringify({
        who: '申請人；65歲以上免收', what: '通知辦理', when: '115年11月30日前', where: null, why: null,
        how: '費用' + amount + '元，需帶身分證及申請表'
      });
      setTimeout(() => {
        for (const callback of listeners) callback({ data: JSON.stringify({ name: 'govclear', data: {
          id: request.id, ok, result, error: ok ? undefined : '測試：第二頁看不清楚'
        } }) });
      }, request.action === 'sixQuestions' && enabled('slow-six') ? 10000 : 100);
    }
  };
})();
`;
http.createServer(async (req, res) => {
  try {
    const response = await fetch(new URL(req.url, 'http://127.0.0.1:3001'));
    res.statusCode = response.status;
    res.setHeader('content-type', response.headers.get('content-type') || 'application/octet-stream');
    if ((response.headers.get('content-type') || '').includes('text/html'))
      res.end((await response.text()).replace('</head>', '<script>' + mock + '</script></head>'));
    else res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(502).end('Start the production preview on port 3001 first.'); }
}).listen(3010, '127.0.0.1', () => console.log('Native test harness: http://127.0.0.1:3010/ (mock responses only)'));
