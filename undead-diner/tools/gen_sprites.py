#!/usr/bin/env python3
"""Undead Diner sprite generator — STATE-based animated sheets.

Characters are composed from separately-transformed parts (legs on the base,
torso+arms on a rotated layer, head on its own rotated layer) so frames get
real motion: head bob, torso rotation, alternating legs, arm swing, squash.
64x64 frames, feet anchored. All original art.
"""
import os, math, random
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'public', 'assets', 'sprites')
UI = os.path.join(ROOT, 'public', 'assets', 'ui')
os.makedirs(SPR, exist_ok=True); os.makedirs(UI, exist_ok=True)

F = 64; SS = 3; FS = F * SS
OUT = (35, 26, 48, 255)
cx = 32 * SS
footY = 58 * SS; hipY = 36 * SS; bodyTop = 20 * SS; shoulderY = 24 * SS
headCY = 12 * SS; headR = 13 * SS; bodyHW = 11 * SS; ow = 3 * SS

def dk(c, f=0.72): return (int(c[0]*f), int(c[1]*f), int(c[2]*f), 255)
def lt(c, f=1.2): return (min(255,int(c[0]*f)), min(255,int(c[1]*f)), min(255,int(c[2]*f)), 255)

def tline(d, p0, p1, color, w):
    d.line([p0, p1], fill=OUT, width=w + 4 * SS); d.line([p0, p1], fill=color, width=w)

def legs(d, pal, po):
    pant = (52, 64, 86, 255); shoe = (40, 32, 48, 255)
    if po.get('sit'):
        for s in (-1, 1):
            hx = cx + s * 7 * SS
            tline(d, (hx, hipY - 4 * SS), (hx + s * 4 * SS, hipY + 8 * SS), pant, 7 * SS)
            tline(d, (hx + s * 4 * SS, hipY + 8 * SS), (hx + s * 9 * SS, hipY + 6 * SS), pant, 7 * SS)
        return
    ll = po.get('lleg', (0, 0)); rl = po.get('rleg', (0, 0))
    for s, off in ((-1, ll), (1, rl)):
        hx = cx + s * 6 * SS
        fx = hx + off[0] * SS; fy = footY + off[1] * SS
        tline(d, (hx, hipY), (fx, fy), pant, 8 * SS)
        d.ellipse([fx - 6 * SS, fy - 4 * SS, fx + 7 * SS, fy + 4 * SS], fill=shoe, outline=OUT, width=2 * SS)

def torso(d, pal, po):
    bob = po.get('bob', 0) * SS
    bt = bodyTop * SS - bob if False else bodyTop - bob
    shirt = pal['shirt']
    hy = hipY - bob
    # arms behind
    sl = (cx - bodyHW, shoulderY - bob); sr = (cx + bodyHW, shoulderY - bob)
    armLen = 15 * SS
    if po.get('carry'):
        hxL = cx - 9 * SS; hxR = cx + 9 * SS; hYY = hy - 14 * SS
        tline(d, sl, (hxL, hYY), dk(shirt), 7 * SS)
        tline(d, sr, (hxR, hYY), dk(shirt), 7 * SS)
    else:
        la = math.radians(po.get('larm', 6)); ra = math.radians(po.get('rarm', -6))
        hL = (sl[0] + math.sin(la) * armLen, sl[1] + math.cos(la) * armLen)
        hR = (sr[0] + math.sin(ra) * armLen, sr[1] + math.cos(ra) * armLen)
        tline(d, sl, hL, dk(shirt), 7 * SS)
        tline(d, sr, hR, dk(shirt), 7 * SS)
    # body
    sqy = po.get('sqy', 1.0)
    btop = bodyTop - bob - int((1 - sqy) * 6 * SS)
    d.rounded_rectangle([cx - bodyHW, btop, cx + bodyHW, hy + 2 * SS], 11 * SS, fill=shirt, outline=OUT, width=ow)
    d.ellipse([cx - 8 * SS, btop + 4 * SS, cx + 2 * SS, btop + 16 * SS], fill=lt(shirt, 1.12))
    # carried plate
    if po.get('carry'):
        py = hy - 16 * SS
        d.ellipse([cx - 12 * SS, py - 5 * SS, cx + 12 * SS, py + 6 * SS], fill=(250, 252, 254, 255), outline=(205, 210, 214, 255), width=2 * SS)
        d.ellipse([cx - 6 * SS, py - 4 * SS, cx + 6 * SS, py + 2 * SS], fill=(181, 101, 29, 255))

