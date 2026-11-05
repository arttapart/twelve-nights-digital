/* dungeon tiles: same drawing rules as the tile editor (arttapart/dungeon-tile-editor), themed colours */
// uploaded art (editor): url of an art file; the editor's preview maps paths to in-memory files
const ART=(typeof DATA!=='undefined'&&DATA.art)||{};
const artU=p=>(typeof window!=='undefined'&&window.ARTMAP&&window.ARTMAP[p])||('art/'+p);
const TL=(function(){
const TILES=DATA.tiles;const ICON=DATA.icons;
const CELL={'':['',''],Y:['daemon-skull','اهریمن زرد'],O:['daemon-skull','اهریمن نارنجی'],R:['daemon-skull','اهریمن قرمز'],Q:['daemon-skull','اهریمن نامعلوم'],T:['locked-chest','صندوقچه'],C:['two-coins','۲ سکه'],S:['scroll-unfurled','۲ طومار'],E:['death-skull','جوهرهٔ تاریک'],P:['magic-portal','پورتال'],F:['water-fountain','چشمهٔ پالایش'],K:['cursed-star','نفرین‌شده'],A:['castle','دروازهٔ شهر']};
const LVL={Y:'۱',O:'۲',R:'۳',Q:'؟'};
const SET={tileMM:112,marginMM:5,cellD:25,cellStroke:0.9,cellStrokeCol:'#b89545',cellFill:'#22204f',rings:true,corW:6.6,corBorder:0.8,corFillCol:'#3b3770',corBorderCol:'#c9b98a',markCol:'#f3cf72',badgeScale:1,badgeFill:'#15163a',badgeStroke:'#c9b98a',iconCol:'#ece6ff',labels:true,labelCol:'#cfc8f0',lvlBadge:true,tileBg:'#141533',edgeCol:'#b89545'};
const S=SET.tileMM,M=SET.marginMM,P=(S-2*M)/3,RC=SET.cellD/2,CW=SET.corW,CI=CW-2*SET.corBorder,F=RC/16,BF=P/((140-6)/3),BS=RC/12.5;
const kD=k=>k[0]==='d'||k[0]==='b',kX=k=>k[0]==='x'||k[0]==='b',kL=k=>k[1]==='2',ow1=k=>/[oi]$/.test(k);
const isExit=p=>typeof p[0]==='string';
const unkey=k=>{const [a,b]=k.split(',');return isNaN(+a)?[a,+b]:[+a,+b]};
function ctr(p){if(isExit(p)){const m=M+P*p[1]+P/2;return {N:[m,0],S:[m,S],E:[S,m],W:[0,m]}[p[0]]}return [M+P*p[1]+P/2,M+P*p[0]+P/2]}
function ctrl(a,b,bend){const p=ctr(a),q=ctr(b),mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2,dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy);return [mx-dy/L*bend*BF*2,my+dx/L*bend*BF*2]}
const bez=(p,c,q,t)=>[(1-t)**2*p[0]+2*(1-t)*t*c[0]+t*t*q[0],(1-t)**2*p[1]+2*(1-t)*t*c[1]+t*t*q[1]];
function tang(p,c,q,t){const dx=2*(1-t)*(c[0]-p[0])+2*t*(q[0]-c[0]),dy=2*(1-t)*(c[1]-p[1])+2*t*(q[1]-c[1]),L=Math.hypot(dx,dy)||1;return [dx/L,dy/L]}
function icon(n,x,y,s,col){col=col||SET.iconCol;return `<g transform="translate(${x-s/2},${y-s/2}) scale(${s/512})" color="${col}" fill="${col}">${ICON[n]}</g>`}
function arrowSvg(x,y,rot){return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${BS})"><path d="M-2.3,-2.1 L2.5,0 L-2.3,2.1 Z" fill="${SET.iconCol}"/></g>`}
function badge(x,y,items,horiz){const n=items.length,st=6*BS,L=n*st+BS,W=7*BS,w=horiz?L:W,h=horiz?W:L;let o=`<rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="${3.5*BS}" fill="${SET.badgeFill}" stroke="${SET.badgeStroke}" stroke-width="${.5*BS}"/>`;items.forEach(([k,v],i)=>{const d=(i-(n-1)/2)*st,ix=horiz?x+d:x,iy=horiz?y:y+d;o+=k==='icon'?icon(v,ix,iy,4.9*BS):arrowSvg(ix,iy,v)});return o}
function badgeT(c){const [a,b,,bend]=c,p=ctr(a),q=ctr(b),cc=ctrl(a,b,bend);let tm=.5;if(isExit(b)&&!isExit(a)){const ts=[];for(let j=0;j<=60;j++){const pt=bez(p,cc,q,j/60);if(Math.hypot(pt[0]-p[0],pt[1]-p[1])>RC+1)ts.push(j/60)}if(ts.length)tm=(ts[0]+1)/2}return tm}
function corSvg(c){const [a,b,k,bend]=c,p=ctr(a),q=ctr(b),cc=ctrl(a,b,bend),d=`M${p[0]},${p[1]} Q${cc[0]},${cc[1]} ${q[0]},${q[1]}`;
 const outer=`<path d="${d}" stroke="${SET.corBorderCol}" stroke-width="${CW}" fill="none"/>`,inner=`<path d="${d}" stroke="${SET.corFillCol}" stroke-width="${CI}" fill="none"/>`;let mk='',bg='';
 const ex=isExit(b)&&!isExit(a),exx=isExit(a)&&isExit(b);
 if(!ex||k!=='s1'){if(kD(k))mk+=`<path d="${d}" stroke="${SET.markCol}" stroke-width="${.9*CI/5}" stroke-linecap="round" stroke-dasharray="0.01 ${1.5*CI/5}" fill="none"/>`;
  if(kX(k)){const amp=CI*.46;for(let j=1;j<24;j++){const t=j/24,[x,y]=bez(p,cc,q,t),[tx,ty]=tang(p,cc,q,t),nx=-ty,ny=tx,s=j%2?1:-1;mk+=`<path d="M${x-nx*amp},${y-ny*amp} L${x+tx*.8*s},${y+ty*.8*s} L${x+nx*amp},${y+ny*amp}" stroke="${SET.markCol}" stroke-width="0.45" fill="none"/>`}}
  const items=[];if(kD(k))items.push(['icon','torch']);if(kX(k))items.push(['icon','war-pick']);let tm=.5;if(ex&&!exx)tm=badgeT(c);const [tx,ty]=tang(p,cc,q,tm);
  if(ow1(k))items.push(['arrow',Math.atan2(ty,tx)*180/Math.PI+(k.endsWith('i')?180:0)]);if(kL(k))items.push(['icon','footprint'],['icon','footprint']);
  const [x,y]=bez(p,cc,q,tm);bg=items.length?badge(x,y,items,Math.abs(ty)>Math.abs(tx)):''}
 return [outer,inner,mk,bg]}
function cellSvg(k,v){const [x,y]=ctr(unkey(k));let o=`<circle cx="${x}" cy="${y}" r="${RC}" fill="${SET.cellFill}"/><circle cx="${x}" cy="${y}" r="${RC}" fill="none" stroke="${SET.cellStrokeCol}" stroke-width="${SET.cellStroke}"/>`;const sc=SET.cellStrokeCol;
 if(v==='O'||v==='R')o+=`<circle cx="${x}" cy="${y}" r="${RC-1.4*F/.78}" fill="none" stroke="${sc}" stroke-width="0.45"/>`;if(v==='R')o+=`<circle cx="${x}" cy="${y}" r="${RC-2.6*F/.78}" fill="none" stroke="${sc}" stroke-width="0.45"/>`;if(v==='K')o+=`<circle cx="${x}" cy="${y}" r="${RC-1.4*F/.78}" fill="none" stroke="${sc}" stroke-width="0.5" stroke-dasharray="1.2 1"/>`;
 if(v&&CELL[v]){o+=v in LVL?icon(CELL[v][0],x,y-1.2*F,11.5*F):icon(CELL[v][0],x,y-2.6*F,(v==='A'?15:13.5)*F);o+=`<text x="${x}" y="${y+9.6*F}" font-size="${2.75*F}" text-anchor="middle" font-weight="700" direction="rtl" fill="${SET.labelCol}" font-family="Vazirmatn,sans-serif">${CELL[v][1]}</text>`}
 if(v in LVL)o+=`<circle cx="${x}" cy="${y-RC+4.4*F}" r="${2.9*F}" fill="#000"/><text x="${x}" y="${y-RC+5.75*F}" font-size="${3.9*F}" text-anchor="middle" font-weight="800" fill="#fff">${LVL[v]}</text>`;return o}
function tile(ti){const t=TILES[ti];const os=[],is=[],ms=[],bs=[];t.cors.forEach(c=>{const [a,b,m,g]=corSvg(c);os.push(a);is.push(b);ms.push(m);bs.push(g)});
 return `<rect width="${S}" height="${S}" fill="${SET.tileBg}"/>${os.join('')}${is.join('')}${ms.join('')}${Object.entries(t.cells).map(([k,v])=>cellSvg(k,v)).join('')}${bs.join('')}<rect x="0.4" y="0.4" width="${S-.8}" height="${S-.8}" fill="none" stroke="${SET.edgeCol}" stroke-width="0.8"/>${t.level===2?`<rect x="1.8" y="1.8" width="${S-3.6}" height="${S-3.6}" fill="none" stroke="${SET.edgeCol}" stroke-width="0.3"/>`:''}`}
function rotK(k,r){let [a,b]=k.split(',').map(Number);for(let i=0;i<r;i++){[a,b]=[b,2-a]}return a+','+b}
function tileR(ti,r){if(ART.tiles&&ART.tiles[ti])return `<image href="${artU(ART.tiles[ti])}" width="${S}" height="${S}" preserveAspectRatio="none" transform="rotate(${r*90} ${S/2} ${S/2})"/>`;const t=TILES[ti];const os=[],is=[],ms=[],bs=[];t.cors.forEach(c=>{const [a,b,m,g]=corSvg(c);os.push(a);is.push(b);ms.push(m);bs.push(g)});const rot=`rotate(${r*90} ${S/2} ${S/2})`;
 return `<rect width="${S}" height="${S}" fill="${SET.tileBg}"/><g transform="${rot}">${os.join('')}${is.join('')}${ms.join('')}</g>${Object.entries(t.cells).map(([k,v])=>cellSvg(rotK(k,r),v)).join('')}<g transform="${rot}">${bs.join('')}</g><rect x="0.4" y="0.4" width="${S-.8}" height="${S-.8}" fill="none" stroke="${SET.edgeCol}" stroke-width="0.8"/>${t.level===2?`<rect x="1.8" y="1.8" width="${S-3.6}" height="${S-3.6}" fill="none" stroke="${SET.edgeCol}" stroke-width="0.3"/>`:''}`}
function legCor(k){const [o,i,m,g]=corSvg([[0,0],[0,2],k,0]),y=M+P/2,x0=M+P/2+RC-3,w=2*P-2*RC+6;return `<svg class="lgs" viewBox="${x0} ${y-8} ${w} 16"><rect x="${x0}" y="${y-8}" width="${w}" height="16" fill="${SET.tileBg}"/>${o}${i}${m}${cellSvg('0,0','')}${cellSvg('0,2','')}${g}</svg>`}
return {S,M,P,RC,TILES,ctr,tile,tileR,unkey,icon,legCor,SET}})();
