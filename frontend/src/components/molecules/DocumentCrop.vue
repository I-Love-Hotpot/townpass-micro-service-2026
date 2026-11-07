<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import {
  context,
  detect,
  encodeCanvas,
  fullCorners,
  loadOriginal,
  rotateCorners,
  rotateImage,
  touchPoint,
  validCorners,
  warp,
  yieldTask,
  type Corners
} from '@/services/documentCrop';

const props = defineProps<{ original: Blob; initial?: { corners: Corners; turns: number } }>();
const emit = defineEmits<{
  confirm: [blob: Blob];
  cancel: [];
  draft: [draft: { corners: Corners; turns: number }];
}>();
const state = ref<'detecting' | 'adjusting' | 'correcting' | 'preview' | 'confirmed' | 'error'>(
  'detecting'
);
const source = shallowRef<HTMLCanvasElement>();
const result = shallowRef<HTMLCanvasElement>();
const surface = ref<HTMLCanvasElement>();
const heading = ref<HTMLHeadingElement>();
const loupe = ref<HTMLCanvasElement>();
const points = ref<Corners>(props.initial?.corners ?? fullCorners());
const turns = ref(props.initial?.turns ?? 0);
const message = ref('');
const error = ref('');
const active = ref<number>();
const compare = ref(false);
const working = computed(() => state.value === 'detecting' || state.value === 'correcting');
const controller = new AbortController();
let operation = 0;
let pointer: number | undefined;
let correction: AbortController | undefined;
let dragOrigin: { x: number; y: number; point: { x: number; y: number } } | undefined;
const names = ['左上', '右上', '右下', '左下'];
const polygon = computed(() => points.value.map((p) => `${p.x * 100},${p.y * 100}`).join(' '));
const displayed = computed(() =>
  state.value === 'preview' && !compare.value ? result.value : source.value
);
const frameStyle = computed(() => ({
  width: `min(100%, calc(52dvh * ${(displayed.value?.width ?? 1) / (displayed.value?.height ?? 1)}))`
}));
const magnifierStyle = computed(() => {
  const p = points.value[active.value ?? 0];
  return {
    left: p.x > 0.5 ? '8px' : 'auto',
    right: p.x > 0.5 ? 'auto' : '8px',
    top: p.y > 0.45 ? '8px' : 'auto',
    bottom: p.y > 0.45 ? 'auto' : '8px'
  };
});
function save() {
  emit('draft', {
    corners: points.value.map((p) => ({ ...p })) as Corners,
    turns: turns.value
  });
}
async function paint() {
  await nextTick();
  if (surface.value && displayed.value) {
    // Display and touch coordinates share this exact image box, with no contain letterboxing.
    const scale = Math.min(1, 1400 / Math.max(displayed.value.width, displayed.value.height));
    surface.value.width = Math.round(displayed.value.width * scale);
    surface.value.height = Math.round(displayed.value.height * scale);
    context(surface.value).drawImage(
      displayed.value,
      0,
      0,
      surface.value.width,
      surface.value.height
    );
  }
}
async function detectAgain() {
  if (!source.value || working.value) return;
  const id = ++operation;
  state.value = 'detecting';
  error.value = '';
  await yieldTask();
  if (controller.signal.aborted || id !== operation) return;
  try {
    const found = detect(source.value);
    points.value = found.corners ?? fullCorners();
    message.value = found.corners
      ? '已找到候選範圍，請確認四角及文件內容。'
      : '無法可靠偵測文件，已選取整張圖片，請手動調整。';
    if (found.blurry) message.value += ' 圖片可能模糊，建議重新拍攝。';
    if (points.value.some((p) => p.x < 0.01 || p.y < 0.01 || p.x > 0.99 || p.y > 0.99))
      message.value += ' 文件接近畫面邊緣，請確認內容完整。';
    state.value = 'adjusting';
    save();
  } catch (cause) {
    fail(cause);
  }
}
function fail(cause: unknown) {
  error.value = cause instanceof Error ? cause.message : '影像處理失敗，請重試。';
  state.value = source.value ? 'adjusting' : 'error';
}
async function initialize() {
  try {
    source.value = await loadOriginal(props.original, controller.signal);
    for (let i = 0; i < turns.value; i++) {
      const old = source.value;
      source.value = rotateImage(old);
      old.width = old.height = 1;
    }
    state.value = 'adjusting';
    if (!props.initial) await detectAgain();
    await paint();
  } catch (cause) {
    if (!controller.signal.aborted) fail(cause);
  }
}
function move(index: number, point: { x: number; y: number }) {
  const next = points.value.map((p) => ({ ...p })) as Corners;
  next[index] = point;
  if (!validCorners(next)) {
    error.value = '角點不可交叉或讓面積小於 1%。';
    return;
  }
  points.value = next;
  error.value = '';
  save();
  void magnify();
}
async function magnify() {
  await nextTick();
  if (active.value === undefined || !source.value || !surface.value || !loupe.value) return;
  const p = points.value[active.value],
    ctx = context(loupe.value),
    zoom = 2.5;
  const span = 112 / ((surface.value.getBoundingClientRect().width / source.value.width) * zoom);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 112, 112);
  ctx.drawImage(
    source.value,
    p.x * (source.value.width - 1) - span / 2,
    p.y * (source.value.height - 1) - span / 2,
    span,
    span,
    0,
    0,
    112,
    112
  );
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(56, 0);
  ctx.lineTo(56, 112);
  ctx.moveTo(0, 56);
  ctx.lineTo(112, 56);
  ctx.stroke();
}
function start(event: PointerEvent, index: number) {
  if (working.value || pointer !== undefined) return;
  event.preventDefault();
  pointer = event.pointerId;
  active.value = index;
  dragOrigin = { x: event.clientX, y: event.clientY, point: { ...points.value[index] } };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  void magnify();
}
function drag(event: PointerEvent) {
  if (event.pointerId !== pointer || active.value === undefined || !surface.value) return;
  if (!dragOrigin) return;
  const rect = surface.value.getBoundingClientRect();
  move(
    active.value,
    touchPoint(
      dragOrigin.point.x * rect.width + event.clientX - dragOrigin.x,
      dragOrigin.point.y * rect.height + event.clientY - dragOrigin.y,
      { left: 0, top: 0, width: rect.width, height: rect.height }
    )
  );
}
function end() {
  pointer = undefined;
  active.value = undefined;
  dragOrigin = undefined;
}
function keyboard(event: KeyboardEvent, index: number) {
  const delta: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
  };
  if (!delta[event.key]) return;
  event.preventDefault();
  const [x, y] = delta[event.key],
    p = points.value[index],
    step = event.shiftKey ? 0.01 : 0.002;
  move(index, {
    x: Math.max(0, Math.min(1, p.x + x * step)),
    y: Math.max(0, Math.min(1, p.y + y * step))
  });
}
async function rotate() {
  if (working.value || !source.value) return;
  try {
    if (state.value === 'preview' && result.value) {
      const old = result.value;
      result.value = rotateImage(old);
      old.width = old.height = 1;
      compare.value = false;
    } else {
      const old = source.value;
      source.value = rotateImage(old);
      old.width = old.height = 1;
      points.value = rotateCorners(points.value);
      turns.value = (turns.value + 1) % 4;
      save();
    }
    await paint();
  } catch (cause) {
    fail(cause);
  }
}
async function correct() {
  if (working.value || !source.value) return;
  const id = ++operation;
  state.value = 'correcting';
  error.value = '';
  end();
  correction?.abort();
  const current = new AbortController();
  correction = current;
  try {
    const image = await warp(source.value, points.value, current.signal);
    if (controller.signal.aborted || id !== operation) {
      image.width = image.height = 1;
      return;
    }
    if (result.value) result.value.width = result.value.height = 1;
    result.value = image;
    compare.value = false;
    state.value = 'preview';
    await paint();
  } catch (cause) {
    if (!controller.signal.aborted && id === operation) fail(cause);
  }
}
async function confirm(original = false) {
  if (working.value) return;
  if (original) {
    state.value = 'confirmed';
    emit('confirm', props.original);
    return;
  }
  if (!result.value) return;
  const id = ++operation;
  state.value = 'correcting';
  try {
    const blob = await encodeCanvas(result.value);
    if (!controller.signal.aborted && id === operation) {
      state.value = 'confirmed';
      emit('confirm', blob);
    }
  } catch (cause) {
    if (!controller.signal.aborted && id === operation) {
      state.value = 'preview';
      error.value = cause instanceof Error ? cause.message : '暫存失敗，請重試。';
    }
  }
}
async function back() {
  state.value = 'adjusting';
  compare.value = false;
  await paint();
}
function background() {
  if (document.hidden) {
    end();
    if (state.value === 'correcting') {
      operation++;
      correction?.abort();
      state.value = 'adjusting';
      error.value = '已暫停校正，請重新確認裁切。';
    }
  }
}
onMounted(() => {
  heading.value?.focus();
  void initialize();
  document.addEventListener('visibilitychange', background);
  window.addEventListener('resize', end);
});
onBeforeUnmount(() => {
  controller.abort();
  correction?.abort();
  operation++;
  document.removeEventListener('visibilitychange', background);
  window.removeEventListener('resize', end);
  if (source.value) source.value.width = source.value.height = 1;
  if (result.value) result.value.width = result.value.height = 1;
});
</script>