def head(d, pal, po):
    bob = (po.get('bob', 0) + po.get('headbob', 0)) * SS
    skin = pal['skin']; hair = pal['hair']; z = pal.get('zombie')
    hcy = headCY * SS - bob if False else headCY - bob
    d.ellipse([cx - headR, hcy - headR, cx + headR, hcy + headR], fill=skin, outline=OUT, width=ow)
    d.ellipse([cx - 9 * SS, hcy - 9 * SS, cx + 0 * SS, hcy - 1 * SS], fill=lt(skin, 1.1))
    d.pieslice([cx - headR, hcy - headR - 2 * SS, cx + headR, hcy + 2 * SS], 180, 360, fill=hair, outline=OUT, width=ow)
    eyes = po.get('eyes', 'normal'); ey = hcy - 2 * SS
    def eye(exc, half=False, ang=False, xx=False):
        if xx:
            d.line([exc - 4 * SS, ey - 4 * SS, exc + 4 * SS, ey + 4 * SS], fill=OUT, width=2 * SS)
            d.line([exc - 4 * SS, ey + 4 * SS, exc + 4 * SS, ey - 4 * SS], fill=OUT, width=2 * SS); return
        if z:
            d.ellipse([exc - 5 * SS, ey - 5 * SS, exc + 5 * SS, ey + 5 * SS], fill=(255, 255, 255, 255), outline=OUT, width=2 * SS)
            if not half: d.ellipse([exc - 2 * SS, ey - 2 * SS, exc + 2 * SS, ey + 2 * SS], fill=(192, 57, 43, 255))
            else: d.line([exc - 4 * SS, ey, exc + 4 * SS, ey], fill=OUT, width=2 * SS)
        else:
            if half: d.line([exc - 3 * SS, ey, exc + 3 * SS, ey], fill=OUT, width=2 * SS)
            else: d.ellipse([exc - 3 * SS, ey - 3 * SS, exc + 3 * SS, ey + 3 * SS], fill=OUT)
        if ang:
            d.line([exc - 6 * SS, ey - 8 * SS, exc + 4 * SS, ey - 5 * SS], fill=OUT, width=2 * SS)
    half = eyes in ('tired', 'half'); xx = eyes == 'x'; ang = eyes == 'angry'
    eye(cx - 6 * SS, half, ang, xx); eye(cx + 6 * SS, half, ang, xx)
    if ang:  # mirror brow
        d.line([cx + 6 * SS - 4 * SS, ey - 5 * SS, cx + 6 * SS + 6 * SS, ey - 8 * SS], fill=OUT, width=2 * SS)
    # mouth
    my = hcy + 7 * SS; mouth = po.get('mouth', 'z' if z else 'smile')
    if z:
        d.line([cx - 8 * SS, my, cx + 8 * SS, my], fill=OUT, width=3 * SS)
        for i in range(-2, 3): d.line([cx + i * 4 * SS, my - 4 * SS, cx + i * 4 * SS, my + 4 * SS], fill=OUT, width=2 * SS)
        if mouth == 'open': d.ellipse([cx - 6 * SS, my - 2 * SS, cx + 6 * SS, my + 9 * SS], fill=(90, 20, 20, 255))
    else:
        if mouth == 'open': d.ellipse([cx - 6 * SS, my - 3 * SS, cx + 6 * SS, my + 7 * SS], fill=(150, 70, 60, 255))
        elif mouth == 'frown': d.arc([cx - 8 * SS, my, cx + 8 * SS, my + 14 * SS], 200, 340, fill=(150, 70, 60, 255), width=3 * SS)
        elif mouth == 'big': d.chord([cx - 9 * SS, my - 6 * SS, cx + 9 * SS, my + 10 * SS], 0, 180, fill=(150, 70, 60, 255), outline=OUT, width=2 * SS)
        else: d.arc([cx - 8 * SS, my - 6 * SS, cx + 8 * SS, my + 8 * SS], 20, 160, fill=(150, 70, 60, 255), width=3 * SS)

