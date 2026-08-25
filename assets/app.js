(function(){
'use strict';

var D = (window.AH_DATA || []).slice().sort(function(a,b){return a.start-b.start;});
var MET = {};           // 流派id -> 作品数组（异步载入）
var byId = {};
D.forEach(function(s){ byId[s.id]=s; });

var ERAS = [];
D.forEach(function(s){ if(ERAS.indexOf(s.era)<0) ERAS.push(s.era); });
var ERA_COLORS = ['#8a5a3c','#7a6a9c','#2e6b8a','#a8642e','#5c7f5a','#9c4a4a','#4a6b8a','#7a5c8a'];
function eraColor(era){ var i=ERAS.indexOf(era); return ERA_COLORS[i%ERA_COLORS.length]; }

var $ = function(id){ return document.getElementById(id); };
function el(tag,cls,html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

/* ============ 载入 MET 图片数据 ============ */
function loadMet(){
  return fetch('data/met-images.json').then(function(r){ return r.ok?r.json():{}; })
    .then(function(j){ MET=j||{}; }).catch(function(){ MET={}; });
}

/* ============ 视图切换 ============ */
var VIEWS=['timeline','painters','gallery','compare','glossary'];
function showView(v){
  VIEWS.forEach(function(k){
    var sec=$('view-'+k); if(sec) sec.hidden = (k!==v);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.navbtn'),function(b){
    b.classList.toggle('is-on', b.dataset.view===v);
  });
  if(v==='painters') renderPainters();
  if(v==='gallery') renderGallery();
  if(v==='compare') renderCompare();
  if(v==='glossary') renderGlossary();
  window.scrollTo({top:0,behavior:'smooth'});
}
Array.prototype.forEach.call(document.querySelectorAll('.navbtn'),function(b){
  b.addEventListener('click',function(){ showView(b.dataset.view); });
});

/* ============ 时间轴 ============ */
var TL_MIN=-3200, TL_MAX=2060, TL_W=1860;
// 分段压缩：古代跨度大但流派少，用非线性映射
function xOf(year){
  var segs=[[-3200,-500,0,.13],[-500,1000,.13,.26],[1000,1400,.26,.36],
            [1400,1600,.36,.50],[1600,1800,.50,.63],[1800,1900,.63,.76],
            [1900,1960,.76,.90],[1960,2060,.90,1]];
  for(var i=0;i<segs.length;i++){
    var s=segs[i];
    if(year>=s[0] && year<=s[1]){
      var t=(year-s[0])/(s[1]-s[0]);
      return (s[2]+t*(s[3]-s[2]))*TL_W;
    }
  }
  return year<-3200?0:TL_W;
}
var hiddenEras={};

function renderLegend(){
  var box=$('eraLegend'); box.innerHTML='';
  ERAS.forEach(function(era){
    var t=el('button','era-tag'+(hiddenEras[era]?' off':''));
    t.appendChild(el('span','era-dot')).style.background=eraColor(era);
    t.appendChild(document.createTextNode(era+' · '+D.filter(function(s){return s.era===era;}).length));
    t.addEventListener('click',function(){
      hiddenEras[era]=!hiddenEras[era]; renderLegend(); renderTimeline();
    });
    box.appendChild(t);
  });
}

function renderTimeline(){
  var axis=$('tlAxis'); axis.innerHTML='';
  [-3000,-1500,-500,1,500,1000,1300,1500,1600,1700,1800,1850,1900,1930,1960,2000,2026].forEach(function(y){
    var t=el('div','tl-tick', y<0? (Math.abs(y)+' BC') : (y===1?'公元1年':y+''));
    t.style.left=xOf(y)+'px'; axis.appendChild(t);
  });

  var body=$('tlBody'); body.innerHTML='';
  // 贪心分行避免重叠
  var rows=[];
  D.filter(function(s){ return !hiddenEras[s.era]; }).forEach(function(s){
    var x1=xOf(s.start), x2=xOf(s.end), w=Math.max(x2-x1,96);
    var placed=false;
    for(var i=0;i<rows.length;i++){
      if(x1 > rows[i]+8){ rows[i]=x1+w; s._row=i; placed=true; break; }
    }
    if(!placed){ rows.push(x1+w); s._row=rows.length-1; }
    s._x=x1; s._w=w;
  });
  var nRows=rows.length;
  for(var r=0;r<nRows;r++) body.appendChild(el('div','tl-row'));
  var rowEls=body.querySelectorAll('.tl-row');

  D.filter(function(s){ return !hiddenEras[s.era]; }).forEach(function(s){
    var bar=el('div','tl-bar');
    bar.style.left=s._x+'px'; bar.style.width=s._w+'px';
    bar.style.background=eraColor(s.era);
    bar.dataset.id=s.id;
    bar.appendChild(el('span','tl-bar-lbl',esc(s.name)));
    if(s._w>168) bar.appendChild(el('span','tl-bar-yr',esc(s.yearLabel.replace('约','').replace('年',''))));
    bar.title=s.name+' '+s.yearLabel;
    bar.addEventListener('click',function(){ openDrawer(s.id); highlightLineage(s.id); });
    bar.addEventListener('mouseenter',function(){ highlightLineage(s.id); });
    rowEls[s._row].appendChild(bar);
  });
}

function highlightLineage(id){
  var s=byId[id]; if(!s) return;
  var rel={}; rel[id]=1;
  (s.from||[]).forEach(function(k){rel[k]=1;});
  (s.to||[]).forEach(function(k){rel[k]=1;});
  Array.prototype.forEach.call(document.querySelectorAll('.tl-bar'),function(b){
    var on=rel[b.dataset.id];
    b.classList.toggle('dim',!on);
    b.classList.toggle('hl',b.dataset.id===id);
  });
  var box=$('lineageBox'); box.innerHTML='';
  function row(label,ids,selfName){
    var r=el('div','lin-row');
    r.appendChild(el('div','lin-lbl',label));
    var c=el('div','lin-chips');
    if(selfName){ c.appendChild(el('span','lin-chip self',esc(selfName))); }
    (ids||[]).forEach(function(k){
      var t=byId[k]; if(!t) return;
      var ch=el('button','lin-chip',esc(t.name));
      ch.addEventListener('click',function(){ openDrawer(k); highlightLineage(k); });
      c.appendChild(ch);
    });
    if(!(ids||[]).length && !selfName) c.appendChild(el('span','muted','—'));
    r.appendChild(c); box.appendChild(r);
  }
  row('当前',[],s.name);
  row('源自 ↑',s.from);
  row('影响 ↓',s.to);
}

/* ============ 画家与画作 ============ */
var PT = (window.AH_PAINTERS||[]).slice();
var ptById={}; PT.forEach(function(p){ ptById[p.id]=p; });
// 建立 流派id -> 画家档案 的索引
var ptByStyle={};
PT.forEach(function(p){
  (p.styles||[]).forEach(function(s){ (ptByStyle[s]=ptByStyle[s]||[]).push(p); });
});
function ptEra(p){
  var s=byId[(p.styles||[])[0]]; return s?s.era:'';
}
function ptStyleNames(p){
  return (p.styles||[]).map(function(k){ return byId[k]?byId[k].name:k; });
}
// 为画家挑一张 MET 图片（按其流派图库里匹配作者名，否则用流派首图）
function ptImage(p){
  var keys=(p.styles||[]);
  var surname=(p.nameEn||'').split(/\s+/).slice(-1)[0].toLowerCase();
  for(var i=0;i<keys.length;i++){
    var arr=MET[keys[i]]||[];
    for(var j=0;j<arr.length;j++){
      if(surname && (arr[j].artist||'').toLowerCase().indexOf(surname)>=0) return arr[j];
    }
  }
  for(var k=0;k<keys.length;k++){ if((MET[keys[k]]||[]).length) return MET[keys[k]][0]; }
  return null;
}

var PF={era:null,style:null,region:null};
var PMODE='painter';

function renderPFilters(){
  var box=$('pFilters'); if(!box) return;
  box.innerHTML='';
  function row(label,items,key){
    var r=el('div','frow');
    r.appendChild(el('div','flabel',label));
    var c=el('div','fchips');
    items.forEach(function(v){
      var ch=el('button','chip'+(PF[key]===v.val?' on':''),esc(v.label));
      ch.addEventListener('click',function(){
        PF[key]=(PF[key]===v.val?null:v.val); renderPFilters(); renderPainters();
      });
      c.appendChild(ch);
    });
    r.appendChild(c); box.appendChild(r);
  }
  var eras=[]; PT.forEach(function(p){ var e=ptEra(p); if(e&&eras.indexOf(e)<0)eras.push(e); });
  eras.sort(function(a,b){ return ERAS.indexOf(a)-ERAS.indexOf(b); });
  row('时期',eras.map(function(e){return {label:e,val:e};}),'era');

  var sts=[]; PT.forEach(function(p){ (p.styles||[]).forEach(function(s){ if(sts.indexOf(s)<0)sts.push(s); }); });
  sts.sort(function(a,b){ return (byId[a]?byId[a].start:0)-(byId[b]?byId[b].start:0); });
  row('流派',sts.map(function(s){return {label:byId[s]?byId[s].name:s,val:s};}),'style');

  var regs=[]; PT.forEach(function(p){
    var r=(p.region||'').split('·')[0].trim();
    if(r && regs.indexOf(r)<0) regs.push(r);
  });
  row('地域',regs.map(function(r){return {label:r,val:r};}),'region');
}

function ptPassing(){
  return PT.filter(function(p){
    if(PF.era && ptEra(p)!==PF.era) return false;
    if(PF.style && (p.styles||[]).indexOf(PF.style)<0) return false;
    if(PF.region && (p.region||'').indexOf(PF.region)!==0) return false;
    return true;
  });
}

function renderPainters(){
  var grid=$('pGrid'); if(!grid) return;
  grid.innerHTML='';
  var list=ptPassing();
  var nWorks=list.reduce(function(a,p){return a+p.works.length;},0);
  $('pCount').textContent = PMODE==='painter'
    ? (list.length+' 位画家 · '+nWorks+' 件代表作')
    : (nWorks+' 件作品 · 来自 '+list.length+' 位画家');
  grid.className = PMODE==='painter' ? 'painter-grid' : 'work-list';

  if(!list.length){
    grid.appendChild(el('div','empty-note','没有符合条件的画家，请调整筛选。'));
    return;
  }

  if(PMODE==='painter'){
    list.forEach(function(p){
      var c=el('div','pcard');
      var img=ptImage(p);
      var thumb=el('div','pcard-thumb');
      if(img){
        var im=el('img'); im.src=img.img; im.alt=p.name; im.loading='lazy';
        im.addEventListener('error',function(){ thumb.classList.add('no-img'); im.remove(); });
        thumb.appendChild(im);
      } else { thumb.classList.add('no-img'); }
      var era=ptEra(p);
      var badge=el('span','pcard-era',esc(era));
      badge.style.background=eraColor(era);
      thumb.appendChild(badge);
      c.appendChild(thumb);

      var b=el('div','pcard-body');
      b.appendChild(el('div','pcard-name',esc(p.name)));
      b.appendChild(el('div','pcard-meta',esc(p.nameEn+' · '+p.life)));
      b.appendChild(el('div','pcard-role',esc(p.role)));
      var tags=el('div','pcard-tags');
      ptStyleNames(p).forEach(function(n){ tags.appendChild(el('span','d-tag',esc(n))); });
      b.appendChild(tags);
      b.appendChild(el('div','pcard-works','代表作 '+p.works.length+' 件：'+esc(p.works.map(function(w){return w.title;}).join('、'))));
      c.appendChild(b);
      c.addEventListener('click',function(){ openPainter(p.id); });
      grid.appendChild(c);
    });
  } else {
    list.forEach(function(p){
      p.works.forEach(function(w){
        var c=el('div','wcard');
        var head=el('div','wcard-head');
        head.appendChild(el('span','wcard-title',esc(w.title)));
        if(w.titleEn) head.appendChild(el('span','wcard-en',esc(w.titleEn)));
        c.appendChild(head);
        c.appendChild(el('div','wcard-meta',esc(p.name+'　·　'+w.year+'　·　'+w.where)));
        c.appendChild(el('div','wcard-note',esc(w.note)));
        var f=el('div','wcard-foot');
        ptStyleNames(p).forEach(function(n){ f.appendChild(el('span','d-tag',esc(n))); });
        var lk=el('button','linkbtn','查看画家档案 →');
        lk.addEventListener('click',function(e){ e.stopPropagation(); openPainter(p.id); });
        f.appendChild(lk);
        c.appendChild(f);
        grid.appendChild(c);
      });
    });
  }
}

function openPainter(id){
  var p=ptById[id]; if(!p) return;
  var box=$('drawerInner'); box.innerHTML='';
  var era=ptEra(p);
  var tag=el('div','d-era',esc(era)); tag.style.background=eraColor(era);
  box.appendChild(tag);
  box.appendChild(el('h1','d-title',esc(p.name)));
  box.appendChild(el('div','d-sub',esc(p.nameEn)));
  box.appendChild(el('div','d-meta',esc(p.life+'　·　'+p.region)));
  box.appendChild(el('div','p-role-line',esc(p.role)));

  function sec(t){ var d=el('div','d-sec'); d.appendChild(el('h3',null,t)); box.appendChild(d); return d; }

  var st=sec('所属流派');
  var stc=el('div','lin-chips');
  (p.styles||[]).forEach(function(k){
    var s=byId[k]; if(!s) return;
    var ch=el('button','lin-chip',esc(s.name+' · '+s.yearLabel));
    ch.addEventListener('click',function(){ openDrawer(k); });
    stc.appendChild(ch);
  });
  st.appendChild(stc);

  sec('生平与艺术定位').appendChild(el('p','d-summary',esc(p.bio)));

  var wk=sec('代表作与赏析 · 共 '+p.works.length+' 件');
  var wl=el('div','pw-list');
  p.works.forEach(function(w,i){
    var it=el('div','pw-item');
    var h=el('div','pw-head');
    h.appendChild(el('span','pw-num',String(i+1)));
    var tt=el('div','pw-titles');
    tt.appendChild(el('div','pw-title',esc(w.title)));
    if(w.titleEn) tt.appendChild(el('div','pw-en',esc(w.titleEn)));
    h.appendChild(tt);
    it.appendChild(h);
    it.appendChild(el('div','pw-meta',esc([w.year,w.where].filter(Boolean).join('　·　'))));
    it.appendChild(el('div','pw-note',esc(w.note)));
    wl.appendChild(it);
  });
  wk.appendChild(wl);

  // 该画家所属流派的馆藏图（尽量匹配本人）
  var surname=(p.nameEn||'').split(/\s+/).slice(-1)[0].toLowerCase();
  var mine=[], others=[];
  (p.styles||[]).forEach(function(k){
    (MET[k]||[]).forEach(function(w){
      if(surname && (w.artist||'').toLowerCase().indexOf(surname)>=0) mine.push(w);
      else others.push(w);
    });
  });
  var show=mine.length?mine:others.slice(0,6);
  if(show.length){
    var g=sec(mine.length? '本人馆藏作品图 · 大都会艺术博物馆' : '同流派馆藏作品图 · 大都会艺术博物馆');
    if(!mine.length) g.appendChild(el('p','muted','该画家本人的作品在此馆藏中暂无公版图，以下为同流派其他作品，供风格参照。'));
    var grid=el('div','d-imgs');
    show.slice(0,9).forEach(function(w){
      var c=el('div','d-img-card');
      var im=el('img'); im.src=w.img; im.alt=w.title||''; im.loading='lazy';
      im.addEventListener('error',function(){ c.style.display='none'; });
      c.appendChild(im);
      c.appendChild(el('div','d-img-cap',esc((w.title||'无题').slice(0,32))+'<br><span style="color:var(--ink3)">'+esc((w.artist||'').slice(0,24))+'</span>'));
      c.addEventListener('click',function(){ openLightbox(w,byId[(p.styles||[])[0]]); });
      grid.appendChild(c);
    });
    g.appendChild(grid);
  }

  // 同流派其他画家
  var peers=[];
  (p.styles||[]).forEach(function(k){
    (ptByStyle[k]||[]).forEach(function(q){ if(q.id!==p.id && peers.indexOf(q)<0) peers.push(q); });
  });
  if(peers.length){
    var pr=sec('同流派其他画家');
    var pc=el('div','lin-chips');
    peers.slice(0,12).forEach(function(q){
      var ch=el('button','lin-chip',esc(q.name));
      ch.addEventListener('click',function(){ openPainter(q.id); });
      pc.appendChild(ch);
    });
    pr.appendChild(pc);
  }

  $('drawer').hidden=false; $('drawerMask').hidden=false;
  document.body.style.overflow='hidden';
  $('drawer').scrollTop=0;
}

/* ============ 图墙 ============ */
var F={era:null,region:null,subject:null,medium:null,style:null};
function uniq(key){
  var out=[];
  D.forEach(function(s){
    var v=s[key];
    (Array.isArray(v)?v:[v]).forEach(function(x){ if(x && out.indexOf(x)<0) out.push(x); });
  });
  return out;
}
function regionTop(){
  var out=[];
  D.forEach(function(s){
    var r=(s.region||'').split('·')[0].trim();
    if(r && out.indexOf(r)<0) out.push(r);
  });
  return out;
}

function renderFilters(){
  var box=$('filters'); box.innerHTML='';
  function mkRow(label,items,fkey,isSwatch){
    var r=el('div','frow');
    r.appendChild(el('div','flabel',label));
    var c=el('div','fchips');
    items.forEach(function(v){
      var ch=el('button','chip'+(F[fkey]===v?' on':''),esc(v));
      ch.addEventListener('click',function(){
        F[fkey]=(F[fkey]===v?null:v); renderFilters(); renderGallery();
      });
      c.appendChild(ch);
    });
    r.appendChild(c); box.appendChild(r);
  }
  mkRow('时期',ERAS,'era');
  mkRow('地域',regionTop(),'region');
  mkRow('题材',uniq('subjects'),'subject');
  mkRow('媒材',uniq('medium'),'medium');
}

function stylesPassing(){
  return D.filter(function(s){
    if(F.era && s.era!==F.era) return false;
    if(F.region && (s.region||'').indexOf(F.region)!==0) return false;
    if(F.subject && (s.subjects||[]).indexOf(F.subject)<0) return false;
    if(F.medium && (s.medium||[]).indexOf(F.medium)<0) return false;
    if(F.style && s.id!==F.style) return false;
    return true;
  });
}

function renderGallery(){
  var grid=$('galleryGrid'); grid.innerHTML='';
  var styles=stylesPassing();
  var items=[];
  styles.forEach(function(s){
    (MET[s.id]||[]).forEach(function(w){ items.push({w:w,s:s}); });
  });
  // 无公版图的流派：用风格示意卡占位，保证图墙不空白
  var schemaCards=[];
  styles.forEach(function(s){
    if(!(MET[s.id]||[]).length && (window.AH_SCHEMA||{})[s.id]) schemaCards.push(s);
  });
  $('galleryCount').textContent = items.length+' 件作品'+
    (schemaCards.length? ' + '+schemaCards.length+' 个风格示意':'')+'，来自 '+styles.length+' 个流派';
  if(!items.length && !schemaCards.length){
    grid.appendChild(el('div','empty-note',
      styles.length? '当前筛选下的流派暂无公版图片。<br><span class="muted">1930 年后的现代与当代作品多数仍在版权保护期，可切换到时间轴查看文字资料与代表作清单。</span>'
                   : '没有符合条件的流派，请调整筛选。'));
    return;
  }
  items.forEach(function(it){
    var w=it.w,s=it.s;
    var c=el('div','gcard');
    var img=el('img','gimg');
    img.src=w.img; img.alt=w.title||''; img.loading='lazy';
    img.addEventListener('click',function(){ openLightbox(w,s); });
    img.addEventListener('error',function(){ c.style.display='none'; });
    c.appendChild(img);
    var b=el('div','gbody');
    b.appendChild(el('div','gtitle',esc(w.title||'无题')));
    b.appendChild(el('div','gartist',esc(w.artist||'佚名')));
    b.appendChild(el('div','gmeta',esc([w.date,w.medium].filter(Boolean).join(' · ').slice(0,58))));
    var tag=el('div','gstyle',esc(s.name));
    tag.style.background=eraColor(s.era);
    tag.addEventListener('click',function(){ openDrawer(s.id); });
    b.appendChild(tag);
    c.appendChild(b);
    grid.appendChild(c);
  });
  schemaCards.forEach(function(s){
    var sch=window.AH_SCHEMA[s.id];
    var c=el('div','gcard');
    var sv=el('div','gimg gimg-schema',sch.svg);
    sv.addEventListener('click',function(){ openDrawer(s.id); });
    c.appendChild(sv);
    var b=el('div','gbody');
    b.appendChild(el('div','gtitle',esc(sch.label)));
    b.appendChild(el('div','gartist','风格示意 · 非原作'));
    b.appendChild(el('div','gmeta',esc(sch.desc)));
    var tag=el('div','gstyle',esc(s.name));
    tag.style.background=eraColor(s.era);
    tag.addEventListener('click',function(){ openDrawer(s.id); });
    b.appendChild(tag);
    c.appendChild(b);
    grid.appendChild(c);
  });
}
$('clearFilters').addEventListener('click',function(){
  F={era:null,region:null,subject:null,medium:null,style:null};
  renderFilters(); renderGallery();
});

/* ============ 对比 ============ */
function fillSelects(){
  [$('cmpA'),$('cmpB')].forEach(function(sel,idx){
    sel.innerHTML='';
    D.forEach(function(s){
      var o=el('option',null,esc(s.name+'（'+s.yearLabel+'）'));
      o.value=s.id; sel.appendChild(o);
    });
    sel.value = idx===0 ? 'impressionism' : 'post-impressionism';
    sel.addEventListener('change',renderCompare);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.cmp-presets .chip'),function(b){
    b.addEventListener('click',function(){
      $('cmpA').value=b.dataset.a; $('cmpB').value=b.dataset.b; renderCompare();
    });
  });
}
function renderCompare(){
  var grid=$('cmpGrid'); grid.innerHTML='';
  [$('cmpA').value,$('cmpB').value].forEach(function(id){
    var s=byId[id]; if(!s) return;
    var col=el('div','cmp-col');
    var tag=el('div','d-era',esc(s.era)); tag.style.background=eraColor(s.era);
    col.appendChild(tag);
    col.appendChild(el('h2',null,esc(s.name)));
    col.appendChild(el('div','cmp-en',esc(s.nameEn+' · '+s.yearLabel+' · '+s.region)));

    var s1=el('div','cmp-sec'); s1.appendChild(el('h4',null,'核心主张'));
    s1.appendChild(el('p',null,esc(s.summary.slice(0,240)+'…'))); col.appendChild(s1);

    var s2=el('div','cmp-sec'); s2.appendChild(el('h4',null,'识别要点'));
    var ul=el('ul'); (s.traits||[]).forEach(function(t){ ul.appendChild(el('li',null,esc(t))); });
    s2.appendChild(ul); col.appendChild(s2);

    var s3=el('div','cmp-sec'); s3.appendChild(el('h4',null,'代表画家'));
    s3.appendChild(el('p',null,esc((s.painters||[]).map(function(p){return p.name;}).join('、'))));
    col.appendChild(s3);

    var s4=el('div','cmp-sec'); s4.appendChild(el('h4',null,'典型色调'));
    var pr=el('div','pal-row');
    (s.palette||[]).forEach(function(c){ var q=el('div','pal-sq'); q.style.background=c; pr.appendChild(q); });
    s4.appendChild(pr); col.appendChild(s4);

    var s5=el('div','cmp-sec'); s5.appendChild(el('h4',null,'历史背景'));
    s5.appendChild(el('p',null,esc(s.context))); col.appendChild(s5);

    var btn=el('button','chip','查看完整资料 →');
    btn.style.marginTop='16px';
    btn.addEventListener('click',function(){ openDrawer(s.id); });
    col.appendChild(btn);
    grid.appendChild(col);
  });
}

/* ============ 术语 ============ */
function allTerms(){
  var out=[];
  D.forEach(function(s){
    (s.terms||[]).forEach(function(t){ out.push({t:t.t,d:t.d,sid:s.id,sname:s.name}); });
  });
  return out.sort(function(a,b){ return a.t.localeCompare(b.t,'zh'); });
}
function renderGlossary(){
  var q=($('glossarySearch').value||'').trim().toLowerCase();
  var list=$('glossaryList'); list.innerHTML='';
  var arr=allTerms().filter(function(x){
    return !q || (x.t+x.d+x.sname).toLowerCase().indexOf(q)>=0;
  });
  if(!arr.length){ list.appendChild(el('div','empty-note','没有匹配的术语。')); return; }
  arr.forEach(function(x){
    var c=el('div','gl-card');
    c.appendChild(el('div','gl-term',esc(x.t)));
    c.appendChild(el('div','gl-desc',esc(x.d)));
    var f=el('div','gl-from','出自：'+esc(x.sname));
    f.addEventListener('click',function(){ openDrawer(x.sid); });
    c.appendChild(f);
    list.appendChild(c);
  });
}
$('glossarySearch').addEventListener('input',renderGlossary);

/* ============ 详情抽屉 ============ */
function openDrawer(id){
  var s=byId[id]; if(!s) return;
  var box=$('drawerInner'); box.innerHTML='';

  var tag=el('div','d-era',esc(s.era)); tag.style.background=eraColor(s.era);
  box.appendChild(tag);
  box.appendChild(el('h1','d-title',esc(s.name)));
  box.appendChild(el('div','d-sub',esc(s.nameEn)));
  box.appendChild(el('div','d-meta',esc(s.yearLabel+'　·　'+s.region)));
  if(s.note) box.appendChild(el('div','d-note','说明：'+esc(s.note)));

  function sec(title){
    var d=el('div','d-sec'); d.appendChild(el('h3',null,title)); box.appendChild(d); return d;
  }

  sec('风格与主张').appendChild(el('p','d-summary',esc(s.summary)));

  var t=sec('识别要点 · 怎么一眼看出是这一派');
  var ul=el('ul','d-traits');
  (s.traits||[]).forEach(function(x){ ul.appendChild(el('li',null,esc(x))); });
  t.appendChild(ul);

  // MET 图片
  var imgs=MET[s.id]||[];
  if(imgs.length){
    var g=sec('馆藏作品图 · 大都会艺术博物馆');
    var grid=el('div','d-imgs');
    imgs.slice(0,9).forEach(function(w){
      var c=el('div','d-img-card');
      var im=el('img'); im.src=w.img; im.alt=w.title||''; im.loading='lazy';
      im.addEventListener('error',function(){ c.style.display='none'; });
      c.appendChild(im);
      c.appendChild(el('div','d-img-cap',esc((w.title||'无题').slice(0,34))+'<br><span style="color:var(--ink3)">'+esc((w.artist||'').slice(0,26))+'</span>'));
      c.addEventListener('click',function(){ openLightbox(w,s); });
      grid.appendChild(c);
    });
    g.appendChild(grid);
  }
  // 无公版图时给出风格示意
  var schema=(window.AH_SCHEMA||{})[s.id];
  if(schema){
    var sc=sec(imgs.length? '风格示意图' : '风格示意图 · 该流派无公版作品图');
    var wrap=el('div','schema-wrap');
    var box=el('div','schema-box',schema.svg);
    wrap.appendChild(box);
    var txt=el('div','schema-txt');
    txt.appendChild(el('div','schema-label',esc(schema.label)));
    txt.appendChild(el('div','schema-desc',esc(schema.desc)));
    txt.appendChild(el('div','schema-note','这是依据该流派形式特征绘制的抽象示意图，用于辅助理解构图与用色逻辑，并非原作复制。'+
      (imgs.length? '' : '该流派作品多数创作于 1930 年后，仍在版权保护期，故无公版图片可展示，可参考上方代表画作清单自行检索。')));
    wrap.appendChild(txt);
    sc.appendChild(wrap);
  }

  var p=sec('代表画家');
  var profiled=ptByStyle[s.id]||[];
  if(profiled.length){
    var pnote=el('p','muted','以下画家有完整档案（生平 + 代表作逐幅赏析），点击进入：');
    pnote.style.marginBottom='9px';
    p.appendChild(pnote);
    var pchips=el('div','lin-chips');
    pchips.style.marginBottom='14px';
    profiled.forEach(function(q){
      var ch=el('button','lin-chip',esc(q.name+'（'+q.works.length+'件赏析）'));
      ch.addEventListener('click',function(){ openPainter(q.id); });
      pchips.appendChild(ch);
    });
    p.appendChild(pchips);
  }
  var pl=el('div','p-list');
  (s.painters||[]).forEach(function(x){
    var i=el('div','p-item');
    i.appendChild(el('div','p-name',esc(x.name)+'<span class="p-life">'+esc(x.life)+'</span>'));
    i.appendChild(el('div','p-en',esc(x.nameEn)));
    if(x.note) i.appendChild(el('div','p-note',esc(x.note)));
    var prof=profiled.filter(function(q){ return q.name===x.name; })[0];
    if(prof){
      var b=el('button','linkbtn','查看完整档案与 '+prof.works.length+' 篇作品赏析 →');
      b.style.marginTop='6px';
      b.addEventListener('click',function(){ openPainter(prof.id); });
      i.appendChild(b);
    }
    pl.appendChild(i);
  });
  p.appendChild(pl);

  var w=sec('代表画作');
  var wl=el('div','w-list');
  (s.works||[]).forEach(function(x){
    var i=el('div','w-item');
    i.appendChild(el('span','w-t',esc(x.title)));
    i.appendChild(el('span','w-en',esc(x.titleEn||'')));
    i.appendChild(el('span','w-rest',esc([x.artist,x.year,x.where].filter(Boolean).join(' · '))));
    wl.appendChild(i);
  });
  w.appendChild(wl);

  sec('历史背景 · 为什么在此时出现').appendChild(el('p','d-summary',esc(s.context)));

  // 影响链
  var lin=sec('影响关系');
  function linRow(lbl,ids){
    if(!(ids||[]).length) return;
    var r=el('div','lin-row');
    r.appendChild(el('div','lin-lbl',lbl));
    var c=el('div','lin-chips');
    ids.forEach(function(k){
      var o=byId[k]; if(!o) return;
      var ch=el('button','lin-chip',esc(o.name));
      ch.addEventListener('click',function(){ openDrawer(k); });
      c.appendChild(ch);
    });
    r.appendChild(c); lin.appendChild(r);
  }
  linRow('源自 ↑',s.from); linRow('影响 ↓',s.to);
  if(!(s.from||[]).length && !(s.to||[]).length) lin.appendChild(el('p','muted','独立发展，无直接谱系记录。'));

  if((s.terms||[]).length){
    var tm=sec('相关术语');
    var tl=el('div','d-terms');
    s.terms.forEach(function(x){
      var d=el('div','d-term');
      d.appendChild(el('b',null,esc(x.t)));
      d.appendChild(el('span',null,esc(x.d)));
      tl.appendChild(d);
    });
    tm.appendChild(tl);
  }

  var meta=sec('题材与媒材');
  var tg=el('div','d-tags');
  (s.subjects||[]).concat(s.medium||[]).forEach(function(x){ tg.appendChild(el('span','d-tag',esc(x))); });
  meta.appendChild(tg);
  var pr=el('div','pal-row'); pr.style.marginTop='12px';
  (s.palette||[]).forEach(function(c){ var q=el('div','pal-sq'); q.style.background=c; q.title=c; pr.appendChild(q); });
  meta.appendChild(pr);

  var gb=el('button','chip','在图墙中只看这一派 →');
  gb.style.marginTop='22px';
  gb.addEventListener('click',function(){
    F={era:null,region:null,subject:null,medium:null,style:s.id};
    closeDrawer(); showView('gallery'); renderFilters(); renderGallery();
  });
  box.appendChild(gb);

  $('drawer').hidden=false; $('drawerMask').hidden=false;
  document.body.style.overflow='hidden';
  $('drawer').scrollTop=0;
}
function closeDrawer(){
  $('drawer').hidden=true; $('drawerMask').hidden=true;
  document.body.style.overflow='';
}
$('drawerClose').addEventListener('click',closeDrawer);
$('drawerMask').addEventListener('click',closeDrawer);

/* ============ 灯箱 ============ */
function openLightbox(w,s){
  $('lbImg').src=w.imgBig||w.img;
  $('lbImg').alt=w.title||'';
  $('lbCap').innerHTML=esc(w.title||'无题')+' · '+esc(w.artist||'佚名')+
    '<br><span style="color:#a9a294">'+esc([w.date,w.medium,s?s.name:''].filter(Boolean).join(' · '))+'</span>'+
    (w.url?'<br><a href="'+esc(w.url)+'" target="_blank" rel="noopener" style="color:#cbb;font-size:12px">在大都会博物馆查看原始记录 →</a>':'');
  $('lightbox').hidden=false;
  document.body.style.overflow='hidden';
}
function closeLightbox(){
  $('lightbox').hidden=true;
  if($('drawer').hidden) document.body.style.overflow='';
}
$('lbClose').addEventListener('click',closeLightbox);
$('lightbox').addEventListener('click',function(e){ if(e.target.id==='lightbox') closeLightbox(); });
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){ if(!$('lightbox').hidden) closeLightbox(); else if(!$('drawer').hidden) closeDrawer(); }
});

