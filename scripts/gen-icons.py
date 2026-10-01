# -*- coding: utf-8 -*-
"""PWA 图标全套生成器（囚徒健身 · 六艺十式动作指导站）。

**输入**：一张正方形设计稿 `icon-design/source-app-icon.png`（唯一真源，来自设计工具 / AI 出图）。
**输出**：7 个文件到 `public/icons/`。

当前设计（2026-10-01 用户提供）：
    做旧纸质的奶油底 + 五根铁栏 + 左侧「计数记号」（4 竖 1 斜 ＝ 5）+ 俯卧撑剪影。
    语义：铁栏＝囚，记号＝组数/次数，剪影＝自重训练。色调是墨黑压奶油，很硬。

产物清单：
    icon-192.png / icon-512.png                    圆角 + 四角透明，manifest purpose=any
    icon-maskable-192.png / icon-maskable-512.png  满幅底 + 内容缩到 Android 安全圆内
    apple-touch-icon.png                           180，满幅不透明（iOS 会把透明合成黑角）
    favicon-32.png                                 32，按内容框裁切（见下）
    favicon.ico                                    多尺寸 ICO

## 设计稿不是「满幅方块」时要处理的三件事

1. **自动裁掉外部留白。** 出图工具给的图常带一圈黑底/透明底。这里按亮度阈值找边界，
   再往里收一点甩掉边缘压缩杂边，然后居中裁成正方形。
2. **补掉四角。** 设计稿自己带圆角，圆角之外是黑底。若直接在黑底上套我们的圆角遮罩，
   半径只要小了半分就会露出一圈黑边。做法是先把圆角外那圈用**取自有内容区域的奶油色**
   填平，之后任何遮罩形状都安全。
   （用平色而不是模糊底衬 —— 角上要补的面积只有图标面积的 0.4%，且很快被遮罩裁掉。）
3. **maskable 的缩放比要按内容实算，不能拍脑袋。** Android 的安全区是以中心为圆心、
   直径 80% 的圆。脚本用「内容实际外接框的最远角」反推缩放比 ⇒ 换一张设计稿也自动适配。

## 为什么 maskable 要另出一组

`purpose: any maskable` 会让 launcher 在已经画好的圆角上**再套一层**遮罩，圆角会被裁坏。
所以 any 版（圆角、四角透明）与 maskable 版（满幅不透明、内容缩到安全圆内）必须分开。

## 32px 的处理

设计稿有 5 根铁栏 + 一个人 + 一堆记号，直接缩到 32px 是一团糊。
所以小尺寸**按内容外接框裁切**（再留一点边），把有效信息放大到占满画面。

重跑（只有 default venv 装了 Pillow）：
    npm run gen:icons
    # 或
    "C:/Users/Zupeng Lin/.workbuddy/binaries/python/envs/default/Scripts/python.exe" scripts/gen-icons.py

⚠️ 改完图标必须把 manifest.json / index.html 里的 `?v=` 全部 +1，否则浏览器缓存、
    SW 预缓存、系统 launcher 任何一层都可能继续用旧图。
"""
import math
import os
import sys
import statistics

from PIL import Image, ImageDraw

# ============================== 参数 ==============================

SOURCE_SIZE = 1024   # 归一化后的源图边长（≥1024 才够 512 图标用）

CROP_THRESHOLD = 120  # 自动裁边用的亮度阈值（奶油底 ~205，黑底 ~1，取中间偏亮）
CROP_INSET = 0.015    # 裁完再往里收的比例，甩掉边缘的 JPEG 杂边

RADIUS_RATIO = 0.20   # 圆角比例（与设计稿自身的圆角一致，实测约 0.207）
SS = 4                # 圆角遮罩超采样倍率

SAFE_RADIUS = 0.395   # Android maskable 安全圆半径（官方 0.40，留一点余量）
MIN_MASK_SCALE = 0.60  # 内容本身就贴边时的兜底，避免缩得过小

INK_THRESHOLD = 120   # 判定「墨迹」的亮度阈值（奶油 ~205，墨 ~0，取中间）
PROBE = 128           # 求内容范围时的降采样边长：把 1–2px 的纸纹噪点平均掉，
                      # 否则 getbbox() 会被边缘杂点带跑（实测阈值直接取会得到整张图）
FAVICON_PAD = 0.07    # 32px 版在内容框外留的边（比例）

# ================================================================

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'icon-design', 'source-app-icon.png')
OUT = os.path.join(ROOT, 'public', 'icons')


# ---------------------------------------------------------------------------
# 源图标准化
# ---------------------------------------------------------------------------
def _resize(img, size):
    return img.resize((size, size), Image.LANCZOS)


