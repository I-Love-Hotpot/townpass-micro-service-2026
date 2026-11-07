<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from '@/components/GovClearIcon.vue';
import { GovClearBridge } from '@/services/govclearBridge';
import {
  MAX_IMAGES,
  MAX_TEXT_CHARACTERS,
  mergePageText,
  pageReady,
  recognizePages,
  validateSelection,
  type ImagePage
} from '@/services/govclearImages';
import sampleText from '@/assets/govclear/notice.txt?raw';
import summaryMobilePolicy from '@/assets/govclear/summary-mobile-policy.txt?raw';
import summaryPolicy from '@/assets/govclear/summary-policy.txt?raw';
import summaryReviewPolicy from '@/assets/govclear/summary-review-policy.txt?raw';
import { parseSummary, summaryStats } from '@/services/govclearSummary';
import sixQuestionsPolicy from '@/assets/govclear/six-questions-policy.txt?raw';
import { SIX_QUESTIONS, parseSixQuestions, type SixQuestionAnswers } from '@/services/govclearSixQuestions';
import sampleImage from '@/assets/govclear/notice.png';
import sampleSecondImage from '@/assets/govclear/notice-page2.png';

import { createResult, sendResult, type ResultExport } from '@/services/govclearResults';
const exportEndpoint = (import.meta.env.VITE_GOVCLEAR_RESULTS_API_URL ?? '').trim();
const resultExport = ref<ResultExport | null>(null);
const saveStatus = ref('');
const saveFailed = ref(false);
const saving = ref(false);
const jsonCopied = ref(false);
let upload: AbortController | undefined;
const exportJson = computed(() => JSON.stringify(resultExport.value, null, 2));
function resetExport() {
  upload?.abort();
  resultExport.value = null;
  saveStatus.value = '';
  saveFailed.value = false;
  saving.value = false;
  jsonCopied.value = false;
}
async function uploadResult() {
  const payload = resultExport.value;
  if (!payload || saving.value) return;
  if (!exportEndpoint) { saveStatus.value = '尚未設定後端網址；可先查看或複製 JSON。'; return; }
  const controller = new AbortController();
  upload = controller;
  saving.value = true;
  saveFailed.value = false;
  saveStatus.value = '正在儲存到後端…';
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    await sendResult(exportEndpoint, payload, controller.signal);
    if (resultExport.value?.resultId === payload.resultId) saveStatus.value = '已儲存到後端';
  } catch {
    if (resultExport.value?.resultId === payload.resultId) {
      saveFailed.value = true;
      saveStatus.value = '未確認儲存成功，請確認網路和後端服務後重試。摘要仍可閱讀。';
    }
  } finally {
    clearTimeout(timeout);
    if (resultExport.value?.resultId === payload.resultId) saving.value = false;
  }
}
async function copyJson() {
  try { await navigator.clipboard.writeText(exportJson.value); jsonCopied.value = true; }
  catch { saveStatus.value = '無法使用剪貼簿，請展開 JSON 後長按複製。'; }
}
const bridge = new GovClearBridge();
const mode = ref<'text' | 'image'>('text');
const input = ref('');
const images = ref<ImagePage[]>([]);
const ready = ref(false);
const modelLocation = ref('');
const checking = ref(true);
const busy = ref(false);
const error = ref('');
const summary = ref('');
const source = ref('');
const sixAnswers = ref<SixQuestionAnswers | null>(null);
const sixError = ref('');
const sixSeconds = ref(0);
const sixCopied = ref(false);
const elapsed = ref(0);
const stage = ref('');
const completedSeconds = ref(0);
const resultArea = ref<HTMLElement>();
const reviewArea = ref<HTMLElement>();
const fileInput = ref<HTMLInputElement>();
const cameraInput = ref<HTMLInputElement>();
const collectingPhotos = ref(false);
const copied = ref(false);
let generation = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let scrollTimer: ReturnType<typeof setTimeout> | undefined;
const mergedText = computed(() => mergePageText(images.value));
const count = computed(
  () => Array.from(mode.value === 'text' ? input.value : mergedText.value).length
);
const completedPages = computed(() => images.value.filter(pageReady).length);
const allRecognized = computed(
  () => images.value.length > 0 && completedPages.value === images.value.length
);
const hasReview = computed(() => images.value.some((page) => page.text || page.status === 'error'));
const canSummarize = computed(
  () =>
    ready.value &&
    !busy.value &&
    count.value > 0 &&
    count.value <= MAX_TEXT_CHARACTERS &&
    (mode.value === 'text' || allRecognized.value)
);
const sections = computed(() => parseSummary(summary.value));
const readingStats = computed(() =>
  summaryStats(
    source.value,
    sections.value.map((section) => `${section.title}\n${section.text}`).join('\n\n')
  )
);