def render(pal, po):
    base = Image.new('RGBA', (FS, FS), (0, 0, 0, 0))
    legs(ImageDraw.Draw(base), pal, po)
    up = Image.new('RGBA', (FS, FS), (0, 0, 0, 0)); torso(ImageDraw.Draw(up), pal, po)
    rot = po.get('rot', 0)
    if rot: up = up.rotate(rot, resample=Image.BICUBIC, center=(cx, hipY - po.get('bob', 0)))
    base = Image.alpha_composite(base, up)
    hd = Image.new('RGBA', (FS, FS), (0, 0, 0, 0)); head(ImageDraw.Draw(hd), pal, po)
    hr = po.get('headrot', 0)
    if hr: hd = hd.rotate(hr, resample=Image.BICUBIC, center=(cx, (headCY + 8) - po.get('bob', 0) - po.get('headbob', 0)))
    base = Image.alpha_composite(base, hd)
    return base.resize((F, F), Image.LANCZOS)

def sheet(name, pal, poses):
    img = Image.new('RGBA', (F * len(poses), F), (0, 0, 0, 0))
    for i, po in enumerate(poses): img.paste(render(pal, po), (i * F, 0))
    img.save(os.path.join(SPR, name)); print('  ' + name + ' (' + str(len(poses)) + 'f)')

# --------------------------- pose libraries ------------------------------
def walk(n=8, carry=False, gentle=False, mouth=None, eyes='normal'):
    amp = 3 if gentle else 5; out = []
    for k in range(n):
        a = 2 * math.pi * k / n; s = math.sin(a)
        out.append(dict(lleg=(s * 7, -max(0, s) * 6), rleg=(-s * 7, -max(0, -s) * 6),
                        larm=-s * 34, rarm=s * 34, bob=abs(s) * amp - amp / 2,
                        rot=s * 3.5, headrot=s * 2.5, headbob=-abs(s) * 2, carry=carry, mouth=mouth, eyes=eyes))
    return out

def idle(n=4, eyes='normal', mouth=None):
    base = [dict(bob=0, larm=7, rarm=-7), dict(bob=2, rot=1.5, headbob=1, headrot=1.5, larm=11, rarm=-3),
            dict(bob=0, larm=7, rarm=-7), dict(bob=2, rot=-1.5, headbob=1, headrot=-1.5, larm=3, rarm=-11)]
    for b in base: b['eyes'] = ('half' if (eyes == 'blink' and base.index(b) == 2) else (eyes if eyes != 'blink' else 'normal')); b['mouth'] = mouth
    return base[:n]

def cook(n=6):
    out = []
    for k in range(n):
        s = math.sin(2 * math.pi * k / n)
        out.append(dict(carry=False, larm=-58 + s * 18, rarm=-58 - s * 18, bob=abs(s) * 2, rot=5, headbob=-abs(s) * 2, mouth='open' if s > 0.5 else None))
    return out

def clean(n=6):
    out = []
    for k in range(n):
        s = math.sin(2 * math.pi * k / n)
        out.append(dict(larm=-80 - s * 30, rarm=-10, bob=1, rot=s * 6, headrot=s * 4))
    return out

def carry(n=6): return walk(n, carry=True, gentle=True)

def infect(n=6):
    keys = [dict(larm=20, rarm=-20, bob=-2, rot=0, eyes='normal'),
            dict(larm=-30, rarm=30, bob=2, rot=-3),
            dict(larm=-120, rarm=120, bob=4, rot=0, headrot=0, eyes='angry'),
            dict(larm=-150, rarm=150, bob=6, rot=0, mouth='open', eyes='angry'),
            dict(larm=-90, rarm=90, bob=2, rot=4, mouth='open'),
            dict(larm=-30, rarm=30, bob=0, rot=2)]
    return keys[:n]

def celebrate(n=4):
    return [dict(larm=-150, rarm=150, bob=-4, mouth='big', eyes='normal'),
            dict(larm=-160, rarm=160, bob=6, mouth='big', headbob=-2),
            dict(larm=-150, rarm=150, bob=-4, mouth='big'),
            dict(larm=-160, rarm=160, bob=6, mouth='big', headbob=-2)][:n]

def tired(n=4):
    return [dict(rot=9, sqy=0.92, bob=0, larm=12, rarm=-12, eyes='tired', headrot=6),
            dict(rot=10, sqy=0.9, bob=1, larm=14, rarm=-10, eyes='tired', headrot=7),
            dict(rot=9, sqy=0.92, bob=0, larm=12, rarm=-12, eyes='tired', headrot=6),
            dict(rot=8, sqy=0.93, bob=1, larm=10, rarm=-14, eyes='half', headrot=5)][:n]