def load_source():
    """读设计稿 → 裁掉外部留白 → 居中裁方 → 归一化到 SOURCE_SIZE。"""
    if not os.path.exists(SRC):
        sys.exit(f'找不到设计稿：{SRC}\n请把正方形设计稿放到该路径。')

    img = Image.open(SRC).convert('RGB')
    if img.width != img.height:
        print(f'[warn] 设计稿不是正方形（{img.size}），按短边居中裁切。')

    # ① 按亮度找有效区域
    box = img.convert('L').point(lambda v: 255 if v > CROP_THRESHOLD else 0).getbbox()
    if not box:
        sys.exit('设计稿整张都是暗的，无法定位有效区域。')

    # ② 再往里收一点，甩掉边缘的压缩杂边
    inset = int(min(img.size) * CROP_INSET)
    box = (box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset)

    # ③ 居中裁成正方形
    side = min(box[2] - box[0], box[3] - box[1])
    cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
    img = img.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side))

    return _resize(img, SOURCE_SIZE)


def _pixels(img):
    """Pillow 14 起 `getdata()` 被弃用，改用 `get_flattened_data()`（跑在两版上都行）。"""
    if hasattr(img, 'get_flattened_data'):
        return list(img.get_flattened_data())
    return list(img.getdata())


def fill_corners(tile, radius_ratio=RADIUS_RATIO):
    """把设计稿自己圆角之外的那圈（原图是黑底）填成奶油色。

    填成平色即可：要补的面积只占 0.4%，而且我们的遮罩半径不比它小，实际几乎全被裁掉。
    关键是**不能留黑** —— 否则遮罩只要差半分就会露出黑边。

    取色要取**外圈**的中位数，不能取整张图的中位数：这类做旧风设计普遍带暗角，
    整图中位数会比边缘暗一截，平铺之后内外两个色块一眼就分得出来。
    """
    w, h = tile.size
    band = max(4, int(min(w, h) * 0.06))
    ring = Image.new('RGB', (0, 0))
    strips = [
        tile.crop((0, 0, w, band)),
        tile.crop((0, h - band, w, h)),
        tile.crop((0, 0, band, h)),
        tile.crop((w - band, 0, w, h)),
    ]
    ring = Image.new('RGB', (band, band * 4 + band * 4 // 3))
    y = 0
    for s in strips:
        ring.paste(s.resize((band, band), Image.BOX), (0, y))
        y += band
    data = _pixels(ring)
    cream = tuple(int(statistics.median(px[i] for px in data)) for i in range(3))

    mask = Image.new('L', tile.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, w - 1, h - 1],
        radius=int(w * radius_ratio),
        fill=255,
    )

    out = Image.new('RGB', tile.size, cream)
    out.paste(tile, (0, 0), mask)
    return out, cream


def ink_mask(img, probe=PROBE, threshold=INK_THRESHOLD):
    """降采样后的墨迹掩码（'L'：255 = 墨）。"""
    return img.convert('L').resize((probe, probe), Image.BOX).point(
        lambda v: 255 if v < threshold else 0
    )


def content_bbox(img, probe=PROBE, threshold=INK_THRESHOLD):
    """墨迹外接框（换算回原图坐标）。"""
    bb = ink_mask(img, probe, threshold).getbbox()
    if not bb:
        return None
    s = img.width / probe
    return tuple(int(round(v * s)) for v in bb)


def max_ink_radius(img, probe=PROBE, threshold=INK_THRESHOLD):
    """墨迹离中心最远的像素有多远（以边长比例计）。

    maskable 的缩放要按「最远的**墨迹像素**」算，不能按外接框的四个角算 ——
    外接框的角常常是空的（这张设计稿的左下角就是纯奶油），按角算会把图标缩得过小。
    """
    mask = ink_mask(img, probe, threshold)
    px = mask.load()
    worst = 0.0
    for y in range(probe):
        for x in range(probe):
            if px[x, y]:
                dx = (x + 0.5) / probe - 0.5
                dy = (y + 0.5) / probe - 0.5
                d = math.hypot(dx, dy)
                if d > worst:
                    worst = d
    return worst


def crop_to_content(img, pad_frac=FAVICON_PAD):
    """按内容外接框裁切并留边 —— 小尺寸专用，把有效信息放大。"""
    box = content_bbox(img)
    if not box:
        return img
    pw = int((box[2] - box[0]) * pad_frac)
    ph = int((box[3] - box[1]) * pad_frac)
    return img.crop(
        (
            max(0, box[0] - pw),
            max(0, box[1] - ph),
            min(img.width, box[2] + pw),
            min(img.height, box[3] + ph),
        )
    )


def square(img):
    """居中裁成正方形。"""
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    return img.crop((left, top, left + side, top + side))


# ---------------------------------------------------------------------------
# 图标派生
# ---------------------------------------------------------------------------
def rounded(img, size, radius_ratio=RADIUS_RATIO):
    """圆角 + 四角透明 → manifest purpose=any / favicon。"""
    big = _resize(img, size * SS)
    mask = Image.new('L', (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size * SS - 1, size * SS - 1],
        radius=int(size * SS * radius_ratio),
        fill=255,
    )
    out = Image.new('RGBA', (size * SS, size * SS), (0, 0, 0, 0))
    out.paste(big, (0, 0), mask)
    return _resize(out, size)


def mask_scale_for(tile):
    """按「最远墨迹像素」反推 maskable 的缩放比。

    安全区是以中心为圆心、直径 80% 的圆。把内容缩到它的最远点正好落在安全半径上即可 ——
    换设计稿自动适配，不用手调。
    """
    r = max_ink_radius(tile)
    if r <= 0:
        return 0.75
    return max(MIN_MASK_SCALE, min(1.0, SAFE_RADIUS / r))


def maskable(tile, size, scale, cream):
    """满幅不透明：奶油底打满，内容按算好的比例居中。

    底衬用平色而不是「模糊的自身」—— 外圈要铺的面积不小，模糊底衬会把墨迹的灰带出来，
    在四周形成一圈脏晕。奶油底本来就是素色，平铺反而更干净。
    """
    canvas = Image.new('RGBA', (size, size), (*cream, 255))
    inner = int(size * scale)
    art = _resize(tile, inner).convert('RGBA')
    offset = (size - inner) // 2
    canvas.alpha_composite(art, (offset, offset))
    return canvas


def save_png(img, path, colors=128):
    """存储时量化到调色板。

    这张设计稿是「墨黑 + 做旧纸纹」，纸纹是高频噪声，直接存真彩 PNG 要 400 KB。
    量化到 128 色只要 ~85 KB，实测平均通道偏差 1.6/255（肉眼完全看不出）。
    PWA 图标会被 Service Worker 预加载，体积直接等于安装时的下载量，值得省这一刀。
    """
    out = img.quantize(colors=colors, method=Image.FASTOCTREE)
    out.save(path, 'PNG', optimize=True)


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main():
    os.makedirs(OUT, exist_ok=True)

    tile, cream = fill_corners(load_source())
    scale = mask_scale_for(tile)
    small = square(crop_to_content(tile))

    print(f'设计稿 -> {os.path.relpath(SRC, ROOT)}')
    print(f'内容框 {content_bbox(tile)} / {tile.size}  ⇒ maskable 缩放 {scale:.3f}')
    print(f'奶油底色 rgb{cream}')

    made = []

    def save(img, name):
        p = os.path.join(OUT, name)
        save_png(img, p)
        made.append((name, img.size, os.path.getsize(p)))

    for s in (192, 512):
        save(rounded(tile, s), f'icon-{s}.png')
    for s in (192, 512):
        save(maskable(tile, s, scale, cream), f'icon-maskable-{s}.png')
    save(maskable(tile, 180, 1.0, cream), 'apple-touch-icon.png')
    save(rounded(small, 32), 'favicon-32.png')

    ico = os.path.join(OUT, 'favicon.ico')
    rounded(small, 64).quantize(colors=64, method=Image.FASTOCTREE).save(
        ico, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)]
    )
    made.append(('favicon.ico', (64, 64), os.path.getsize(ico)))

    print('\n--- 产物 ---')
    for n, sz, b in made:
        print(f'{n:26s} {sz[0]:>4d}x{sz[1]:<4d} {b / 1024:>7.1f} KB')

    # ---- 断言：不靠肉眼 ----
    for n, sz, _ in made:
        if n.endswith('.ico'):
            continue
        im = Image.open(os.path.join(OUT, n)).convert('RGBA')
        assert im.size == sz, f'{n} 尺寸错误 {im.size} != {sz}'
        alpha_min = im.getextrema()[3][0]
        if n.startswith(('icon-maskable', 'apple-touch')):
            # 满幅不透明：iOS 会把透明区域合成成黑角，Android 的遮罩也会露出底板
            assert alpha_min == 255, f'{n} 应为全不透明，却存在透明像素'
        else:
            # 圆角版必须真的把角切掉，否则说明遮罩没生效
            assert alpha_min == 0, f'{n} 应有透明圆角，却全不透明'

    # 四角不能有黑：设计稿圆角之外原本是黑底，补角没补干净的话
    # 在 maskable / apple-touch 上会露出黑边，而肉眼在 512px 下几乎看不出来。
    for name in ('icon-maskable-512.png', 'apple-touch-icon.png'):
        im = Image.open(os.path.join(OUT, name)).convert('L')
        w, h = im.size
        step = max(1, w // 12)
        for x in range(0, w, step):
            for y in range(0, h, step):
                in_corner = (x < w * 0.12 or x > w * 0.88) and (y < h * 0.12 or y > h * 0.88)
                if in_corner:
                    assert im.getpixel((x, y)) > 150, f'{name} 的四角发黑（({x},{y}) 亮度 {im.getpixel((x,y))}）'

    print(f'\nOK: 尺寸 / 透明度 / 四角 断言全部通过（{len(made)} 个文件）')


if __name__ == '__main__':
    sys.exit(main())