function clearResult() {
  resetExport();
  sixAnswers.value = null;
  sixError.value = '';
  sixCopied.value = false;
  sixSeconds.value = 0;
  summary.value = '';
  source.value = '';
  error.value = '';
  copied.value = false;
}
function changeMode(value: 'text' | 'image') {
  if (!busy.value) {
    mode.value = value;
    clearResult();
  }
}
async function connect() {
  checking.value = true;
  error.value = '';
  try {
    modelLocation.value = await bridge.connect();
    ready.value = true;
  } catch (e) {
    ready.value = false;
    error.value = message(e);
  } finally {
    checking.value = false;
  }
}
function message(e: unknown) {
  return e instanceof Error ? e.message : '處理失敗，請稍後重試。';
}
async function loadSample() {
  if (busy.value) return;
  if (mode.value === 'text') input.value = sampleText.trim();
  else {
    if (images.value.length + 2 > MAX_IMAGES) {
      error.value = '兩張範例加入後會超過 5 張，請先移除部分圖片。';
      return;
    }
    images.value.push(
      ...[sampleImage, sampleSecondImage].map(
        (preview, index): ImagePage => ({
          id: crypto.randomUUID(),
          name: `合成通知範例-${index + 1}.png`,
          preview,
          size: 0,
          ownedPreview: false,
          text: '',
          status: 'pending',
          error: ''
        })
      )
    );
  }
  clearResult();
  if (mode.value === 'image') await run('transcribe');
}
async function pickImages(event: Event, fromCamera = false) {
  const element = event.target as HTMLInputElement;
  const files = Array.from(element.files || []);
  element.value = ''; // Permit selecting the same photo again after removal.
  if (!files.length || busy.value) return;
  try {
    validateSelection(images.value, files);
    for (const file of files)
      images.value.push({
        id: crypto.randomUUID(),
        name: file.name,
        preview: URL.createObjectURL(file),
        size: file.size,
        file,
        ownedPreview: true,
        text: '',
        status: 'pending',
        error: ''
      });
    clearResult();
    if (fromCamera) collectingPhotos.value = true;
    if (!collectingPhotos.value) await run('transcribe');
  } catch (e) {
    error.value = message(e);
  }
}
function removeImage(index: number) {
  if (busy.value) return;
  const [page] = images.value.splice(index, 1);
  if (page.ownedPreview) URL.revokeObjectURL(page.preview);
  if (!images.value.length) collectingPhotos.value = false;
  clearResult();
}
function moveImage(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (busy.value || target < 0 || target >= images.value.length) return;
  const [page] = images.value.splice(index, 1);
  images.value.splice(target, 0, page);
  clearResult();
}
function edited(page: ImagePage) {
  page.status = page.text.trim() && page.text.trim() !== '[無法辨識]' ? 'done' : 'pending';
  page.error = '';
  clearResult();
}
function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('圖片讀取失敗，請重新加入圖片。'));
    reader.readAsDataURL(blob);
  });
}
async function run(action: 'transcribe' | 'summarize') {
  if (busy.value || !ready.value || (action === 'summarize' && !canSummarize.value)) return;
  const id = ++generation;
  let text = mode.value === 'text' ? input.value : mergedText.value;
  busy.value = true;
  clearResult();
  elapsed.value = 0;
  stage.value = action === 'transcribe' ? '準備辨識圖片' : '正在產生白話摘要';
  const started = performance.now();
  timer = setInterval(() => {
    elapsed.value = Math.floor((performance.now() - started) / 1000);
  }, 1000);
  try {
    if (action === 'transcribe') {
      const failures = await recognizePages(
        images.value,
        async (page) => {
          // Selected blobs never leave the device; only bundled public fixtures use fetch.
          const blob = page.file || (await (await fetch(page.preview)).blob());
          const data = await toDataUrl(blob);
          if (id !== generation) throw new Error('已停止處理。');
          return bridge.request('transcribe', { image: data.split(',')[1] });
        },
        () => id === generation,
        (index) => {
          stage.value = `正在辨識第 ${index + 1} / ${images.value.length} 張`;
        }
      );
      if (id !== generation) return;
      if (failures || !allRecognized.value)
        throw new Error('部分圖片尚未辨識完成，已保留其他結果。請重試，或展開辨識文字修正後重新產生摘要。');
      text = mergedText.value;
    }
    if (Array.from(text).length > MAX_TEXT_CHARACTERS)
      throw new Error('合併文字超過 6,000 字，請減少圖片或分批摘要；原文不會被截斷。');
    stage.value = '正在產生白話摘要';
    {
      const value = await bridge.request('summarize', {
        text,
        policy: summaryPolicy,
        mobilePolicy: summaryMobilePolicy,
        reviewPolicy: summaryReviewPolicy
      });
      if (id !== generation) return;
      collectingPhotos.value = false;
      summary.value = value;
      source.value = text;
    }
    completedSeconds.value = (performance.now() - started) / 1000;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(
      () =>
        resultArea.value?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        }),
      100
    );
  } catch (e) {
    if (id === generation) error.value = message(e);
  } finally {
    if (id === generation) {
      clearInterval(timer);
      busy.value = false;
    }
  }
  if (id === generation && summary.value && source.value) await runSixQuestions();
}
async function runSixQuestions() {
  if (busy.value || !ready.value || !source.value || !summary.value) return;
  const id = ++generation;
  const document = source.value;
  busy.value = true;
  sixError.value = '';
  sixCopied.value = false;
  resetExport();
  stage.value = '正在整理六何資訊';
  elapsed.value = 0;
  const started = performance.now();
  timer = setInterval(() => {
    elapsed.value = Math.floor((performance.now() - started) / 1000);
  }, 1000);
  try {
    const value = await bridge.request('sixQuestions', { text: document, policy: sixQuestionsPolicy });
    if (id !== generation) return;
    sixAnswers.value = parseSixQuestions(value);
    resultExport.value = createResult(summary.value, sixAnswers.value, mode.value, document);
    void uploadResult();
    sixSeconds.value = (performance.now() - started) / 1000;
  } catch (e) {
    if (id === generation) sixError.value = message(e);
  } finally {
    if (id === generation) {
      clearInterval(timer);
      busy.value = false;
    }
  }
}
async function copySixQuestions() {
  if (!sixAnswers.value) return;
  try {
    await navigator.clipboard.writeText(SIX_QUESTIONS.map(({ key, title }) =>
      `${title}：${sixAnswers.value![key] ?? '原文未提及'}`).join('\n\n'));
    sixCopied.value = true;
  } catch {
    sixError.value = '無法使用剪貼簿，請長按六何文字複製。';
  }
}
function cancel() {
  generation++;
  clearInterval(timer);
  bridge.cancel();
  busy.value = false;
  images.value.forEach((page) => {
    if (page.status === 'processing') page.status = 'pending';
  });
}
async function copy() {
  try {
    await navigator.clipboard.writeText(
      sections.value.map((section) => `${section.title}\n${section.text}`).join('\n\n')
    );
    copied.value = true;
  } catch {
    error.value = '無法使用剪貼簿，請長按摘要文字複製。';
  }
}
onMounted(connect);
onBeforeUnmount(() => {
  upload?.abort();
  generation++;
  clearInterval(timer);
  clearTimeout(scrollTimer);
  bridge.dispose();
  images.value.forEach((page) => {
    if (page.ownedPreview) URL.revokeObjectURL(page.preview);
  });
});
</script>