def sit(n=4, eyes='normal', mouth=None):
    return [dict(sit=True, bob=0, headrot=2, larm=18, rarm=-18, eyes=eyes, mouth=mouth),
            dict(sit=True, bob=1, headrot=-2, larm=16, rarm=-20, eyes=eyes, mouth=mouth),
            dict(sit=True, bob=0, headrot=3, larm=18, rarm=-16, eyes=eyes, mouth=mouth),
            dict(sit=True, bob=1, headrot=-3, larm=20, rarm=-18, eyes=eyes, mouth=mouth)][:n]

def eat(n=6):
    out = []
    for k in range(n):
        s = math.sin(2 * math.pi * k / n)
        out.append(dict(sit=True, bob=0, larm=-70 if s > 0 else 18, rarm=-18, headbob=-abs(s) * 2,
                        mouth='open' if s > 0 else 'smile'))
    return out

def angry(n=6):
    out = []
    for k in range(n):
        s = math.sin(2 * math.pi * k / (n / 2))
        out.append(dict(sit=True, rot=s * 7, headrot=s * 6, larm=-40, rarm=-40, bob=abs(s) * 2,
                        eyes='angry', mouth='frown' if k % 2 == 0 else 'open'))
    return out

# ------------------------------ generate ---------------------------------
print('zombie states')
Z = dict(skin=(122, 199, 79), shirt=(74, 107, 138), hair=(54, 90, 42), zombie=True)
sheet('zombie_idle.png', Z, idle(4, eyes='blink'))
sheet('zombie_walk.png', Z, walk(8))
sheet('zombie_carry.png', Z, carry(6))
sheet('zombie_cook.png', Z, cook(6))
sheet('zombie_clean.png', Z, clean(6))
sheet('zombie_infect.png', Z, infect(6))
sheet('zombie_celebrate.png', Z, celebrate(4))
sheet('zombie_tired.png', Z, tired(4))

print('customer states')
PALS = [dict(skin=(241, 194, 125), shirt=(231, 76, 60), hair=(58, 42, 26)),
        dict(skin=(224, 172, 105), shirt=(52, 152, 219), hair=(26, 26, 26)),
        dict(skin=(255, 219, 172), shirt=(155, 89, 182), hair=(181, 101, 29))]
for i, p in enumerate(PALS):
    sheet(f'cust{i}_idle.png', p, idle(4, eyes='blink', mouth='smile'))
    sheet(f'cust{i}_walk.png', p, walk(8, mouth='smile'))
    sheet(f'cust{i}_sit.png', p, sit(4, mouth='smile'))
    sheet(f'cust{i}_eat.png', p, eat(6))
    sheet(f'cust{i}_angry.png', p, angry(6))
    sheet(f'cust{i}_leave.png', p, walk(8, mouth='frown'))

# ------------------------------ furniture + fx ---------------------------
print('furniture + fx')
def newframe(w, h):
    im = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0)); return im, ImageDraw.Draw(im)
def fin(im, w, h, name, folder=SPR): im.resize((w, h), Image.LANCZOS).save(os.path.join(folder, name)); print('  ' + name)
def speckle(d, box, color, n, seed):
    rnd = random.Random(seed)
    for _ in range(n):
        x = rnd.randint(int(box[0]), int(box[2])); y = rnd.randint(int(box[1]), int(box[3])); r = rnd.randint(SS, 2 * SS)
        d.ellipse([x, y, x + r, y + r], fill=color)
def isobox(d, cxx, by, hw, hh, h, top, left, right):
    cxx *= SS; by *= SS; hw *= SS; hh *= SS; h *= SS; ty = by - h
    d.polygon([(cxx-hw,ty),(cxx,ty+hh),(cxx,by),(cxx-hw,by-hh)], fill=left, outline=OUT)
    d.polygon([(cxx+hw,ty),(cxx,ty+hh),(cxx,by),(cxx+hw,by-hh)], fill=right, outline=OUT)
    d.polygon([(cxx,ty-hh),(cxx+hw,ty),(cxx,ty+hh),(cxx-hw,ty)], fill=top, outline=OUT)