/* ============ 全局搜索 ============ */
function buildIndex(){
  var idx=[];
  D.forEach(function(s){
    idx.push({kind:'流派',label:s.name,sub:s.nameEn+' · '+s.yearLabel,sid:s.id,key:(s.name+s.nameEn+s.era+s.region).toLowerCase()});
    (s.terms||[]).forEach(function(t){
      idx.push({kind:'术语',label:t.t,sub:t.d.slice(0,42),sid:s.id,key:(t.t+t.d).toLowerCase()});
    });
  });
  // 画家档案与其代表作优先于流派内的简略名单
  PT.forEach(function(p){
    idx.push({kind:'画家',label:p.name,sub:p.nameEn+' · '+p.life+' · '+ptStyleNames(p).join('/'),pid:p.id,
      key:(p.name+p.nameEn+p.role+(p.region||'')).toLowerCase()});
    p.works.forEach(function(w){
      idx.push({kind:'作品',label:w.title,sub:p.name+' · '+w.year+' · 含赏析',pid:p.id,
        key:(w.title+(w.titleEn||'')+p.name).toLowerCase()});
    });
  });
  // 流派内未建档案的画家与作品，作为补充
  D.forEach(function(s){
    (s.painters||[]).forEach(function(q){
      var has=PT.some(function(p){ return p.name===q.name; });
      if(!has) idx.push({kind:'画家',label:q.name,sub:(q.nameEn||'')+' · '+s.name,sid:s.id,key:(q.name+(q.nameEn||'')).toLowerCase()});
    });
    (s.works||[]).forEach(function(w){
      var has=PT.some(function(p){ return p.works.some(function(x){ return x.title===w.title; }); });
      if(!has) idx.push({kind:'作品',label:w.title,sub:(w.artist||'')+' · '+s.name,sid:s.id,key:(w.title+(w.titleEn||'')+(w.artist||'')).toLowerCase()});
    });
  });
  return idx;
}
var IDX=buildIndex();
var si=$('globalSearch'), sr=$('searchResults');
si.addEventListener('input',function(){
  var q=si.value.trim().toLowerCase();
  if(!q){ sr.hidden=true; return; }
  var hits=IDX.filter(function(x){ return x.key.indexOf(q)>=0; }).slice(0,26);
  sr.innerHTML='';
  if(!hits.length){ sr.innerHTML='<div class="sr-item"><span class="muted">没有匹配结果</span></div>'; sr.hidden=false; return; }
  hits.forEach(function(h){
    var d=el('div','sr-item','<span class="sr-kind">'+h.kind+'</span><b>'+esc(h.label)+'</b><div class="sr-sub">'+esc(h.sub)+'</div>');
    d.addEventListener('click',function(){
      sr.hidden=true; si.value='';
      if(h.pid) openPainter(h.pid); else openDrawer(h.sid);
    });
    sr.appendChild(d);
  });
  sr.hidden=false;
});
document.addEventListener('click',function(e){
  if(!si.contains(e.target) && !sr.contains(e.target)) sr.hidden=true;
});

