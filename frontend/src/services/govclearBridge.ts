type Action = 'check' | 'transcribe' | 'summarize' | 'cancel';
type Bridge = {
  postMessage(message: string): void;
  addEventListener(name: 'message', callback: (event: MessageEvent) => void): void;
  removeEventListener(name: 'message', callback: (event: MessageEvent) => void): void;
};
type Pending = {
  resolve(value: string): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};

/** No fetch to a backend or Ollama: private input crosses the local Native bridge only. */
export class GovClearBridge {
  private object?: Bridge;
  private pending = new Map<string, Pending>();
  private receive = (event: MessageEvent) => {
    try {
      const wire = String(event.data);
      const json = wire.startsWith('base64:')
        ? new TextDecoder().decode(
            Uint8Array.from(atob(wire.slice(7)), (char) => char.charCodeAt(0))
          )
        : wire;
      const envelope = JSON.parse(json);
      if (envelope.name !== 'govclear') return;
      const { id, ok, result, error } = envelope.data;
      const request = this.pending.get(id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(id);
      if (ok && typeof result === 'string') request.resolve(result);
      else request.reject(new Error(typeof error === 'string' ? error : '模型回應異常，請重試。'));
    } catch {
      /* Ignore unrelated or malformed host events. */
    }
  };

  async connect() {
    for (let n = 0; n < 30; n++) {
      this.object = (window as unknown as { govclearNative?: Bridge }).govclearNative;
      if (this.object) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!this.object)
      throw new Error('請從 TownPass 的 GovClear 入口開啟。瀏覽器只能預覽介面，無法進行本機推論。');
    this.object.addEventListener('message', this.receive);
    return this.request('check');
  }

  request(action: Action, payload?: Record<string, string>): Promise<string> {
    if (!this.object) return Promise.reject(new Error('尚未連上本機推論橋接。'));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('模型處理逾時，請縮短文件後重試。'));
      }, 610000);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.object!.postMessage(
          JSON.stringify({ name: 'govclear', data: { id, action, payload } })
        );
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error('無法呼叫本機推論橋接。'));
      }
    });
  }

  cancel() {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('已停止處理。'));
    }
    this.pending.clear();
    try {
      this.object?.postMessage(
        JSON.stringify({ name: 'govclear', data: { id: crypto.randomUUID(), action: 'cancel' } })
      );
    } catch {
      /* Host already closed. */
    }
  }

  dispose() {
    this.cancel();
    this.object?.removeEventListener('message', this.receive);
  }
}
