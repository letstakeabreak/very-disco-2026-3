from pathlib import Path
import json
OUT=Path(__file__).resolve().parent
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1590" viewBox="0 0 1280 1590"><rect width="1280" height="1590" fill="#142128"/><style>text{fill:#dce6e9;font:14px sans-serif}.title{font-size:21px;font-weight:bold}.small{font-size:11px}</style><text x="24" y="32" class="title">Actual triangle / plane intersections — no generated cap or inner geometry</text><text x="24" y="58">Amber = texture hue proxy; gray = other surface. Width-normalized to 280 mm. +Z is front.</text>']
for col,kind in enumerate(['source','runtime']):
 sections=json.loads((OUT/f'{kind}-sections.json').read_text())
 for row,s in enumerate(sections):
  left=col*640+40;top=row*370+120;w=540;h=280
  axis=s['axis'];value=s['value'];axes=[2,1]if axis==0 else[0,2];xmin,xmax=(-.08,.08)if axis==0 else(-.15,.15);ymin,ymax=(0,.14)if axis==0 else(-.08,.08)
  def pos(p):return left+(p[axes[0]]-xmin)/(xmax-xmin)*w,top+h-(p[axes[1]]-ymin)/(ymax-ymin)*h
  svg.append(f'<text x="{left}" y="{top-20}" class="title">{kind.upper()} — {"X" if axis==0 else "Y"} = {value*1000:.0f} mm</text><rect x="{left}" y="{top}" width="{w}" height="{h}" fill="#1b2b33" stroke="#344750"/>')
  for seg,amber in zip(s['segments'],s['amber']):
   a,b=pos(seg[0]),pos(seg[1]);svg.append(f'<path d="M{a[0]:.2f},{a[1]:.2f}L{b[0]:.2f},{b[1]:.2f}" stroke="{"#e7ae43"if amber else "#becad0"}" stroke-width="1.6"/>')
  if axis==0 and value==0:
   for y,color in[(.068,'#70cce8'),(.044,'#e57386')]:
    yy=top+h-(y-ymin)/(ymax-ymin)*h;svg.append(f'<path d="M{left},{yy}H{left+w}" stroke="{color}" stroke-dasharray="5 5"/><text x="{left+8}" y="{yy-6}" class="small">Y={y*1000:.0f} mm: {2 if y==.068 else 6} intersections</text>')
  svg.append(f'<text x="{left}" y="{top+h+20}" class="small">horizontal: {"Z" if axis==0 else "X"} [{xmin*1000:.0f}, {xmax*1000:.0f}] mm · vertical: {"Y" if axis==0 else "Z"} [{ymin*1000:.0f}, {ymax*1000:.0f}] mm</text>')
svg.append('</svg>');(OUT/'sections.svg').write_text(''.join(svg))