for dirty in (False, True):
    W, H = 140, 116; im, d = newframe(W, H); cxx = W/2*SS; ty = (94-22)*SS; hw, hh = 56*SS, 28*SS
    d.line([(cxx-44*SS,(94-6)*SS),(cxx-44*SS,(94+8)*SS)], fill=(60,60,70,255), width=7*SS)
    d.line([(cxx+44*SS,(94-6)*SS),(cxx+44*SS,(94+8)*SS)], fill=(60,60,70,255), width=7*SS)
    d.polygon([(cxx,ty-hh),(cxx+hw,ty),(cxx,ty+hh),(cxx-hw,ty)], fill=(210,59,46,255), outline=OUT)
    for i in range(-2,3):
        d.line([(cxx-hw+i*18*SS,ty+i*9*SS-hh),(cxx+hw+i*18*SS,ty+i*9*SS+hh)], fill=(255,255,255,150), width=3*SS)
        d.line([(cxx+i*18*SS-hw,ty-i*9*SS+hh),(cxx+i*18*SS+hw,ty-i*9*SS-hh)], fill=(255,255,255,150), width=3*SS)
    d.ellipse([cxx-36*SS,ty-20*SS,cxx+36*SS,ty+20*SS], fill=(250,252,254,255), outline=(205,210,214,255), width=3*SS)
    if dirty:
        d.ellipse([cxx-14*SS,ty-8*SS,cxx+2*SS,ty+4*SS], fill=(138,122,58,255))
        speckle(d,[cxx-30*SS,ty-14*SS,cxx+30*SS,ty+14*SS],(90,120,60,180),8,3)
    fin(im, W, H, 'table_dirty.png' if dirty else 'table_clean.png')

for key, top, left, right, burner in [('stove',(154,164,173),(108,117,125),(130,140,149),(230,126,34)),('grill',(109,81,69),(62,39,35),(78,52,46),(192,57,43)),('oven',(201,138,58),(126,74,22),(156,94,34),(241,196,15))]:
    W,H=140,150; im,d=newframe(W,H); isobox(d,W/2,130,44,22,56,top+(255,),dk(top+(255,),0.6),dk(top+(255,),0.8))
    cxx=W/2*SS; byy=(130-58)*SS
    d.ellipse([cxx-44*SS,byy-12*SS,cxx-8*SS,byy+12*SS], fill=burner+(255,), outline=OUT, width=3*SS)
    d.ellipse([cxx+8*SS,byy-8*SS,cxx+44*SS,byy+16*SS], fill=burner+(255,), outline=OUT, width=3*SS)
    speckle(d,[cxx-50*SS,byy+20*SS,cxx+50*SS,byy+90*SS],(0,0,0,90),16,9)
    fin(im,W,H,key+'.png')

W,H=140,120; im,d=newframe(W,H); isobox(d,W/2,104,44,22,30,(229,216,166,255),(154,132,86,255),(196,171,120,255))
cxx=W/2*SS; ty=(104-30)*SS
d.ellipse([cxx-46*SS,ty-2*SS,cxx-12*SS,ty+18*SS], fill=(250,252,254,255), outline=(205,210,214,255), width=3*SS)
d.ellipse([cxx+10*SS,ty-2*SS,cxx+44*SS,ty+18*SS], fill=(250,252,254,255), outline=(205,210,214,255), width=3*SS)
fin(im,W,H,'counter.png')

W,H=64,72; im,d=newframe(W,H); isobox(d,W/2,52,16,8,12,(156,107,58,255),(91,58,28,255),(122,79,38,255))
d.rounded_rectangle([(W/2*SS-22),(52-34)*SS,(W/2*SS-10),(52-10)*SS],4*SS,fill=(122,79,38,255),outline=OUT,width=4*SS); fin(im,W,H,'chair.png')
W,H=72,96; im,d=newframe(W,H); isobox(d,W/2,76,16,8,14,(122,82,48,255),(79,51,32,255),(94,63,39,255))
cxx=W/2*SS; d.ellipse([cxx-40*SS,0,cxx+40*SS,62*SS], fill=(46,139,61,255), outline=OUT, width=4*SS)
d.ellipse([cxx-14*SS,10*SS,cxx+6*SS,30*SS], fill=(63,174,83,255)); fin(im,W,H,'plant.png')
W,H=56,84; im,d=newframe(W,H); cxx=W/2*SS
d.line([(cxx,80*SS),(cxx,36*SS)], fill=(42,34,48,255), width=6*SS)
d.polygon([(cxx-22*SS,36*SS),(cxx+22*SS,36*SS),(cxx,12*SS)], fill=(255,210,74,255), outline=OUT); fin(im,W,H,'lamp.png')

