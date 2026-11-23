"""Builds the MiniTag project book (A4 PDF) with ReportLab."""
import os
import sys

from reportlab.graphics.shapes import Circle, Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
from reportlab.platypus import (
    BaseDocTemplate, CondPageBreak, Frame, Image, KeepTogether, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle,
)

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = sys.argv[1]  # node_modules/@expo-google-fonts
OUT = sys.argv[2]

# ---- fonts ------------------------------------------------------------------------
reg = lambda name, path: pdfmetrics.registerFont(TTFont(name, path))
reg('Fraunces', f'{FONTS}/fraunces/600SemiBold/Fraunces_600SemiBold.ttf')
reg('Fraunces-Medium', f'{FONTS}/fraunces/500Medium/Fraunces_500Medium.ttf')
reg('Fraunces-Italic', f'{FONTS}/fraunces/400Regular_Italic/Fraunces_400Regular_Italic.ttf')
reg('Inter', f'{FONTS}/inter/400Regular/Inter_400Regular.ttf')
reg('Inter-Italic', f'{FONTS}/inter/400Regular_Italic/Inter_400Regular_Italic.ttf')
reg('Inter-SemiBold', f'{FONTS}/inter/600SemiBold/Inter_600SemiBold.ttf')
reg('Inter-Bold', f'{FONTS}/inter/700Bold/Inter_700Bold.ttf')
reg('Mono', '/System/Library/Fonts/Supplemental/Andale Mono.ttf')
addMapping('Inter', 0, 0, 'Inter')
addMapping('Inter', 1, 0, 'Inter-SemiBold')
addMapping('Inter', 0, 1, 'Inter-Italic')
addMapping('Inter', 1, 1, 'Inter-SemiBold')

# ---- palette (the app's Burgundy theme) ----------------------------------------
WINE = colors.HexColor('#8E2F44')
DEEP = colors.HexColor('#6B1F2E')
CHAMP = colors.HexColor('#EBD3AE')
GROUND = colors.HexColor('#F8F3F1')
INK = colors.HexColor('#2A1418')
MUTED = colors.HexColor('#6E5A5E')
BLUSH = colors.HexColor('#F2E3E2')
BORDER = colors.HexColor('#E8DCD9')
SAGE = colors.HexColor('#3E7B5C')
SAGEBG = colors.HexColor('#E3EEE7')
ROSE = colors.HexColor('#F2D9D9')
WHITE = colors.white

W, H = A4
MARGIN = 2 * cm

# ---- styles -----------------------------------------------------------------------
S = {}
S['body'] = ParagraphStyle('body', fontName='Inter', fontSize=10.2, leading=15.3, textColor=INK, spaceAfter=7)
S['lead'] = ParagraphStyle('lead', parent=S['body'], fontName='Fraunces-Italic', fontSize=12.5, leading=18, textColor=DEEP, spaceAfter=10)
S['h2'] = ParagraphStyle('h2', fontName='Fraunces', fontSize=15, leading=19, textColor=WINE, spaceBefore=12, spaceAfter=6)
S['h3'] = ParagraphStyle('h3', fontName='Inter-SemiBold', fontSize=10.8, leading=14, textColor=INK, spaceBefore=8, spaceAfter=3)
S['small'] = ParagraphStyle('small', parent=S['body'], fontSize=8.6, leading=12, textColor=MUTED, spaceAfter=4)
S['cap'] = ParagraphStyle('cap', parent=S['small'], alignment=TA_CENTER, fontName='Inter-Italic')
S['cell'] = ParagraphStyle('cell', fontName='Inter', fontSize=8.8, leading=12, textColor=INK)
S['cellb'] = ParagraphStyle('cellb', parent=S['cell'], fontName='Inter-SemiBold')
S['cellh'] = ParagraphStyle('cellh', parent=S['cell'], fontName='Inter-SemiBold', textColor=WHITE)
S['bullet'] = ParagraphStyle('bullet', parent=S['body'], leftIndent=14, bulletIndent=3, spaceAfter=3)
S['boxtitle'] = ParagraphStyle('boxtitle', fontName='Inter-Bold', fontSize=8.2, leading=11, textColor=WINE, spaceAfter=3)
S['boxbody'] = ParagraphStyle('boxbody', parent=S['body'], fontSize=9.6, leading=14, spaceAfter=2)
S['code'] = ParagraphStyle('code', fontName='Mono', fontSize=8.1, leading=11.2, textColor=INK)
S['q'] = ParagraphStyle('q', parent=S['body'], fontName='Inter-SemiBold', textColor=WINE, spaceBefore=6, spaceAfter=2)
for _k in ('h2', 'h3', 'q', 'lead'):
    S[_k].keepWithNext = 1
S['toc'] = ParagraphStyle('toc', parent=S['body'], fontSize=10.5, leading=17, spaceAfter=0)


def c(text):
    """Inline code."""
    return f'<font name="Mono" size="8.6" color="#6B1F2E">{text}</font>'


def P(text, style='body'):
    return Paragraph(text, S[style])


def bullets(items, style='bullet'):
    return [Paragraph(t, S[style], bulletText='•') for t in items]


def box(title, text, bg=BLUSH, edge=WINE):
    inner = [P(title.upper(), 'boxtitle')]
    for t in (text if isinstance(text, list) else [text]):
        inner.append(P(t, 'boxbody'))
    t = Table([[inner]], colWidths=[W - 2 * MARGIN])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('LINEBEFORE', (0, 0), (0, -1), 3, edge),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return KeepTogether([Spacer(1, 3), t, Spacer(1, 8)])


def plain(text):
    return box('In plain words', text, bg=BLUSH)


def term(text):
    return box('The proper term', text, bg=colors.HexColor('#FBF3E6'), edge=colors.HexColor('#B28A4A'))


def honest(text):
    return box('Honest note', text, bg=SAGEBG, edge=SAGE)


def table(rows, widths, header=True, zebra=True):
    data = []
    for i, r in enumerate(rows):
        st = 'cellh' if (header and i == 0) else 'cell'
        data.append([cell if not isinstance(cell, str) else Paragraph(cell, S[st]) for cell in r])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, BORDER),
    ]
    if header:
        style += [('BACKGROUND', (0, 0), (-1, 0), WINE)]
    if zebra:
        for i in range(1 if header else 0, len(rows)):
            if i % 2 == 0:
                style.append(('BACKGROUND', (0, i), (-1, i), GROUND))
    t.setStyle(TableStyle(style))
    return KeepTogether([t, Spacer(1, 9)]) if len(rows) < 14 else t


def code(text):
    t = Table([[Preformatted(text.strip('\n'), S['code'])]], colWidths=[W - 2 * MARGIN])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), GROUND), ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    return KeepTogether([t, Spacer(1, 9)])


def screens(nums, caption, width=3.6 * cm):
    imgs = []
    for n in nums:
        path = f'{HERE}/design-{n:02d}.png'
        img = Image(path, width=width, height=width * 968 / 447)
        imgs.append(img)
    t = Table([imgs], colWidths=[width + 0.5 * cm] * len(imgs))
    t.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    return KeepTogether([t, Spacer(1, 3), P(caption, 'cap'), Spacer(1, 8)])


# ---- diagrams ----------------------------------------------------------------------
def rbox(d, x, y, w, h, fill, stroke=None, r=6):
    d.add(Rect(x, y, w, h, rx=r, ry=r, fillColor=fill, strokeColor=stroke or fill, strokeWidth=0.8))


def label(d, x, y, text, size=8.5, font='Inter', color=INK, anchor='middle'):
    d.add(String(x, y, text, fontName=font, fontSize=size, fillColor=color, textAnchor=anchor))


