# -*- coding: utf-8 -*-
"""PWA 图标全套生成器（囚徒健身 · 六艺十式动作指导站）。

设计语义（与 public/favicon.svg 同一套符号）：
    方框 = 囚（囚徒）；框内递进阶梯 = 十式的进阶路径；顶端圆点 = 目标。
    底色用全站唯一的「行动」色相 accent 橙 —— 打开这个应用就是为了今天练什么。

产物（7 个文件，全部落在 public/icons/）：
    icon-192.png / icon-512.png                    圆角 + 四角透明，manifest purpose=any
    icon-maskable-192.png / icon-maskable-512.png  满幅底 + 主体缩到 78% 安全区
    apple-touch-icon.png                           180，满幅不透明（iOS 会把透明合成黑角）
    favicon-32.png                                 32，圆角透明
    favicon.ico                                    多尺寸 ICO

⚠️ maskable 不是把 any 版缩小了垫在一块底板上 —— 那样会得到「方中带方」的硬边
（底板的颜色和渐变的顶端亮度差得很远，边界一眼就看得见）。正确做法是**整体重绘**：
底色满幅铺开，只把「方框 + 阶梯 + 圆点」这一组标记缩到安全区再居中。
所以下面 draw_icon() 接受一个 mark_scale，尺寸与描边宽度一起缩放。

为什么 maskable 要另出一组：`purpose: any maskable` 会让 launcher 在已经画好的圆角上
**再套一层**遮罩，圆角设计会被裁坏。所以 any 版（圆角、四角透明）与 maskable 版
（满幅不透明、主体缩到安全区）必须分开。

重跑方式（只有 default venv 装了 Pillow）：
    "C:/Users/Zupeng Lin/.workbuddy/binaries/python/envs/default/Scripts/python.exe" scripts/gen-icons.py

⚠️ 改完图标必须把 manifest.json / index.html 里的 `?v=` 全部 +1，否则浏览器缓存、
    SW 预缓存、系统 launcher 任何一层都可能继续用旧图。
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

# ============================== 设计参数 ==============================

SIZE = 4096          # 绘制画布（最后降到 SOURCE_SIZE，等于 4x 超采样）
SOURCE_SIZE = 1024   # 源图边长（≥1024 才够 512 图标用）
RADIUS_RATIO = 0.19  # 圆角比例

# 底色：品牌 accent 橙的纵向渐变（上亮下深，给一点体积感）
BG_TOP = (226, 98, 31)      # #E2621F
BG_BOTTOM = (166, 52, 9)    # #A63409

MARK = (255, 244, 232)      # #FFF4E8 暖白（对底色 4.9:1）
CAGE_ALPHA = 0.52           # 方框（囚）的透明度 —— 比阶梯弱，不抢主体

SS = 4               # 圆角遮罩超采样倍率
SAFE_INSET = 0.78    # maskable 主体缩放比（Android 安全圆直径为 80%）

# ====================================================================

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, 'icon-design')
SRC = os.path.join(SRC_DIR, 'source-app-icon.png')
OUT = os.path.join(ROOT, 'public', 'icons')


# ---------------------------------------------------------------------------
# 源图绘制
# ---------------------------------------------------------------------------
def _gradient(size, top, bottom):
    """纵向线性渐变（1px 宽的列再横向放大，比逐像素快得多）。"""
    col = Image.new('RGB', (1, size))
    for y in range(size):
        t = y / max(size - 1, 1)
        col.putpixel((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return col.resize((size, size), Image.BILINEAR)


def _soft_light(size, cx, cy, r, peak):
    """顶部柔光：让纯渐变不至于太平。"""
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=peak)
    return mask.filter(ImageFilter.GaussianBlur(size * 0.14))


def draw_icon(size, mark_scale=1.0, cage=True, steps=4, stroke=0.045):
    """画一张满幅（无透明角）的方形图标。

    `mark_scale` 只缩放「方框 + 阶梯 + 圆点」这一组标记（**含描边宽度**，一起围绕中心缩），
    底色与顶部柔光永远满幅 —— 所以 maskable 版是「同一张图，标记变小」，
    而不是「小图贴在底板上」，不会出现方中带方的硬边。

    两处只给小尺寸用的特化（大图标一律走默认值，保持符号一致）：
    - `cage=False` 去掉外层方框：32px 上那圈细描边只剩不到 1px，看不清还挤占阶梯；
    - `steps=3` + 加粗 `stroke`：四级台阶在 32px 上每级只有 3px 出头，抗锯齿后糊成一条波浪。

    u 为边长比例；`px()` 负责旋钮 → 像素，`s()` 负责把标记坐标按 mark_scale 拉向中心。
    """
    def px(u):
        return u * size

    def s(u):
        return 0.5 + (u - 0.5) * mark_scale

    img = _gradient(size, BG_TOP, BG_BOTTOM).convert('RGBA')

    # 顶部柔光
    glow = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    glow.putalpha(_soft_light(size, px(0.5), px(0.16), px(0.52), 46))
    img.alpha_composite(glow)

    # ⚠️ 标记必须画在**独立图层**上，最后整体 alpha_composite 到底图上。
    # 直接用 `ImageDraw.Draw(img, 'RGBA')` 往不透明底上画会连底图的 alpha 一起拉低
    # （画完那圈半透明方框，整张图的 alpha 最小值会掉到 121）—— 图看着完全正常，
    # 只有 maskable / apple-touch 要求的「满幅不透明」断言会炸。
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, 'RGBA')

    # ① 方框「囚」—— 细一档、半透明，只作围合，不与阶梯争视觉重量
    if cage:
        cage_a, cage_b = px(s(0.175)), px(s(0.825))
        draw.rounded_rectangle(
            [cage_a, cage_a, cage_b, cage_b],
            radius=round(px(0.105 * mark_scale)),
            outline=(*MARK, int(255 * CAGE_ALPHA)),
            width=round(px(0.028 * mark_scale)),
        )

    # ② 递进阶梯 —— 主体，最粗最亮
    x0, x1 = 0.265, 0.735
    y0, y1 = 0.700, 0.300
    xs = [x0 + (x1 - x0) * i / steps for i in range(steps + 1)]
    ys = [y0 + (y1 - y0) * i / steps for i in range(steps + 1)]
    pts = []
    for i, (x, y) in enumerate(zip(xs, ys)):
        if i == 0:
            pts.append((px(s(x)), px(s(y))))
        else:
            pts.append((px(s(x)), px(s(ys[i - 1]))))  # 先竖直上升
            pts.append((px(s(x)), px(s(y))))          # 再水平前进
    step_w = max(1, round(px(stroke * mark_scale)))
    draw.line(pts, fill=(*MARK, 255), width=step_w, joint='curve')
    # 圆头端点（Pillow 的 line 不画 round cap，两端各补一枚圆点）
    r = step_w / 2
    for p in (pts[0], pts[-1]):
        draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=(*MARK, 255))

    # ③ 顶端圆点 —— 目标
    dot = px(0.062 * mark_scale)
    cx, cy = px(s(xs[-1])), px(s(ys[-1]))
    draw.ellipse([cx - dot, cy - dot, cx + dot, cy + dot], fill=(*MARK, 255))

    img.alpha_composite(layer)
    return img


# ---------------------------------------------------------------------------
# 图标派生
# ---------------------------------------------------------------------------
def _resize(img, size):
    return img.resize((size, size), Image.LANCZOS)


def rounded(img, size):
    """圆角 + 四角透明 → manifest purpose=any / favicon。"""
    big = _resize(img, size * SS)
    mask = Image.new('L', (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size * SS - 1, size * SS - 1],
        radius=int(size * SS * RADIUS_RATIO),
        fill=255,
    )
    out = Image.new('RGBA', (size * SS, size * SS), (0, 0, 0, 0))
    out.paste(big, (0, 0), mask)
    return _resize(out, size)


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main():
    for d in (SRC_DIR, OUT):
        os.makedirs(d, exist_ok=True)

    # 只渲染三次：常规 / 缩到 maskable 安全区 / 32px 专用（去方框 + 放大阶梯）
    base = draw_icon(SIZE)
    safe = draw_icon(SIZE, SAFE_INSET)
    small = draw_icon(SIZE, 1.20, cage=False, steps=3, stroke=0.075)

    src = _resize(base, SOURCE_SIZE)
    src.save(SRC, 'PNG', optimize=True)
    print(f'源图 -> {os.path.relpath(SRC, ROOT)}  {src.size}  {os.path.getsize(SRC) / 1024:.1f} KB')

    made = []

    def save(img, name):
        p = os.path.join(OUT, name)
        img.save(p, 'PNG', optimize=True)
        made.append((name, img.size, os.path.getsize(p)))

    for s in (192, 512):
        save(rounded(base, s), f'icon-{s}.png')
    for s in (192, 512):
        save(_resize(safe, s), f'icon-maskable-{s}.png')
    save(_resize(base, 180), 'apple-touch-icon.png')
    save(rounded(small, 32), 'favicon-32.png')

    ico = os.path.join(OUT, 'favicon.ico')
    rounded(small, 64).save(ico, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    made.append(('favicon.ico', (64, 64), os.path.getsize(ico)))

    print('\n--- 产物 ---')
    for n, sz, b in made:
        print(f'{n:26s} {sz[0]:>4d}x{sz[1]:<4d} {b / 1024:>7.1f} KB')

    # 断言：尺寸 + 透明度（不靠肉眼判断）
    for n, sz, _ in made:
        if n.endswith('.ico'):
            continue
        im = Image.open(os.path.join(OUT, n)).convert('RGBA')
        assert im.size == sz, f'{n} 尺寸错误 {im.size} != {sz}'
        alpha_min = im.getextrema()[3][0]
        if n.startswith(('icon-maskable', 'apple-touch')):
            assert alpha_min == 255, f'{n} 应为全不透明，却存在透明像素'
        else:
            assert alpha_min == 0, f'{n} 应有透明圆角，却全不透明'

    print(f'\nOK: 尺寸与透明度断言全部通过（{len(made)} 个文件）')


if __name__ == '__main__':
    sys.exit(main())