<template>
  <div class="govclear">
    <header class="gc-header">
      <a href="/govclear" class="brand" aria-label="GovClear 首頁"
        ><Icon name="book" :size="27" />GovClear</a
      ><span class="header-label"><Icon name="leaf" :size="17" />閱讀助手</span>
    </header>
    <main>
      <div class="connection" role="status">
        <Icon :name="ready ? 'check' : 'shield'" :size="17" /><span>{{
          checking
            ? '正在確認本機模型…'
            : ready
              ? `${modelLocation} 已連線`
              : '請從 TownPass 開啟本機推論'
        }}</span
        ><button :disabled="checking || busy" aria-label="重新檢查模型" @click="connect">
          <Icon name="refresh" :size="18" />
        </button>
      </div>
      <section class="intro">
        <p class="eyebrow">看文件，少一點困惑</p>
        <h1>文件難懂，<br />重點一起看。</h1>
        <p>把通知裡的期限、條件與應辦事項，<br class="phone-break" />整理成容易理解的重點。</p>
      </section>
      <div class="tabs" role="group" aria-label="摘要輸入方式">
        <button
          :aria-pressed="mode === 'text'"
          :class="{ active: mode === 'text' }"
          :disabled="busy"
          data-testid="textTab"
          @click="changeMode('text')"
        >
          <Icon name="text" />文字摘要</button
        ><button
          :aria-pressed="mode === 'image'"
          :class="{ active: mode === 'image' }"
          :disabled="busy"
          data-testid="imageTab"
          @click="changeMode('image')"
        >
          <Icon name="scan" />圖片摘要
        </button>
      </div>
      <div v-if="busy" class="panel progress" role="status">
        <div class="progress-track"><span></span></div>
        <p>{{ stage }} · {{ elapsed }} 秒</p>
        <button class="text-button" @click="cancel">停止處理</button>
      </div>
      <section class="panel input-panel">
        <div class="panel-heading">
          <h2><span>01</span>{{ mode === 'text' ? '放入文件文字' : '選擇文件圖片' }}</h2>
          <button class="text-button" :disabled="busy || !ready" data-testid="sample" @click="loadSample">
            載入範例
          </button>
        </div>
        <template v-if="mode === 'text'"
          ><label class="sr-only" for="document-text">文件原文</label
          ><textarea
            id="document-text"
            v-model="input"
            :readonly="busy"
            placeholder="在這裡貼上公告、通知或公文內容…"
            data-testid="textInput"
            @input="clearResult"
          ></textarea>
          <div class="count" :class="{ invalid: count > 6000 }">
            {{ count.toLocaleString() }} / 6,000 字
          </div></template
        >
        <template v-else>
          <p class="help">相簿可多選，選好即自動辨識。拍照可連續追加，拍完後一次辨識並產生摘要。最多 5 張，合計 50 MB。</p>
          <div v-if="!images.length" class="image-preview empty">
            <Icon name="photo" :size="38" /><strong>清晰拍下每一頁文件</strong>
            <span>PNG / JPEG · 單張 20 MB 以內</span>
          </div>
          <ol v-else class="image-list" aria-label="文件圖片順序">
            <li
              v-for="(page, index) in images"
              :key="page.id"
              class="image-item"
              data-testid="imagePage"
            >
              <img :src="page.preview" :alt="`第 ${index + 1} 張文件預覽`" />
              <div class="image-info">
                <strong>第 {{ index + 1 }} 張</strong>
                <p class="filename">{{ page.name }}</p>
                <span class="page-status" :class="{ failed: page.status === 'error' }">{{
                  page.status === 'processing'
                    ? '辨識中…'
                    : pageReady(page)
                      ? '文字已就緒'
                      : page.status === 'error'
                        ? '辨識失敗，請重試'
                        : '尚未辨識'
                }}</span>
              </div>
              <div class="image-actions">
                <button
                  :disabled="busy || index === 0"
                  :aria-label="`將第 ${index + 1} 張往前移`"
                  data-testid="moveUp"
                  @click="moveImage(index, -1)"
                >
                  <Icon name="up" :size="17" />
                </button>
                <button
                  :disabled="busy || index === images.length - 1"
                  :aria-label="`將第 ${index + 1} 張往後移`"
                  data-testid="moveDown"
                  @click="moveImage(index, 1)"
                >
                  <Icon name="down" :size="17" />
                </button>
                <button
                  :disabled="busy"
                  :aria-label="`移除第 ${index + 1} 張`"
                  data-testid="removeImage"
                  @click="removeImage(index)"
                >
                  <Icon name="remove" :size="17" />
                </button>
              </div>
            </li>
          </ol>
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            accept="image/png,image/jpeg"
            multiple
            :disabled="!ready || busy || images.length >= MAX_IMAGES"
            aria-label="多選文件圖片"
            data-testid="imageFiles"
            @change="pickImages($event)"
          />
          <input
            ref="cameraInput"
            class="sr-only"
            type="file"
            accept="image/png,image/jpeg"
            capture="environment"
            :disabled="!ready || busy || images.length >= MAX_IMAGES"
            aria-label="拍攝文件照片"
            data-testid="cameraFiles"
            @change="pickImages($event, true)"
          />
          <button
            class="secondary full"
            :disabled="!ready || busy || images.length >= MAX_IMAGES"
            data-testid="takePhoto"
            @click="cameraInput?.click()"
          >
            <Icon name="photo" />{{ collectingPhotos ? '再拍一張' : '拍照加入' }}
          </button>
          <button
            class="secondary full"
            :disabled="!ready || busy || images.length >= MAX_IMAGES"
            @click="fileInput?.click()"
          >
            <Icon name="photo" />{{ images.length ? '繼續加入照片' : '從相簿選擇（可多選）' }}
          </button>
          <p v-if="images.length" class="batch-info" aria-live="polite">
            已加入 {{ images.length }} / {{ MAX_IMAGES }} 張 · {{ completedPages }} 張文字就緒
            <span v-if="collectingPhotos">。可繼續拍照或從相簿追加，拍好後按下方按鈕開始。</span>
          </p>
        </template>
      </section>
      <details v-if="mode === 'image' && hasReview && !busy" ref="reviewArea" class="panel review-panel">
        <summary>查看或修正辨識文字（選用）</summary>
        <p class="help">需要時可修正日期、金額與條件，再按重新產生摘要。</p>
        <div v-for="(page, index) in images" :key="page.id" class="page-review">
          <label :for="`recognized-text-${page.id}`">第 {{ index + 1 }} 張 · {{ page.name }}</label>
          <p v-if="page.error" class="error">{{ page.error }}</p>
          <textarea
            :id="`recognized-text-${page.id}`"
            v-model="page.text"
            :readonly="busy"
            :placeholder="
              page.status === 'pending'
                ? '尚未完成辨識，也可以手動填入這張圖片的原文。'
                : '請核對或修正辨識文字。'
            "
            data-testid="reviewInput"
            @input="edited(page)"
          ></textarea>
        </div>
        <div class="count" :class="{ invalid: count > MAX_TEXT_CHARACTERS }">
          合併文字（含頁序標記）{{ count.toLocaleString() }} / 6,000 字
        </div>
        <p v-if="count > MAX_TEXT_CHARACTERS" class="error">
          合併文字超過 6,000 字，請減少圖片或分批摘要；原文不會被截斷。
        </p>
      </details>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button
        v-if="!busy"
        class="primary full"
        :disabled="mode === 'text' ? !canSummarize : !ready || !images.length"
        data-testid="summarize"
        @click="run(mode === 'image' ? 'transcribe' : 'summarize')"
      >
        <Icon name="spark" />{{
          mode === 'image'
            ? collectingPhotos ? '拍好了，開始辨識與摘要' : '重新產生摘要'
            : '產生白話摘要'
        }}
      </button>
      <section v-if="summary" ref="resultArea" class="results" data-testid="summaryResult">
        <div class="results-heading">
          <h2>白話重點</h2>
          <span>{{ completedSeconds.toFixed(1) }} 秒</span>
        </div>
        <p v-if="readingStats.original" class="reading-stats">
          原文 {{ readingStats.original }} 字 → 摘要 {{ readingStats.summary }} 字<span
            v-if="readingStats.reduction > 0"
          >
            · 文字減少 {{ readingStats.reduction }}%</span
          >
        </p>
        <p class="draft"><Icon name="shield" :size="17" />AI 草稿 · 請核對原文</p>
        <article
          v-for="(section, i) in sections"
          :key="i"
          class="panel summary-card"
          :class="{ lead: i === 0 }"
        >
          <div>
            <h3>{{ section.title }}</h3>
            <p>{{ section.text }}</p>
          </div>
        </article>
        <section class="six-section" aria-labelledby="six-title">
          <div class="results-heading">
            <h2 id="six-title">六何整理</h2>
            <span v-if="sixAnswers">{{ sixSeconds.toFixed(1) }} 秒</span>
          </div>
          <p class="help">摘要完成後自動從原文整理六何資訊。原文未提及的資訊不推測。</p>
          <button class="secondary full" :disabled="busy || !ready" data-testid="sixQuestions" @click="runSixQuestions">
            <Icon name="spark" :size="17" />{{ sixAnswers ? '重新整理六何' : '產生六何整理' }}
          </button>
          <p v-if="busy && stage === '正在整理六何資訊'" role="status">正在整理六何資訊 · {{ elapsed }} 秒</p>
          <p v-if="sixError" class="error" role="alert" data-testid="sixError">{{ sixError }}</p>
          <dl v-if="sixAnswers" class="six-grid" data-testid="sixResult">
            <div v-for="item in SIX_QUESTIONS" :key="item.key" class="panel six-card" data-testid="sixCard">
              <dt>{{ item.title }}<small>{{ item.hint }}</small></dt>
              <dd :class="{ missing: sixAnswers[item.key] === null }" :data-six-field="item.key">{{ sixAnswers[item.key] ?? '原文未提及' }}</dd>
            </div>
          </dl>
          <button v-if="sixAnswers" class="secondary full" @click="copySixQuestions">
            <Icon name="copy" :size="17" />{{ sixCopied ? '已複製六何整理' : '複製六何整理' }}
          </button>
        </section>
        <section v-if="resultExport" class="panel" data-testid="resultExport">
          <h3>結果 JSON</h3>
          <p role="status" data-testid="saveStatus">{{ saveStatus }}</p>
          <p style="overflow-wrap: anywhere">結果編號：{{ resultExport.resultId }}</p>
          <details><summary>查看送出 JSON</summary><pre style="white-space: pre-wrap; overflow-wrap: anywhere">{{ exportJson }}</pre></details>
          <button class="secondary full" @click="copyJson">{{ jsonCopied ? '已複製 JSON' : '複製 JSON' }}</button>
          <button v-if="saveFailed" class="secondary full" :disabled="saving" @click="uploadResult">重試儲存</button>
          <p class="help">離開此頁前請確認儲存成功；重試不會重複新增同一筆結果。</p>
        </section>
        <details class="panel evidence">
          <summary>查看本次摘要依據的原文<Icon name="chevron" :size="17" /></summary>
          <p>{{ source }}</p>
        </details>
        <button class="secondary full" @click="copy">
          <Icon name="copy" :size="17" />{{ copied ? '已複製摘要' : '複製摘要' }}
        </button>
      </section>
      <footer>
        <Icon name="shield" :size="18" />
        <p>結果僅協助閱讀，不能取代原文。<br />設定後端後，摘要依據的原文、摘要與六何整理會自動送出儲存；不包含圖片檔。</p>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.six-section { margin-top: 28px; }