/* ============ 统计 ============ */
function stats(){
  var np=0,nt=0;
  D.forEach(function(s){ np+=(s.painters||[]).length; nt+=(s.terms||[]).length; });
  var extra=0;
  PT.forEach(function(p){ if(!D.some(function(s){return (s.painters||[]).some(function(q){return q.name===p.name;});})) extra++; });
  $('statStyles').textContent=D.length;
  $('statPainters').textContent=np+extra;
  var sp=$('statProfiles'); if(sp) sp.textContent=PT.length;
  var sn=$('statNotes'); if(sn) sn.textContent=PT.reduce(function(a,p){return a+p.works.length;},0);
  $('statTerms').textContent=nt;
}

/* ============ 启动 ============ */
renderLegend(); renderTimeline(); renderFilters(); renderPFilters(); fillSelects(); stats();
// 画家视图的模式切换与清除
Array.prototype.forEach.call(document.querySelectorAll('.pmode'),function(b){
  b.addEventListener('click',function(){
    PMODE=b.dataset.pmode;
    Array.prototype.forEach.call(document.querySelectorAll('.pmode'),function(x){
      x.classList.toggle('is-on',x.dataset.pmode===PMODE);
    });
    renderPainters();
  });
});
var pc=$('pClear');
if(pc) pc.addEventListener('click',function(){
  PF={era:null,style:null,region:null}; renderPFilters(); renderPainters();
});
if(D.length) highlightLineage(D[Math.min(14,D.length-1)].id);
loadMet().then(function(){
  renderTimeline();
  if(!$('view-gallery').hidden) renderGallery();
  if(!$('view-painters').hidden) renderPainters();
});

})();