def arrow(d, x1, y1, x2, y2, color=WINE, width=1.4):
    d.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=width))
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    s = 6
    p1 = (x2 - s * math.cos(a - 0.4), y2 - s * math.sin(a - 0.4))
    p2 = (x2 - s * math.cos(a + 0.4), y2 - s * math.sin(a + 0.4))
    d.add(Polygon([x2, y2, p1[0], p1[1], p2[0], p2[1]], fillColor=color, strokeColor=color))


def system_diagram():
    dw = W - 2 * MARGIN
    d = Drawing(dw, 250)
    # tag
    rbox(d, 0, 20, 150, 220, WINE)
    label(d, 75, 220, 'MiniTag (the tag)', 11, 'Fraunces', WHITE)
    label(d, 75, 206, 'Arduino Stella ABX00131', 7.5, 'Inter', ROSE)
    for i, (t, s) in enumerate([('MiniTag.ino', 'commands, events'), ('buzzer.cpp', 'PWM find pattern'),
                                ('battery.cpp', 'VDD via SAADC'), ('StellaUWB', 'Nearby Interaction')]):
        y = 160 - i * 40
        rbox(d, 12, y, 126, 32, CHAMP, r=5)
        label(d, 75, y + 18, t, 8.5, 'Inter-SemiBold')
        label(d, 75, y + 7, s, 7, 'Inter', MUTED)
    # link
    mx = 150
    label(d, mx + 85, 200, 'Bluetooth Low Energy', 9, 'Inter-SemiBold', WINE)
    label(d, mx + 85, 189, 'GATT service 1c400001-...', 7, 'Mono', MUTED)
    arrow(d, mx + 175, 160, mx + 5, 160)
    label(d, mx + 85, 166, 'Command: FIND / STOP / STATUS', 7.5)
    arrow(d, mx + 5, 120, mx + 175, 120)
    label(d, mx + 85, 126, 'Event: OK FIND, EVT BUTTON ...', 7.5)
    arrow(d, mx + 5, 85, mx + 175, 85)
    label(d, mx + 85, 91, 'Status: 6 bytes (notify)', 7.5)
    label(d, mx + 85, 52, 'UWB ranging (planned)', 7.5, 'Inter-Italic', MUTED)
    d.add(Line(mx + 5, 45, mx + 175, 45, strokeColor=MUTED, strokeWidth=1, strokeDashArray=[3, 3]))
    # phone
    px = mx + 180
    pw = dw - px
    rbox(d, px, 20, pw, 220, GROUND, BORDER)
    label(d, px + pw / 2, 220, 'MiniTag app (iPhone)', 11, 'Fraunces', WINE)
    layers = [('Screens (Expo Router)', 'Home, Map, Places, Find ...', BLUSH),
              ('Providers (React context)', 'Theme · MiniTag · AppData', BLUSH),
              ('Services (TypeScript)', 'MiniTagClient · protocol · geo', CHAMP),
              ('iOS services', 'Bluetooth · Location · Maps · Alerts', SAGEBG)]
    for i, (t, s, col) in enumerate(layers):
        y = 162 - i * 40
        rbox(d, px + 12, y, pw - 24, 32, col, r=5)
        label(d, px + pw / 2, y + 18, t, 8.5, 'Inter-SemiBold')
        label(d, px + pw / 2, y + 7, s, 7, 'Inter', MUTED)
    return d


def state_diagram():
    dw = W - 2 * MARGIN
    d = Drawing(dw, 175)
    states = {'idle': (40, 85), 'connecting': (190, 140), 'connected': (360, 85), 'reconnecting': (190, 25)}
    names = {'idle': 'idle', 'connecting': 'connecting', 'connected': 'connected', 'reconnecting': 'reconnecting'}
    for k, (x, y) in states.items():
        fill = WINE if k == 'connected' else BLUSH
        rbox(d, x - 2, y, 110, 30, fill, r=14)
        label(d, x + 53, y + 11, names[k], 9.5, 'Inter-SemiBold', WHITE if k == 'connected' else INK)
    arrow(d, 110, 112, 188, 150); label(d, 120, 140, 'pair()', 7.5, anchor='start')
    arrow(d, 300, 150, 380, 116); label(d, 345, 145, 'services found', 7.5)
    arrow(d, 395, 84, 300, 46); label(d, 380, 58, 'link lost', 7.5)
    arrow(d, 245, 55, 365, 86, SAGE); label(d, 290, 79, 'back in range', 7.5, color=SAGE)
    arrow(d, 188, 38, 110, 84, MUTED); label(d, 120, 52, 'forget()', 7.5, anchor='start', color=MUTED)
    return d


def alert_flow():
    dw = W - 2 * MARGIN
    d = Drawing(dw, 270)
    steps = [
        ('Tag link drops', 'connection: connected → reconnecting', BLUSH),
        ('Record last-seen point', 'phone GPS + street name or saved place', BLUSH),
        ('Inside a SAFE place?', 'haversine distance ≤ place radius', CHAMP),
        ('Schedule local notification', 'after 30 s / 1 min / 2 min (Settings)', BLUSH),
        ('Tag reconnects first?', 'cancel it: no false alarm', SAGEBG),
        ('Notification fires', 'tap → red Left-behind screen', colors.HexColor('#F6D0D4')),
    ]
    bw, bh = 250, 32
    x = (dw - bw) / 2
    for i, (t, s, col) in enumerate(steps):
        y = 230 - i * 44
        rbox(d, x, y, bw, bh, col, r=6)
        label(d, x + bw / 2, y + 19, t, 9, 'Inter-SemiBold')
        label(d, x + bw / 2, y + 7, s, 7.2, 'Inter', MUTED)
        if i < len(steps) - 1:
            arrow(d, x + bw / 2, y, x + bw / 2, y - 11)
    label(d, x + bw + 12, 230 - 2 * 44 + 14, 'yes → stay quiet', 8, 'Inter-SemiBold', SAGE, 'start')
    return d


# ---- page decoration ---------------------------------------------------------------
def cover(canv, doc):
    canv.saveState()
    canv.setFillColor(WINE)
    canv.rect(0, 0, W, H, fill=1, stroke=0)
    cx, cy = W / 2, H * 0.6
    for r, a in [(190, 0.10), (150, 0.14), (110, 0.2), (72, 0.28)]:
        canv.setStrokeColor(colors.Color(0.95, 0.85, 0.85, alpha=a))
        canv.setLineWidth(1.4)
        canv.circle(cx, cy, r, fill=0, stroke=1)
    canv.setFillColor(CHAMP)
    canv.circle(cx, cy, 46, fill=1, stroke=0)
    canv.setFillColor(WINE)
    canv.roundRect(cx - 15, cy - 22, 30, 42, 6, fill=1, stroke=0)
    canv.setFillColor(CHAMP)
    canv.circle(cx, cy - 6, 6, fill=1, stroke=0)
    canv.roundRect(cx - 6, cy + 9, 12, 3, 1.5, fill=1, stroke=0)
    canv.setFillColor(WHITE)
    canv.setFont('Fraunces', 56)
    canv.drawCentredString(W / 2, H * 0.29, 'MiniTag')
    canv.setFont('Fraunces-Italic', 16)
    canv.setFillColor(ROSE)
    canv.drawCentredString(W / 2, H * 0.29 - 30, 'The story of a tag that never lets your ID card wander')
    canv.setFont('Inter', 10.5)
    canv.setFillColor(CHAMP)
    canv.drawCentredString(W / 2, H * 0.29 - 62, 'A smart ID-card tracker  ·  Arduino Stella firmware  +  React Native app')
    canv.setFont('Inter-SemiBold', 9)
    canv.setFillColor(ROSE)
    canv.drawCentredString(W / 2, 2.2 * cm, 'INNOVATION PROJECT BOOK  ·  NOVEMBER 2026')
    canv.restoreState()