.six-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
.six-card { margin: 0; min-width: 0; }
.six-card dt { color: var(--green); font-weight: 700; font-size: 19px; }
.six-card small { display: block; margin-top: 4px; font-size: 13px; font-weight: 400; color: var(--muted); }
.six-card dd { margin: 12px 0 0; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
.six-card dd.missing { color: var(--muted); }
@media (max-width: 560px) { .six-grid { grid-template-columns: 1fr; } }

.govclear {
  --green: #176354;
  --ink: #203c35;
  --muted: #687971;
  --line: #dce4db;
  background: #f6f7f3;
  color: var(--ink);
  min-height: 100dvh;
  font-family:
    'PingFang TC',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  font-size: 16px;
}
.govclear * {
  box-sizing: border-box;
}
.gc-header {
  max-width: 700px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 18px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--green);
  font-size: 22px;
  font-weight: 700;
  text-decoration: none;
  letter-spacing: -0.6px;
}
.header-label {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--green);
  font-size: 12px;
}
main {
  max-width: 700px;
  margin: auto;
  padding: 8px 24px 30px;
}
.connection {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  color: var(--green);
  background: #e8eee5;
  font-size: 11px;
  line-height: 1.6;
}
.connection span {
  flex: 1;
}
.connection button {
  display: grid;
  place-items: center;
  padding: 6px;
  border: 0;
  background: transparent;
  color: inherit;
}
.intro {
  margin: 28px 0 24px;
}
.eyebrow {
  font-size: 11px;
  letter-spacing: 0.14em;
  font-weight: 600;
  color: var(--green);
  margin: 0 0 10px;
}
h1 {
  font-size: 35px;
  line-height: 1.24;
  letter-spacing: -1px;
  font-weight: 700;
  margin: 0 0 14px;
}
.intro > p:last-child {
  color: var(--muted);
  font-size: 14px;
  line-height: 1.8;
  margin: 0;
}
.tabs {
  display: flex;
  padding: 4px;
  background: #e9eee6;
  border-radius: 16px;
  margin-bottom: 22px;
}
.tabs button {
  width: 50%;
  border: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 13px 8px;
  background: transparent;
  color: var(--muted);
  font-size: 15px;
  font-weight: 600;
}
.tabs button.active {
  background: var(--green);
  color: #fff;
  box-shadow: 0 3px 8px #17635418;
}
.panel {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 18px;
}
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.panel h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 9px;
}
.panel h2 > span {
  font-size: 11px;
  color: #7c9184;
  font-weight: 600;
}
.text-button {
  background: transparent;
  color: var(--green);
  border: 0;
  padding: 8px 0;
  font-size: 13px;
  white-space: nowrap;
}
textarea {
  resize: vertical;
  display: block;
  width: 100%;
  min-height: 210px;
  max-height: 60vh;
  margin-top: 18px;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 15px;
  line-height: 1.85;
  color: var(--ink);
  padding: 0;
  border-radius: 3px;
}
textarea::placeholder {
  color: #9ba79f;
}
textarea:focus-visible {
  outline: 2px solid #c3d6c8;
  outline-offset: 6px;
}
.count {
  text-align: right;
  color: #95a197;
  font-size: 11px;
  margin-top: 12px;
  font-variant-numeric: tabular-nums;
}
.count.invalid,
.error {
  color: #a03c28;
}
.full {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}
.primary {
  border: 0;
  background: var(--green);
  color: white;
  border-radius: 16px;
  padding: 18px 14px;
  font-size: 16px;
  font-weight: 600;
  margin-top: 20px;
}
.secondary,
.tonal {
  border: 1px solid #cbd8cb;
  border-radius: 12px;
  background: white;
  color: var(--green);
  padding: 13px;
  font-size: 14px;
  margin-top: 12px;
}
.tonal {
  background: #e9f1e9;
  border-color: transparent;
}
.image-preview {
  min-height: 160px;
  margin: 20px 0 12px;
  border-radius: 12px;
  background: #f3f5f0;
  overflow: hidden;
}
.image-preview img {
  width: 100%;
  max-height: 260px;
  object-fit: contain;
}
.image-preview.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--green);
}
.image-preview strong {
  font-size: 14px;
  font-weight: 500;
}
.image-preview span {
  font-size: 11px;
  color: var(--muted);
}
.filename {
  font-size: 11px;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.help {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.7;
  margin: 12px 0 0;
}
.review-panel {
  scroll-margin-top: 20px;
}
.progress {
  position: sticky;
  top: 8px;
  z-index: 2;
  box-shadow: 0 4px 18px #203c3510;
  text-align: center;
  margin-top: 18px;
}
.progress p {
  font-size: 14px;
  margin: 14px 0 4px;
}
.progress-track {
  height: 3px;
  overflow: hidden;
  background: #d3e5db;
  border-radius: 4px;
}
.progress-track span {
  display: block;
  height: 100%;
  width: 40%;
  background: var(--green);
  animation: progress 1.8s ease-in-out infinite;
}
.error {
  font-size: 13px;
  line-height: 1.7;
  margin: 16px 0;
}
.results {
  margin-top: 30px;
  scroll-margin-top: 20px;
}
.results-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.results-heading h2 {
  font-size: 23px;
  font-weight: 700;
  margin: 0;
}
.results-heading span {
  font-size: 12px;
  color: var(--muted);
}
.draft {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--green);
  font-size: 12px;
  margin: 14px 0 18px;
}
.summary-card {
  display: flex;
  gap: 14px;
}
.card-number {
  color: #688575;
  font-size: 11px;
  line-height: 25px;
}
.summary-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 9px;
}
.summary-card p {
  font-size: 14px;
  line-height: 1.9;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 0;
}
.evidence summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-size: 13px;
  list-style: none;
}
.evidence summary::-webkit-details-marker {
  display: none;
}
.evidence[open] svg {
  transform: rotate(90deg);
}
.evidence p {
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.8;
  margin: 18px 0 0;
}
footer {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: var(--muted);
  margin-top: 24px;
}
footer p {
  font-size: 11px;
  line-height: 1.8;
  margin: 0;
}
button {
  font-family: inherit;
  cursor: pointer;
  touch-action: manipulation;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
button:focus-visible,
a:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 4px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@keyframes progress {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}
@media (min-width: 640px) {
  main {
    padding-top: 20px;
  }
  .intro {
    margin: 38px 0 30px;
  }
  h1 {
    font-size: 45px;
  }
  .input-panel {
    padding: 26px;
  }
  textarea {
    min-height: 240px;
  }
  .phone-break {
    display: none;
  }
  .gc-header {
    padding-top: 30px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .progress-track span {
    animation: none;
    width: 100%;
  }
}
.image-list {
  list-style: none;
  padding: 0;
  margin: 18px 0 0;
}
.image-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.image-item img {
  width: 64px;
  height: 82px;
  object-fit: contain;
  border-radius: 8px;
  background: #f3f5f0;
  flex-shrink: 0;
}
.image-info {
  flex: 1;
  min-width: 0;
}
.image-info strong {
  font-size: 14px;
  font-weight: 600;
}
.image-info .filename {
  margin: 5px 0;
  font-size: 11px;
}
.image-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.image-actions button {
  background: transparent;
  border: 0;
  color: var(--green);
  padding: 7px;
  min-width: 36px;
  min-height: 32px;
  display: grid;
  place-items: center;
}
.page-status,
.batch-info {
  font-size: 11px;
  color: var(--green);
}
.page-status.failed {
  color: #a03c28;
}
.batch-info {
  text-align: center;
  margin: 14px 0 0;
}
.page-review {
  border-top: 1px solid var(--line);
  margin-top: 20px;
  padding-top: 16px;
}
.page-review label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.page-review textarea {
  min-height: 170px;
  margin-top: 12px;
}
.summary-card.lead {
  background: #eef4ec;
  border-color: #d1dfcf;
}
.summary-card.lead p {
  font-size: 17px;
  font-weight: 500;
  line-height: 1.85;
}
.reading-stats {
  font-size: 11px;
  color: var(--muted);
  margin: 10px 0 0;
}
</style>