<template>
  <section class="space-y-4" aria-labelledby="crop-heading" :aria-busy="working">
    <h1 id="crop-heading" ref="heading" tabindex="-1" class="page-title">
      {{ state === 'preview' ? '確認校正結果' : '調整文件範圍' }}
    </h1>
    <p class="text-sm text-muted">
      拖曳四角調整範圍；鍵盤方向鍵微調，Shift 加大步幅。確認內容完整後才開始辨識。
    </p>
    <p v-if="message" role="status" class="text-sm">{{ message }}</p>
    <p v-if="working" role="status">
      {{ state === 'detecting' ? '正在偵測文件…' : '正在處理圖片…' }}
    </p>
    <p v-if="error" role="alert" class="feedback">{{ error }}</p>
    <div v-if="source" class="crop-frame" :style="frameStyle">
      <canvas
        ref="surface"
        class="crop-image"
        role="img"
        :aria-label="state === 'preview' && !compare ? '透視校正後的文件' : '原始文件圖片'"
      />
      <template v-if="state !== 'preview'">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          class="crop-overlay"
          aria-hidden="true"
        >
          <path
            :d="`M0,0 H100 V100 H0 Z M${points.map((p) => `${p.x * 100},${p.y * 100}`).join(' L')} Z`"
            fill="black"
            fill-opacity="0.55"
            fill-rule="evenodd"
          />
          <polygon
            :points="polygon"
            fill="none"
            stroke="#fff"
            stroke-width="0.6"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <button
          v-for="(point, index) in points"
          :key="index"
          type="button"
          class="crop-handle"
          :style="{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }"
          :aria-label="`${names[index]}角，水平 ${Math.round(point.x * 100)}%，垂直 ${Math.round(point.y * 100)}%`"
          :disabled="working"
          @pointerdown="start($event, index)"
          @pointermove="drag"
          @pointerup="end"
          @pointercancel="end"
          @lostpointercapture="end"
          @keydown="keyboard($event, index)"
        >
          <span />
        </button>
        <canvas
          v-if="active !== undefined"
          ref="loupe"
          width="112"
          height="112"
          class="crop-loupe"
          :style="magnifierStyle"
          aria-hidden="true"
        />
      </template>
    </div>
    <div class="flex flex-wrap gap-2">
      <template v-if="state === 'preview'">
        <button type="button" class="action-button" @click="back">返回調整</button>
        <button
          type="button"
          class="action-button"
          :aria-pressed="compare"
          @click="
            compare = !compare;
            paint();
          "
        >
          {{ compare ? '顯示校正圖片' : '比較原圖' }}
        </button>
        <button type="button" class="action-button" @click="rotate">旋轉校正結果</button>
        <button type="button" class="action-button" @click="confirm()">確認圖片，準備 OCR</button>
      </template>
      <template v-else>
        <button
          type="button"
          class="action-button"
          :disabled="working || !source"
          @click="detectAgain"
        >
          重新偵測
        </button>
        <button type="button" class="action-button" :disabled="working || !source" @click="rotate">
          旋轉 90°
        </button>
        <button
          type="button"
          class="action-button"
          :disabled="working || !source"
          @click="
            points = fullCorners();
            save();
          "
        >
          重設四角
        </button>
        <button
          type="button"
          class="action-button"
          :disabled="working || !source || !validCorners(points)"
          @click="correct"
        >
          確認裁切
        </button>
      </template>
      <button type="button" class="action-button" :disabled="working" @click="confirm(true)">
        使用整張原圖
      </button>
      <button type="button" class="text-action" @click="emit('cancel')">取消，保留圖片</button>
    </div>
  </section>
</template>

<style scoped>
.crop-frame {
  position: relative;
  margin: 24px auto;
  background: #eee;
}
.crop-image {
  display: block;
  width: 100%;
  height: auto;
}
.crop-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.crop-handle {
  position: absolute;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  touch-action: none;
  user-select: none;
}
.crop-handle span {
  width: 18px;
  height: 18px;
  background: #fff;
  border: 3px solid #165b48;
  border-radius: 50%;
}
.crop-handle:focus-visible {
  outline: 3px solid #165b48;
  outline-offset: 2px;
}
.crop-loupe {
  position: absolute;
  width: 112px;
  height: 112px;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: none;
}
</style>