def page(canv, doc):
    canv.saveState()
    canv.setFillColor(GROUND)
    canv.rect(0, 0, W, 1.25 * cm, fill=1, stroke=0)
    canv.setFont('Inter', 7.8)
    canv.setFillColor(MUTED)
    canv.drawString(MARGIN, 0.5 * cm, 'MiniTag  ·  Project Book')
    canv.drawRightString(W - MARGIN, 0.5 * cm, str(doc.page))
    canv.setStrokeColor(WINE)
    canv.setLineWidth(2)
    canv.line(MARGIN, H - 1.2 * cm, MARGIN + 1.2 * cm, H - 1.2 * cm)
    canv.restoreState()


class Book(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(path, pagesize=A4, title='MiniTag Project Book', author='MiniTag team',
                         subject='Smart ID-card tracker: Arduino Stella firmware and React Native app')
        frame = Frame(MARGIN, 1.7 * cm, W - 2 * MARGIN, H - 3.5 * cm, id='f')
        self.addPageTemplates([
            PageTemplate('cover', [Frame(0, 0, W, H)], onPage=cover),
            PageTemplate('page', [frame], onPage=page),
        ])


def chapter(num, title, epigraph, keep=True):
    kicker = 'PROLOGUE' if num == '0' else ('APPENDIX ' + num if num.isalpha() else f'CHAPTER {num}')
    head = Table([[P(f'<font name="Inter-Bold" size="8.5" color="#B28A4A">{kicker}</font>', 'body')],
                  [Paragraph(title, ParagraphStyle('ct', fontName='Fraunces', fontSize=25, leading=29, textColor=WINE))],
                  [P(epigraph, 'lead')]], colWidths=[W - 2 * MARGIN])
    head.setStyle(TableStyle([('LEFTPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
    head.keepWithNext = keep  # never leave a chapter title alone at the bottom of a page
    gap = Spacer(1, 4)
    gap.keepWithNext = keep
    return [CondPageBreak(11 * cm), Spacer(1, 6), head, gap]


# ====================================================================================
story = [NextPageTemplate('page'), PageBreak()]
CW = W - 2 * MARGIN

# ---- contents -------------------------------------------------------------------------
story += [Paragraph('Contents', ParagraphStyle('ct', fontName='Fraunces', fontSize=25, leading=30, textColor=WINE)),
          Spacer(1, 6)]
toc = [
    ('Prologue', 'The card that kept disappearing'),
    ('1', 'The idea: what MiniTag is (and is not)'),
    ('2', 'The cast: how the parts fit together'),
    ('3', 'Meet the Stella: the hardware'),
    ('4', 'Teaching the tag to talk: the firmware'),
    ('5', 'Proof on the bench: testing the firmware'),
    ('6', 'The app takes shape: the front-end stack'),
    ('7', 'The conversation: the Bluetooth client'),
    ('8', 'Remembering and warning: the data layer'),
    ('9', 'Dressing it well: the design system'),
    ('10', 'A tour of the fourteen screens'),
    ('11', 'From laptop to pocket: build and deployment'),
    ('12', 'Bumps in the road: problems we solved'),
    ('13', 'How we know it works: quality and testing'),
    ('14', 'Not done yet: limitations and roadmap'),
    ('15', 'The defence: questions you will be asked'),
    ('A', 'Glossary of terms'),
    ('B', 'Where everything lives: the project files'),
]
story.append(table([[f'<font name="Fraunces" color="#8E2F44">{n}</font>', t] for n, t in toc],
                   [2.2 * cm, CW - 2.2 * cm], header=False, zebra=True))
story.append(Spacer(1, 10))
story.append(box('How to read this book', [
    'Each chapter tells part of the story, then gives the exact technical words you should use when you '
    'defend the project. Look for three kinds of boxes:',
    '<b>In plain words</b>: the idea explained simply.  <b>The proper term</b>: the vocabulary an examiner '
    'expects.  <b>Honest note</b>: limits we know about, so nobody catches you off guard.']))

# ---- prologue ---------------------------------------------------------------------------
story += chapter('0', 'Prologue: the card that kept disappearing',
                 'Every student knows the feeling. You reach for your ID card at the library gate, and your hand finds nothing.')
story += [
    P('A student ID card is small, flat and easy to forget. It slides under books, stays in yesterday’s jacket, '
      'or waits on a cafeteria table long after you have walked away. Without it you cannot enter buildings, '
      'borrow books or sit some exams. Replacing it costs time and money.'),
    P('MiniTag starts from a simple question: <i>what if the card holder could tell you where it is, and warn you '
      'the moment you leave it behind?</i>'),
    P('The answer has two halves that talk to each other. A coin-sized circuit board clipped to the ID holder, '
      'and an app on the student’s phone. The board can beep on command. The phone notices when the board drops '
      'out of range, remembers where that happened, and raises an alarm if it looks like the card was left behind.'),
    plain('MiniTag is a small Bluetooth beeper for your ID card, plus an app that makes it beep, shows where you '
          'last had it, and warns you if you walk away without it.'),
    term('MiniTag is an <b>embedded IoT (Internet of Things) asset-tracking system</b>: a <b>Bluetooth Low Energy '
         'peripheral</b> (the tag) running custom <b>firmware</b>, paired with a <b>mobile client application</b> '
         '(the app) acting as the <b>BLE central</b>.'),
]

# ---- chapter 1 ----------------------------------------------------------------------------
story += chapter('1', 'The idea: what MiniTag is (and is not)',
                 'Every good invention needs a clear promise. Ours fits in one sentence.')
story += [
    P('The original project brief was a 14-page specification titled <i>MiniTag Complete Mobile Application '
      'Specification</i>. It set out the goals and, just as usefully, the limits.'),
    P('Project objectives from the specification', 'h3'),
    *bullets([
        'Help students locate their ID cards when they are nearby (the buzzer).',
        'Warn users when their phone and the tracker become separated (the left-behind alert).',
        'Record and show the last place the phone was connected to the tracker (last-seen).',
        'Show important campus places on a map.',
        'Offer precise nearby finding with Ultra-Wideband on phones that support it.',
        'Keep the interface simple and accessible.',
    ]),
    P('What MiniTag is not', 'h3'),
    P('This matters in a defence, because examiners like to test the edges of a claim.'),
    *bullets([
        '<b>Not a GPS tracker.</b> The tag has no GPS receiver and no internet connection. It cannot report its '
        'position from across town.',
        '<b>Last-seen is the phone’s location</b>, recorded at the moment the phone and tag lost each other. '
        'It is an estimate of where the card is, not proof.',
        '<b>UWB is for the final few metres</b>, not long-distance tracking.',
    ]),
    honest('One technology change from the brief: the specification proposed Flutter (Dart). We built the app '
           'with <b>React Native and Expo (TypeScript)</b> instead. Both are cross-platform frameworks; the choice '
           'was the team’s preference. Chapter 6 explains the stack.'),
    term('Requirements like “the app shall connect to a tracker” are <b>functional requirements</b> (what '
         'the system does). Qualities like usability, battery efficiency and accessibility are '
         '<b>non-functional requirements</b> (how well it does it).'),
]

# ---- chapter 2 ----------------------------------------------------------------------------
story += chapter('2', 'The cast: how the parts fit together',
                 'A tag that speaks, a phone that listens, and an agreed language between them.')
story += [
    P('Every system is easier to defend once you can draw it. Here is MiniTag on one page.'),
    system_diagram(),
    P('Figure 2.1: MiniTag system architecture. Left: the tag and its firmware modules. Middle: the Bluetooth '
      'messages. Right: the app’s layers, from screens down to iOS services.', 'cap'),
    P('So where is the back end?', 'h2'),
    P('Many projects mean “a server in the cloud” when they say <i>back end</i>. MiniTag has '
      '<b>no cloud server</b>, and that is a design decision, not a gap: everything works offline, nothing about '
      'the student’s location leaves the phone, and there is nothing to host or pay for. In MiniTag the '
      'back-end work lives in two places:'),
    table([
        ['Layer', 'Where it runs', 'What it does'],
        ['<b>Embedded back end</b>', 'The tag (C++ firmware on the nRF52840 chip)',
         'Runs the Bluetooth service, drives the buzzer and LED, reads the button and battery, handles UWB.'],
        ['<b>On-device data layer</b>', 'The phone (TypeScript, no UI)',
         'Bluetooth connection logic, saved tracker, places, last-seen history, alert scheduling, storage in SQLite.'],
        ['<b>Front end</b>', 'The phone (React Native screens)',
         'Everything the student sees and touches: 14 screens, themes, animations.'],
    ], [3.6 * cm, 4.6 * cm, CW - 8.2 * cm]),
    plain('The tag is the worker, the app’s hidden logic is the manager, and the screens are the shop window.'),
    term('This is a <b>client–peripheral architecture</b> over <b>BLE GATT</b>, with <b>local-first data '
         'storage</b> (no server). The agreed message format is the <b>protocol</b>, written down in '
         f'{c("docs/ble-protocol.md")} as a <b>contract</b> between firmware and app.'),
]

# ---- chapter 3 ------------------------------------------------------------------------------
story += chapter('3', 'Meet the Stella: the hardware',
                 'Our hero is a 38-millimetre board with a radio, a buzzer, a button and a coin-cell heart.')
story += [
    P('The tracker is an <b>Arduino Stella (ABX00131)</b>, a board made for UWB tags. Its parts:'),
    table([
        ['Part', 'What it is', 'Why MiniTag needs it'],
        ['Nordic nRF52840', '32-bit Arm Cortex-M4F microcontroller at 64 MHz, 1 MB flash, 256 KB RAM, Bluetooth 5',
         'Runs our firmware and the Bluetooth radio'],
        ['Truesense DCU040', 'UWB module built on the NXP Trimension SR040 chip',
         'Precise distance (about ±10 cm) for Precision Find'],
        ['FUET-5020 buzzer', 'Magnetic transducer, 4 kHz, about 75–80 dB at 10 cm',
         'Makes the “find me” sound'],
        ['SS8050 transistor', 'NPN transistor that switches the buzzer current',
         'The chip pin is too weak to drive the buzzer directly'],
        ['User button (KEY)', 'Small push button', 'Silences the buzzer when you find the tag'],
        ['White LED', 'Status light (active-low)', 'Flashes with each beep'],
        ['SC7A20', '3-axis accelerometer', 'Not used yet (future: motion detection)'],
        ['CR2032 holder + USB-C', 'Coin cell or USB power', 'Power, programming and serial debugging'],
    ], [3.3 * cm, 6.6 * cm, CW - 9.9 * cm]),
    P('The detective story of the pins', 'h2'),
    P('Firmware has to know which <b>GPIO</b> (general-purpose input/output) pin each part is wired to. Arduino’s '
      'board package listed the LEDs but <b>not the buzzer or the button</b>. The schematic PDF had the answer, but '
      'its pin map was a drawing, not text.'),
    P('So we read the drawing with code: we extracted every text label from the schematic together with its '
      '<i>x, y</i> position on the page, then matched labels that lined up in the same column of the '
      '“PIN MAP” table. To check the method, we confirmed that it gave the QWIIC connector pins exactly as '
      'printed in the datasheet (P1.09 and P0.11). The result:'),
    table([
        ['Function', 'Net name', 'nRF52840 pin', 'How we confirmed it'],
        ['Buzzer', 'BUZ', 'P0.05', 'Boot chirp heard on the real board'],
        ['User button', 'KEY', 'P1.01', 'Pressing it stopped a live FIND (EVT BUTTON)'],
        ['White LED', 'LEDW', 'P1.05 (Arduino p37)', 'Matches Arduino’s own example code'],
        ['RGB LED', 'LEDR / LEDG / LEDB', 'P1.04 / P1.03 / P1.02', 'Matches the board package'],
    ], [2.6 * cm, 3.2 * cm, 4 * cm, CW - 9.8 * cm]),
    term('The buzzer is driven through a <b>low-side transistor switch</b>. The LED is <b>active-low</b> (writing 0 '
         'turns it on). The button is read with an <b>internal pull-up resistor</b>, so it reads LOW when pressed.'),
]

# ---- chapter 4 --------------------------------------------------------------------------------
story += chapter('4', 'Teaching the tag to talk: the firmware',
                 'A board with no instructions is just a pretty square. Firmware gives it a personality.')
story += [
    P('<b>Firmware</b> is the program that lives permanently in the chip’s flash memory. Ours is written in '
      '<b>C++</b> with the <b>Arduino Mbed OS Stella core</b>, about 480 lines across six files:'),
    table([
        ['File', 'Job'],
        [c('config.h'), 'Every setting in one place: pins, buzzer frequency, timeouts, Bluetooth UUIDs.'],
        [c('MiniTag.ino'), 'The main program: Bluetooth service, command parser, button, battery timer.'],
        [c('buzzer.h / .cpp'), 'The “find me” sound pattern and LED flashing.'],
        [c('battery.h / .cpp'), 'Measures the supply voltage and detects USB power.'],
    ], [4 * cm, CW - 4 * cm]),
    P('How Bluetooth Low Energy organises data', 'h2'),
    P('BLE devices expose a tree of <b>services</b>, each containing <b>characteristics</b>. A characteristic is like '
      'a labelled mailbox. Each one has a 128-bit <b>UUID</b> (a unique ID) and <b>properties</b> saying what the '
      'phone may do with it: <i>read</i>, <i>write</i>, or <i>notify</i> (the tag pushes updates without being '
      'asked). We designed one custom service with three characteristics:'),
    table([
        ['Characteristic', 'UUID (ends ...-dd1cee737c33)', 'Properties', 'Contents'],
        ['MiniTag service', '1c400001-524a-4696-9523', '(service)', 'Container for the three below'],
        ['Command', '1c400002-...', 'Write', 'Text such as FIND, FIND 20, STOP, STATUS'],
        ['Event', '1c400003-...', 'Read, Notify', 'Short text replies: OK FIND 30, EVT BUTTON ...'],
        ['Status', '1c400004-...', 'Read, Notify', '6 bytes of binary status (below)'],
    ], [3 * cm, 5.2 * cm, 2.3 * cm, CW - 10.5 * cm]),
    KeepTogether([P('The command language', 'h3'), table([
        ['Command', 'What the tag does', 'Reply'],
        ['FIND', 'Beeps for 30 seconds', 'OK FIND 30'],
        ['FIND n', 'Beeps for n seconds (1–120; larger values are capped at 120)', 'OK FIND n or ERR BAD_ARG'],
        ['STOP', 'Stops beeping immediately', 'OK STOP'],
        ['STATUS / BATTERY', 'Re-reads the battery and sends fresh status', 'OK STATUS / OK BATTERY'],
        ['anything else', 'Nothing', 'ERR UNKNOWN_CMD'],
    ], [3.2 * cm, 8 * cm, CW - 11.2 * cm])]),
    P('The tag also speaks without being asked: <b>EVT BUTTON</b> when its button is pressed, '
      '<b>EVT FIND_TIMEOUT</b> when a FIND ends by itself, and <b>EVT READY</b> at start-up.'),
    KeepTogether([P('The 6-byte status message', 'h3'), table([
        ['Byte', 'Field', 'Meaning'],
        ['0', 'Protocol version', 'Currently 1'],
        ['1', 'Flags', 'bit 0 buzzing · bit 1 UWB session · bit 2 battery valid · bit 3 USB powered'],
        ['2–3', 'Supply millivolts', '16-bit unsigned, <b>little-endian</b> (low byte first)'],
        ['4–5', 'Firmware version', 'Major, minor (currently 0.1)'],
    ], [1.6 * cm, 3.6 * cm, CW - 5.2 * cm])]),
    P('Design decisions worth defending', 'h2'),
    P('<b>1. Text commands, binary status.</b> Commands are text so we can type them by hand in the nRF Connect '
      'app while debugging. Status is binary because it is read constantly and must be tiny.'),
    P('<b>2. Replies fit in 20 bytes.</b> A BLE packet carries at most <b>MTU − 3</b> bytes of data. The '
      'default <b>MTU</b> (Maximum Transmission Unit) is 23 bytes, so 20 bytes is the safe limit without '
      'negotiating a bigger MTU. Every event we send fits.'),
    P('<b>3. Hardware PWM instead of tone().</b> Arduino’s usual way to make a sound is the '
      f'{c("tone()")} function. Reading the board core’s source code we found a bug: its stop routine sets the '
      'pin <i>pointer</i> to zero instead of driving the pin low, so the transistor can stay switched on and drain '
      f'the coin cell. We used {c("mbed::PwmOut")} instead: the chip’s <b>PWM</b> (pulse-width modulation) '
      'hardware makes a clean 4 kHz square wave at 50% <b>duty cycle</b> with no CPU work, and duty 0 holds the pin '
      'low.'),
    P('<b>4. Measuring the battery without extra parts.</b> The nRF52840’s <b>SAADC</b> (successive-approximation '
      'analogue-to-digital converter) can measure its own supply, VDD. On a coin cell, VDD is the battery voltage. '
      'With gain 1/6 and the internal 0.6 V reference, full scale is 3.6 V over 12 bits:'),
    code('millivolts = raw_reading * 3600 / 4096'),
    P('A separate hardware register (USBREGSTATUS) tells us if USB power is present, so the app can say '
      '“USB power” instead of showing a meaningless battery level.'),
    P('<b>5. Safety limits.</b> FIND is capped at 120 seconds so a lost tag cannot beep its battery flat. The '
      'button is <b>debounced</b> (changes shorter than 30 ms are ignored) because metal contacts bounce. If the '
      'phone disconnects mid-FIND, the beeping continues until its timeout, because the student may be walking '
      'toward the sound.'),
    P('<b>6. Sharing the radio with UWB.</b> Arduino’s StellaUWB library already runs its own Bluetooth services '
      'for Apple’s Nearby Interaction. We add our MiniTag service to the same Bluetooth stack '
      '<i>before</i> advertising starts, so one connection carries both. The tag starts the UWB engine only while a '
      'phone is connected, to save power.'),
    term('The firmware is a <b>superloop</b> (Arduino setup() then loop()) with <b>non-blocking</b> timing: '
         'nothing waits with long delays, so Bluetooth, the buzzer pattern and the button are all serviced every '
         '10 ms. The tag <b>advertises</b> its name “MiniTag” so phones can find it in a <b>scan</b>.'),
    P('Size: the compiled firmware uses <b>549,272 bytes of flash (55%)</b> and <b>87,232 bytes of RAM (33%)</b>, '
      'leaving plenty of room to grow.', 'small'),
]

# ---- chapter 5 -----------------------------------------------------------------------------------
story += chapter('5', 'Proof on the bench: testing the firmware',
                 'Claims are cheap. A beep you can hear is evidence.')
story += [
    P('We tested the real board, not a simulation. First, the <b>boot chirp</b>: the firmware beeps once at '
      'power-up. Hearing it proved the buzzer pin we had worked out from the schematic was right.'),
    P(f'Next, a Python test script ({c("tools/ble_test.py")}) using the <b>bleak</b> Bluetooth library connected '
      'from a Mac, sent every command and checked every reply automatically:'),
    table([
        ['Test', 'Expected', 'Result'],
        ['STATUS', 'OK STATUS + fresh status', 'PASS'],
        ['find 3 (lowercase)', 'OK FIND 3, then EVT FIND_TIMEOUT after 3 s', 'PASS'],
        ['FIND', 'OK FIND 30, buzzer flag on', 'PASS'],
        ['STOP + newline', 'OK STOP, buzzer flag off', 'PASS'],
        ['FIND abc', 'ERR BAD_ARG', 'PASS'],
        ['FIND 999', 'OK FIND 120 (capped)', 'PASS'],
        ['UWB_START', 'ERR UWB_VIA_NI', 'PASS'],
        ['HELLO', 'ERR UNKNOWN_CMD', 'PASS'],
        ['Button during FIND', 'Buzzer stops, EVT BUTTON', 'PASS (tools/find.py)'],
        ['Battery on USB', 'USB flag set, about 3.3 V', 'PASS (3253 mV)'],
    ], [4.2 * cm, 7.8 * cm, CW - 12 * cm]),
    plain('We wrote a robot that pressed every button on the tag’s remote control and checked the answers. '
          'Everything answered correctly.'),
    term(f'This is <b>hardware-in-the-loop (HIL) integration testing</b>: automated tests against the real device. '
         f'The script is <b>reproducible</b>: anyone can rerun it with one command.'),
]

# ---- chapter 6 ------------------------------------------------------------------------------------
story += chapter('6', 'The app takes shape: the front-end stack',
                 'One codebase, written once, running as a real native iPhone app.')
story += [
    table([
        ['Technology', 'Role', 'Why we chose it'],
        ['React Native 0.88', 'Builds native iOS/Android screens from JavaScript', 'One codebase for both platforms'],
        ['Expo SDK 58', 'Toolkit and native modules around React Native', 'Fast setup, ready-made modules, config plugins'],
        ['TypeScript', 'JavaScript with types', 'Catches mistakes before the app runs'],
        ['Expo Router', 'File-based navigation (each file in src/app is a screen)', 'Simple, predictable structure'],
        ['react-native-ble-plx', 'Bluetooth Low Energy client', 'Mature, supports background reconnect'],
        ['expo-sqlite (kv-store)', 'On-device key–value storage backed by SQLite', 'Saves settings and history offline'],
        ['expo-maps', 'Apple Maps on iOS', 'Real maps with no API key'],
        ['expo-location', 'Phone GPS and reverse geocoding', 'Last-seen points and street names'],
        ['expo-notifications', 'Local notifications', 'The left-behind alert'],
        ['Reanimated', 'Smooth animations on the UI thread', 'The pulsing radar rings'],
        ['expo-symbols', 'Apple SF Symbols icons', 'Crisp, native-looking icons'],
    ], [3.8 * cm, 6.2 * cm, CW - 10 * cm]),
    P('Expo Go versus a development build', 'h2'),
    P('Expo Go is a ready-made app that runs your JavaScript, but it only contains the native code Expo ships with, '
      'and Bluetooth is not part of it. So MiniTag runs as a <b>development build</b>: our own copy of the app, '
      'compiled with Xcode, that includes the Bluetooth, maps and location native code. During development it loads '
      'the JavaScript from the laptop over Wi-Fi (the <b>Metro bundler</b>), so screen changes appear on the phone '
      'in seconds without reinstalling.'),
    P('The layers inside the app', 'h2'),
    *bullets([
        '<b>Screens</b> (src/app): what you see. Home, Map, Places and Settings are tabs; Pair, Find, Precision, '
        'Alert, Add place, Battery and Welcome open on top.',
        f'<b>Providers</b> (React context): shared state every screen can read. {c("AppThemeProvider")} (colours), '
        f'{c("MiniTagProvider")} (the tracker), {c("AppDataProvider")} (places, history, alerts).',
        f'<b>Services</b>: plain TypeScript with no screens. {c("MiniTagClient")} (Bluetooth), {c("protocol.ts")} '
        f'(message encoding), {c("geo.ts")} (distance maths).',
    ]),
    term('Splitting code like this is <b>separation of concerns</b>. Pure functions with no phone dependencies '
         '(protocol, geo, themes) can be <b>unit-tested</b> on a laptop. Screens <b>subscribe</b> to state and '
         '<b>re-render</b> when it changes; this is the <b>reactive</b> model React is built on.'),
]

# ---- chapter 7 -------------------------------------------------------------------------------------
story += chapter('7', 'The conversation: the Bluetooth client',
                 'Talking is easy. Staying in touch when someone walks away is the hard part.')
story += [
    P(f'All Bluetooth work lives in one class, {c("MiniTagClient")}. It does four jobs.'),
    P('1. Finding the tag (scanning)', 'h3'),
    P('The phone listens for advertisements that carry the right service ID <i>and</i> the name '
      '“MiniTag”, and ranks results by signal strength (<b>RSSI</b>, received signal strength indicator) so '
      'the closest tag comes first. If only one is found, it is pre-selected.'),
    P('2. Keeping the link alive (the state machine)', 'h3'),
    state_diagram(),
    P('Figure 7.1: Connection states. “reconnecting” is the key to leave-behind detection.', 'cap'),
    P('When the tag goes out of range, the app does not give up. It opens a <b>pending connection</b> with no '
      'timeout. iOS keeps it waiting, even while the app is in the background, and completes it the moment the tag '
      'comes back. The app also uses <b>state restoration</b>, so iOS can relaunch it for Bluetooth events.'),
    P('3. Matching replies to commands', 'h3'),
    P('Writing a command and receiving its reply happen separately. The client keeps a queue of '
      '<b>waiters</b>: each command waits up to 4 seconds for its matching “OK ...” or “ERR ...”. '
      'If the tag disconnects, every waiter fails cleanly with “MiniTag disconnected” instead of hanging.'),
    P('4. Asking permission at the right moment', 'h3'),
    P('On iPhone, simply starting Bluetooth makes the permission prompt pop up. We made Bluetooth start '
      '<b>lazily</b>: only after the Welcome screen has explained why it is needed, or when a saved tracker needs '
      'reconnecting.'),
    term('Bluetooth data arrives as <b>Base64</b> text, which the app decodes into bytes. Reading two bytes '
         '“low byte first” is <b>little-endian</b> decoding. Matching replies to requests is '
         '<b>request–response correlation</b>.'),
]

# ---- chapter 8 ----------------------------------------------------------------------------------------
story += chapter('8', 'Remembering and warning: the data layer',
                 'A good friend remembers where you left things, and taps your shoulder before you walk away.')
story += [
    P(f'{c("AppDataProvider")} is the app’s memory and conscience. It stores everything in the phone’s SQLite '
      'key–value store, so it survives restarts and works offline.'),
    P('Last-seen points', 'h3'),
    P('While the tag is connected, the app saves the phone’s location every 3 minutes. When the link drops, it '
      'saves one more point at the moment of loss. Each point gets a human label: the name of a saved place if '
      'you are inside one, otherwise a street name from <b>reverse geocoding</b> (turning coordinates into an '
      'address). The newest ten points are kept, and repeats at the same spot are merged.'),
    P('Places and the geofence', 'h3'),
    P('A <b>place</b> is a circle: a centre point plus a radius (20–200 m) set with a slider. <b>Safe</b> places '
      'never alert (your dorm, your locker). <b>Watched</b> places always do. Deciding if you are inside a circle '
      'needs the distance between two points on a sphere, the <b>haversine formula</b>:'),
    code("""
a = sin^2(dLat/2) + cos(lat1) * cos(lat2) * sin^2(dLon/2)
distance = 2 * R * asin( sqrt(a) )          with R = 6,371,000 m (Earth's radius)
inside = distance <= place.radius
"""),
    P('The left-behind alert', 'h3'),
    alert_flow(),
    P('Figure 8.1: The left-behind decision, step by step.', 'cap'),
    P('The notification is <b>local</b>: the phone schedules it for itself, with no server and no push service. If '
      'the tag reconnects before the timer ends (a brief signal dip, say), the notification is cancelled, so it '
      'never fires as a false alarm. Snooze silences alerts for one hour.'),
    plain('The app writes itself a note: “if the tag hasn’t come back in one minute, shout.” If the tag '
          'comes back in time, the note goes in the bin.'),
    term('Circular zones are <b>geofences</b>. The waiting period is a <b>debounce window</b> that prevents '
         '<b>false positives</b>. Storing data only on the device is <b>privacy by design</b>.'),
]

# ---- chapter 9 -------------------------------------------------------------------------------------------
story += chapter('9', 'Dressing it well: the design system',
                 'People trust what looks cared for. The burgundy was chosen, not stumbled upon.')
story += [
    P('Before writing screens, we designed all 14 of them as mock-ups on a design canvas. The first drafts were '
      'blue, then dark teal (“too heavy”), then bright teal. The final direction is a <b>subtle burgundy</b> '
      'palette, and the app follows the mock-ups closely.'),
    screens([1, 3, 7], 'Figure 9.1: Design mock-ups for Home, Find My ID and the Left-behind alert.'),
    table([
        ['Token', 'Colour', 'Used for'],
        ['Porcelain ground', '#F8F3F1', 'Page background'],
        ['Wine', '#8E2F44', 'Hero cards, primary buttons, brand'],
        ['Champagne', '#EBD3AE', 'Accent: the Stop button, icon circles'],
        ['Blush', '#F2E3E2', 'Soft tiles and chips'],
        ['Ink', '#2A1418', 'Body text'],
        ['Sage', '#3E7B5C', '“Good” states such as battery'],
    ], [4 * cm, 3 * cm, CW - 7 * cm]),
    P('Type: <b>Fraunces</b> (a warm serif) for headings and <b>Inter</b> (a clean sans-serif) for everything else. '
      'This book uses the same fonts and colours.'),
    P('Themes, dark mode and accessibility', 'h2'),
    P('Settings offers four colour themes (Burgundy, Navy, Forest, Plum), each in a light and a dark version, plus '
      'Light, Dark or Match iPhone. That is eight palettes, and every one must stay readable.'),
    P('Readability has a number. The <b>WCAG</b> (Web Content Accessibility Guidelines) <b>contrast ratio</b> '
      'compares the brightness of text and background; normal text needs at least <b>4.5 : 1</b>. We wrote an '
      'automatic test that checks 16 text/background pairs in all 8 palettes. It earned its keep immediately: in '
      'every dark theme the Stop button had light text on a light champagne button, about <b>1.3 : 1</b>, almost '
      'invisible. The test failed, we added a dedicated “text on accent” colour, and now all pass.'),
    *bullets([
        'Every button is a real button for screen readers (<b>accessibility roles and labels</b>, e.g. VoiceOver).',
        'Touch targets are at least 44 points, Apple’s guideline.',
        'Animations stop if the phone has <b>Reduce Motion</b> turned on.',
        'Colour is never the only signal: states also have words (“Out of range”, “Connected”).',
    ]),
    term('A named, reusable colour such as “primary” or “accent” is a <b>design token</b>. '
         'Screens never contain raw colour codes; they ask the <b>theme provider</b> for tokens, which is what '
         'makes <b>theming</b> possible.'),
]

# ---- chapter 10 --------------------------------------------------------------------------------------------
story += chapter('10', 'A tour of the fourteen screens',
                 'Every screen in the design now exists in the app, and everything on it can be tapped.')
story += [
    table([
        ['Screen', 'What the student can do'],
        ['Welcome', 'Read why MiniTag needs Bluetooth (required), Location and Notifications (optional), then allow them.'],
        ['Home (first launch)', 'Set up MiniTag; tap the three feature rows to jump to Find, alert settings or the map.'],
        ['Home (connected)', 'See the burgundy card with radar rings, battery, firmware; open Find My ID, Precision, Battery or the map.'],
        ['Home (out of range)', 'See when and where the tag was last connected; open the map. Find is greyed out.'],
        ['Pair', 'Scan, see signal strength, name the tag (“School ID”), connect.'],
        ['Find My ID', 'Starts beeping at once; screen turns wine; Stop here or with the tag’s button.'],
        ['Precision Find', 'Distance and direction view (live UWB still to come; shows a fallback for now).'],
        ['Map', 'Apple Map with the last-seen point, saved places as circles, and earlier spots.'],
        ['Places', 'Counts of safe and watched places; switch each place between safe and watched.'],
        ['Add a place', 'Save where you stand, name it, set its size, choose safe or watched.'],
        ['Left-behind alert', 'Full-screen red alarm: Show on map, I have it, or Snooze for 1 hour.'],
        ['Battery', 'Good, Low or Replace, the voltage, and how to change the coin cell.'],
        ['Settings', 'Alerts on/off, delay, remember last seen, mode, colour theme, rename, remove tracker.'],
    ], [3.6 * cm, CW - 3.6 * cm]),
    screens([9, 2, 5, 6], 'Figure 10.1: Welcome, Pair, Map and Places (design mock-ups).', width=3.4 * cm),
    screens([12, 13, 8, 4], 'Figure 10.2: Add a place, Battery, Settings and Precision Find (design mock-ups).', width=3.4 * cm),
]

# ---- chapter 11 ---------------------------------------------------------------------------------------------
story += chapter('11', 'From laptop to pocket: build and deployment',
                 'Writing code is half the journey. Getting it onto a real iPhone is the other half.')
story += [
    table([
        ['Step', 'Tool', 'What happens'],
        ['1. Generate', 'expo prebuild', 'Creates the native iOS project from app.json and config plugins'],
        ['2. Dependencies', 'CocoaPods', 'Downloads and links the native iOS libraries'],
        ['3. Compile + sign', 'Xcode 27.2 (xcodebuild)', 'Builds the app and signs it with the developer certificate'],
        ['4. Install', 'xcrun devicectl', 'Copies the signed app to the iPhone over USB'],
        ['5. Run', 'Metro bundler', 'Serves the JavaScript to the app over Wi-Fi during development'],
    ], [3.2 * cm, 4.2 * cm, CW - 7.4 * cm]),
    P('Signing, explained', 'h2'),
    P('iPhones only run apps Apple can trace to a developer. We used a <b>free Personal Team</b> (an ordinary Apple '
      'ID). Xcode created a <b>signing certificate</b> and a <b>provisioning profile</b>, a permission slip saying '
      '“this app may run on this iPhone”. The phone also needed <b>Developer Mode</b> on and the developer '
      'marked as trusted.'),
    honest('With a free Personal Team the app stops opening <b>7 days</b> after it is installed; re-running the build '
           'reinstalls it. A paid Apple Developer account ($99/year) removes this and allows TestFlight and App '
           'Store distribution.'),
    term('Generating native projects from configuration is <b>Continuous Native Generation (CNG)</b>. Capabilities '
         'the app is allowed to use are <b>entitlements</b>. Version control is <b>Git</b>, with meaningful '
         '<b>commits</b> recording each milestone.'),
]

# ---- chapter 12 ----------------------------------------------------------------------------------------------
story += chapter('12', 'Bumps in the road: problems we solved',
                 'Every real project hits walls. How you climb them is the most convincing part of a defence.')
story += [
    table([
        ['Problem', 'Cause', 'How we fixed it'],
        ['Buzzer and button pins not documented in code',
         'The board package only listed LEDs',
         'Read text positions from the schematic PDF and matched the pin-map columns; confirmed on hardware.'],
        ['Risk of draining the coin cell',
         'Bug in the core’s tone(): stop() never drives the pin low',
         'Hardware PWM (mbed::PwmOut) with duty 0 = pin low.'],
        ['Mac test script killed instantly (exit 134)',
         'macOS privacy: the app running it had no Bluetooth permission',
         'Ran the test from Terminal, which asks for permission.'],
        ['Board showed up as a “Nano 33 BLE”',
         'Factory sketch built for that board (same chip)',
         'Checked USB IDs, confirmed it was a Stella, uploaded; it then reported as Stella.'],
        ['App could not use Bluetooth in Expo Go',
         'Expo Go lacks Bluetooth native code',
         'Built our own development build with Xcode.'],
        ['Build failed: no provisioning profile',
         'Expo CLI did not allow Xcode to create one',
         'Built with xcodebuild -allowProvisioningUpdates.'],
        ['Build failed: Push Notifications not allowed',
         'Notifications plugin adds the push entitlement; free teams cannot have it',
         'Turned off remote (push) notifications; MiniTag only needs local ones.'],
        ['Stop button unreadable in dark themes',
         'Light text on light champagne (1.3 : 1)',
         'Caught by the contrast test; added a dedicated text-on-accent colour.'],
        ['Bluetooth prompt appeared before any explanation',
         'Starting Bluetooth triggers the iOS prompt',
         'Lazy Bluetooth start after the Welcome screen.'],
    ], [4 * cm, 4.6 * cm, CW - 8.6 * cm]),
]

# ---- chapter 13 ------------------------------------------------------------------------------------------------
story += chapter('13', 'How we know it works: quality and testing',
                 'Confidence comes from evidence, gathered automatically and repeated often.')
story += [
    table([
        ['Check', 'What it proves', 'Result'],
        ['Unit tests (Node test runner)', 'Protocol decoding, distance maths, contrast of all themes', '18 / 18 pass'],
        ['TypeScript type-check', 'No type errors across the app', 'Pass'],
        ['ESLint (expo lint)', 'Code follows React rules', 'Pass'],
        ['expo-doctor', 'Dependencies and config are healthy', '20 / 20 checks'],
        ['Firmware compile', 'Builds for the Stella', 'Pass, no warnings in our code'],
        ['Hardware BLE tests', 'Every command on the real tag', '10 / 10 pass'],
        ['On-phone run', 'App builds, installs and launches on an iPhone 16', 'Pass'],
    ], [4.5 * cm, 7 * cm, CW - 11.5 * cm]),
    P('One unit test uses the exact bytes the real Stella sent during hardware testing (version 1, USB flag, '
      '3253 mV, firmware 0.1). If anyone changes the decoder incorrectly, that test fails.'),
    term('This combination is a <b>test pyramid</b>: many fast <b>unit tests</b>, fewer <b>integration tests</b> '
         'against real hardware, and <b>end-to-end</b> checks on the phone. <b>Static analysis</b> (type-checking '
         'and linting) catches whole classes of bugs before code runs.'),
]

# ---- chapter 14 -------------------------------------------------------------------------------------------------
story += chapter('14', 'Not done yet: limitations and roadmap',
                 'Saying clearly what is unfinished is a strength, not a weakness.')
story += [
    table([
        ['Item', 'Status', 'What it needs'],
        ['Precision Find (UWB distance and arrow)', 'Screen built; ranging not connected',
         'A native Expo module wrapping Apple’s Nearby Interaction framework. The tag side is ready.'],
        ['Alerts with the phone locked', 'Built; needs real-world testing',
         'Walk away with the phone locked and the tag left behind; tune timings.'],
        ['Coin-cell battery life', 'Not measured',
         'Measure current while connected; UWB may need to start only on demand.'],
        ['Campus map of real buildings', 'Students add their own places',
         'A verified list of campus locations (the brief says never invent coordinates).'],
        ['Android', 'Code is cross-platform; untested', 'Test on an Android phone; Google Maps key for maps.'],
        ['Enclosure', 'Bare board', 'A case or holder that clips to an ID lanyard.'],
        ['Distribution', 'Free signing (7 days)', 'Paid developer account for TestFlight or App Store.'],
    ], [4.6 * cm, 4.4 * cm, CW - 9 * cm]),
    honest('In the demo, say: “Precision Find’s screen and the tag’s UWB side are ready; connecting the '
           'iPhone’s UWB chip needs a native module, which is our next milestone.” That is accurate, and '
           'examiners respect it.'),
]

# ---- chapter 15 -------------------------------------------------------------------------------------------------
story += chapter('15', 'The defence: questions you will be asked',
                 'Practise these out loud. Short, confident, correct.')
qa = [
    ('Is MiniTag a GPS tracker?',
     'No. The tag has no GPS. The last-seen point is the phone’s location when the tag disconnected. It finds the '
     'card nearby (beep, UWB) and tells you where you probably left it.'),
    ('Why Bluetooth Low Energy and not Wi-Fi?',
     'BLE uses tiny amounts of power, which suits a coin cell, and every smartphone supports it. Wi-Fi would drain '
     'the battery and needs a network.'),
    ('How does the app know I left my ID behind?',
     'It watches the BLE connection. When the link drops it records the location, checks whether you are in a safe '
     'place, and schedules a local notification after a delay. If the tag reconnects in time, the alert is cancelled.'),
    ('How do you avoid false alarms?',
     'The configurable delay (30 s to 2 min) acts as a debounce window, safe places suppress alerts, and snooze '
     'pauses them for an hour.'),
    ('Where is your back end?',
     'There is no cloud server by design. The back end is the embedded firmware on the tag plus the on-device data '
     'layer in the app. Data stays on the phone, which protects privacy and works offline.'),
    ('How did you design the Bluetooth protocol?',
     'A custom GATT service with three characteristics: Command (write, text), Event (notify, text, at most 20 bytes '
     'to fit the default MTU) and Status (notify, 6 bytes binary, little-endian). It is documented in '
     'docs/ble-protocol.md.'),
    ('How is battery level measured?',
     'The chip’s SAADC reads its own supply voltage with gain 1/6 and a 0.6 V reference (3.6 V full scale, '
     '12-bit). We show Good, Low or Replace rather than a percentage, because coin cells drop sharply near the end.'),
    ('Why not use Arduino’s tone() for the buzzer?',
     'Its stop function can leave the transistor on and drain the battery. Hardware PWM gives a clean 4 kHz signal '
     'and a guaranteed off state.'),
    ('What is UWB and why both UWB and BLE?',
     'Ultra-Wideband measures distance from radio time-of-flight to about 10 cm. BLE finds and connects; UWB gives '
     'precise distance and direction for the last few metres.'),
    ('How did you test it?',
     'Automated tests on the real tag (10 of 10 commands pass), 18 unit tests, type-checking, linting, and running '
     'the app on an iPhone 16.'),
    ('What about privacy?',
     'Location is only used when the student allows it, is stored only on the phone, and can be cleared in Settings.'),
    ('What would you do next?',
     'Finish Precision Find with Apple’s Nearby Interaction, field-test locked-phone alerts, measure battery life, '
     'add a verified campus map, test Android, and design an enclosure.'),
]
for q, a in qa:
    story.append(KeepTogether([P(q, 'q'), P(a)]))

# ---- glossary ---------------------------------------------------------------------------------------------------
story += [PageBreak()] + chapter('A', 'Glossary of terms', 'The right word, every time.', keep=False)
gloss = [
    ('Advertising', 'A BLE device broadcasting short packets so phones can discover it.'),
    ('Base64', 'A way of writing binary bytes as plain text.'),
    ('BLE (Bluetooth Low Energy)', 'Low-power Bluetooth for small devices and sensors.'),
    ('Central / Peripheral', 'In BLE, the central (phone) connects to the peripheral (tag).'),
    ('Characteristic', 'One data value inside a BLE service, with a UUID and properties.'),
    ('CNG', 'Continuous Native Generation: native projects generated from configuration.'),
    ('Contrast ratio', 'Brightness difference between text and background (WCAG requires 4.5 : 1 for body text).'),
    ('Debounce', 'Ignoring very short changes (button bounce, brief signal dips).'),
    ('Design token', 'A named design value, such as “primary colour”, used instead of raw values.'),
    ('Development build', 'A custom build of an Expo app including its own native code.'),
    ('Duty cycle', 'The percentage of time a PWM signal is high.'),
    ('Entitlement', 'A capability an iOS app is permitted to use, such as push notifications.'),
    ('Firmware', 'Software stored permanently in a device’s chip.'),
    ('GATT', 'Generic Attribute Profile: how BLE organises data into services and characteristics.'),
    ('Geofence', 'A virtual boundary, here a circle around a saved place.'),
    ('GPIO', 'General-purpose input/output: a chip pin set or read by software.'),
    ('Haversine formula', 'Computes the distance between two points on a sphere.'),
    ('Little-endian', 'Storing the least significant byte first.'),
    ('Local notification', 'A notification the phone schedules itself, without a server.'),
    ('Metro', 'The JavaScript bundler that serves app code to the phone during development.'),
    ('MTU', 'Maximum Transmission Unit: the largest BLE packet; data per packet is MTU minus 3.'),
    ('Notify', 'A BLE property letting the peripheral push updates to the central.'),
    ('Provisioning profile', 'Apple’s permission file allowing a signed app to run on given devices.'),
    ('PWM', 'Pulse-width modulation: switching a pin on and off rapidly to make a waveform.'),
    ('React Native', 'A framework for native mobile apps written in JavaScript/TypeScript.'),
    ('Reverse geocoding', 'Turning coordinates into a street or place name.'),
    ('RSSI', 'Received signal strength indicator: a rough measure of closeness.'),
    ('SAADC', 'The nRF52840’s analogue-to-digital converter.'),
    ('State machine', 'A model where a system is always in one named state and moves between them on events.'),
    ('Unit test', 'An automated test of one small piece of code in isolation.'),
    ('UUID', 'A 128-bit identifier that is unique in practice.'),
    ('UWB', 'Ultra-Wideband: radio that measures distance by time-of-flight, accurate to centimetres.'),
    ('WCAG', 'Web Content Accessibility Guidelines.'),
]
story.append(table([['Term', 'Meaning']] + [[f'<b>{t}</b>', m] for t, m in gloss], [4.6 * cm, CW - 4.6 * cm]))

# ---- appendix B -----------------------------------------------------------------------------------------------
story += chapter('B', 'Where everything lives: the project files', 'A map of the repository.')
story.append(code("""
Arduino Stella/
  firmware/MiniTag/        Stella firmware (C++)
    MiniTag.ino            BLE service, commands, button, battery timer
    config.h               pins, UUIDs, timings
    buzzer.cpp/.h          PWM find pattern + LED
    battery.cpp/.h         SAADC supply voltage, USB detect
  firmware/README.md       setup, upload, hardware test checklist
  docs/ble-protocol.md     the firmware <-> app contract
  tools/ble_test.py        automated BLE test from a Mac (bleak)
  tools/find.py            starts a FIND and prints events (button test)
  app/                     the iPhone app (Expo SDK 58, TypeScript)
    app.json               app name, permissions, native plugins
    src/app/               screens (Expo Router)
      (tabs)/              Home, Map, Places, Settings + pill tab bar
      welcome, pair, find, precision, alert, add-place, battery
    src/ble/               protocol.ts, minitag-client.ts, minitag-context.tsx
    src/features/          app-data.tsx, geo.ts, precision.ts
    src/theme/             themes.ts (8 palettes), theme-context.tsx
    src/components/minitag ui.tsx (buttons, cards, radar rings, headers)
    tests/                 protocol, geo and theme-contrast unit tests
"""))
story.append(P('Commit history so far', 'h3'))
story.append(table([
    ['Commit', 'Date', 'Milestone'],
    [c('0ebdf93'), '19 Nov 2026', 'Stella firmware, BLE protocol and first Expo app'],
    [c('90b7ff9'), '19 Nov 2026', 'Burgundy design, Settings screen and colour themes'],
    ['(uncommitted)', '19 Nov 2026', 'Dark themes, all 14 screens, maps, places, last-seen, left-behind alerts'],
], [3 * cm, 3 * cm, CW - 6 * cm]))
story.append(Spacer(1, 18))
story.append(P('<i>To be continued: the next chapter of MiniTag is Precision Find.</i>', 'lead'))

Book(OUT).build(story)
print('wrote', OUT)