W,H=32,32; im,d=newframe(W,H); d.ellipse([4*SS,4*SS,28*SS,28*SS], fill=(255,210,74,255), outline=(138,96,32,255), width=3*SS); d.ellipse([8*SS,8*SS,16*SS,16*SS], fill=(255,231,154,255)); fin(im,W,H,'coin.png')
W,H=48,28; im,d=newframe(W,H); d.ellipse([2*SS,6*SS,46*SS,26*SS], fill=(250,252,254,255), outline=(205,210,214,255), width=3*SS); d.ellipse([14*SS,8*SS,34*SS,18*SS], fill=(181,101,29,255)); fin(im,W,H,'plate_food.png')

fw,fh=64,64; sh=Image.new('RGBA',(fw*4,fh),(0,0,0,0))
for k in range(4):
    im,d=newframe(fw,fh); r=(10+k*10)*SS; cxx=fw/2*SS; cyy=fh/2*SS; a=int(230-k*40)
    for off in [(-12,-6),(10,-4),(0,8),(0,0)]: d.ellipse([cxx+off[0]*SS-r,cyy+off[1]*SS-r,cxx+off[0]*SS+r,cyy+off[1]*SS+r], fill=(122,199,79,a))
    sh.paste(im.resize((fw,fh),Image.LANCZOS),(k*fw,0))
sh.save(os.path.join(SPR,'infection_smoke.png')); print('  infection_smoke.png')

fw,fh=40,64; sh=Image.new('RGBA',(fw*4,fh),(0,0,0,0))
for k in range(4):
    im,d=newframe(fw,fh)
    for j in range(3):
        yy=(54-j*16-k*4); a=int(150-j*40); rad=(6+j*2)*SS; cxx=(fw/2+(j%2*6-3))*SS
        d.ellipse([cxx-rad,yy*SS-rad,cxx+rad,yy*SS+rad], fill=(255,255,255,a))
    sh.paste(im.resize((fw,fh),Image.LANCZOS),(k*fw,0))
sh.save(os.path.join(SPR,'steam.png')); print('  steam.png')

fw,fh=24,24; sh=Image.new('RGBA',(fw*2,fh),(0,0,0,0))
for k in range(2):
    im,d=newframe(fw,fh); cxx=fw/2*SS; cyy=fh/2*SS; d.ellipse([cxx-3*SS,cyy-3*SS,cxx+3*SS,cyy+3*SS], fill=(20,20,20,255))
    w=8*SS if k==0 else 5*SS
    d.ellipse([cxx-3*SS-w,cyy-5*SS,cxx-3*SS,cyy], fill=(120,120,130,180)); d.ellipse([cxx+3*SS,cyy-5*SS,cxx+3*SS+w,cyy], fill=(120,120,130,180))
    sh.paste(im.resize((fw,fh),Image.LANCZOS),(k*fw,0))
sh.save(os.path.join(SPR,'fly.png')); print('  fly.png')

for name,col in [('stain',(90,70,40,150)),('slime',(122,199,79,150))]:
    W,H=64,36; im,d=newframe(W,H); cxx,cyy=W/2*SS,H/2*SS
    d.ellipse([cxx-26*SS,cyy-12*SS,cxx+26*SS,cyy+12*SS], fill=col); speckle(d,[cxx-24*SS,cyy-10*SS,cxx+24*SS,cyy+10*SS],dk(col,0.7),10,5)
    fin(im,W,H,name+'.png')
W,H=64,36; im,d=newframe(W,H); cxx,cyy=W/2*SS,H/2*SS
d.line([(cxx-18*SS,cyy-6*SS),(cxx,cyy),(cxx+8*SS,cyy-8*SS),(cxx+20*SS,cyy+6*SS)], fill=(0,0,0,120), width=2*SS); fin(im,W,H,'crack.png')

W,H=96,48; sh=Image.new('RGBA',(W*3,H),(0,0,0,0))
for i,c in enumerate([(233,169,63),(108,191,63),(155,99,214)]):
    im=Image.new('RGBA',(W*SS,H*SS),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([4*SS,4*SS,(W-4)*SS,(H-4)*SS],12*SS,fill=c+(255,),outline=dk(c+(255,),0.6),width=4*SS)
    sh.paste(im.resize((W,H),Image.LANCZOS),(i*W,0))
sh.save(os.path.join(UI,'ui_buttons.png')); print('  ui/ui_buttons.png')
print('done')
