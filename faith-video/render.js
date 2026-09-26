"use strict";
/* ============ Family Tree of Faiths: vertical video renderer (1080x1920) ============ */
const FPS = 30, WIDTH = 1080, HEIGHT = 1920, CY = 885;

const FAMS = [
  {id:"anc", name:"Ancient & Iranian", arc:["ANCIENT &","IRANIAN"]},
  {id:"isl", name:"Islam", arc:["ISLAM"]},
  {id:"jud", name:"Judaism", arc:["JUDAISM"]},
  {id:"chr", name:"Christianity", arc:["CHRISTIANITY"]},
  {id:"afr", name:"African & diaspora", arc:["AFRICAN &","DIASPORA"]},
  {id:"ind", name:"Hindu, Jain & Sikh", arc:["HINDU, JAIN","& SIKH"]},
  {id:"bud", name:"Buddhism", arc:["BUDDHISM"]},
  {id:"eas", name:"Chinese & Japanese", arc:["CHINESE &","JAPANESE"]}
];
const COL = {anc:"#ff8fc2", isl:"#46d872", jud:"#5aaaff", chr:"#ff6464", afr:"#35e2b6", ind:"#ff8d42", bud:"#a898ff", eas:"#ffcb3d"};

/* lanes: id, fam, name, start, end, parent, link ("m" = grew out of), side, fuzzy, fadeEnd, splitEnd */
const D = [
 ["meso","anc","Mesopotamian religion",-3500,300,null,0,null,1],
 ["egypt","anc","Egyptian religion",-3100,550,null,0,null,1],
 ["aten","anc","Atenism",-1353,-1336,"egypt"],
 ["greco","anc","Greek & Roman gods",-1400,530,null,0,null,1],
 ["mithras","anc","Mithraism",80,400,"greco"],
 ["zoro","anc","Zoroastrianism",-1200,null,null,0,null,1],
 ["mani","anc","Manichaeism",240,1600,"zoro","m"],

 ["islam","isl","Islam",610,661,"jud","m",null,0,0,1],
 ["khawarij","isl","Kharijites / Ibadis",657,null,"islam",0,"up"],
 ["sunni","isl","Sunni Islam",661,null,"islam",0,"up"],
 ["ahmadi","isl","Ahmadiyya",1889,null,"sunni"],
 ["shia","isl","Shia Islam",661,null,"islam",0,"down"],
 ["zaydi","isl","Zaydis",740,null,"shia"],
 ["ismaili","isl","Ismailis",765,1094,"shia",0,null,0,0,1],
 ["druze","isl","Druze",1017,null,"ismaili"],
 ["nizari","isl","Nizari Ismailis",1094,null,"ismaili",0,"up"],
 ["mustali","isl","Musta’li Ismailis",1094,null,"ismaili",0,"down"],
 ["alawi","isl","Alawites",860,null,"shia"],
 ["babi","isl","Bábism",1844,1900,"shia"],
 ["bahai","isl","Baháʼí Faith",1863,null,"babi"],

 ["jud","jud","Israelite religion",-1200,null,null,0,"up",1],
 ["samar","jud","Samaritans",-400,null,"jud"],
 ["sadd","jud","Sadducees",-170,70,"jud"],
 ["essenes","jud","Essenes",-150,70,"jud"],
 ["karaite","jud","Karaite Judaism",760,null,"jud"],
 ["hasidic","jud","Hasidic Judaism",1740,null,"jud"],
 ["reform","jud","Reform Judaism",1810,null,"jud"],
 ["conserv","jud","Conservative Judaism",1845,null,"reform"],
 ["recon","jud","Reconstructionist",1922,null,"conserv"],

 ["xtrunk","chr","Early Christianity",30,1054,"jud",0,null,0,0,1],
 ["arian","chr","Arianism",318,700,"xtrunk"],
 ["coe","chr","Church of the East",431,null,"xtrunk"],
 ["chaldean","chr","Chaldean Catholics",1552,null,"coe"],
 ["orient","chr","Oriental Orthodox",451,null,"xtrunk"],
 ["catholic","chr","Catholic Church",1054,null,"xtrunk",0,"up"],
 ["orthodox","chr","Eastern Orthodox",1054,null,"xtrunk",0,"down"],
 ["oldbel","chr","Old Believers",1666,null,"orthodox"],
 ["cathar","chr","Cathars",1143,1321,"catholic"],
 ["waldo","chr","Waldensians",1173,null,"catholic"],
 ["hussite","chr","Hussites",1415,1620,"catholic"],
 ["moravian","chr","Moravian Church",1457,null,"hussite"],
 ["lutheran","chr","Lutherans",1517,null,"catholic"],
 ["reformed","chr","Reformed (Calvinist)",1519,null,"catholic"],
 ["anabap","chr","Anabaptists / Mennonites",1525,null,"reformed"],
 ["hutter","chr","Hutterites",1528,null,"anabap"],
 ["amish","chr","Amish",1693,null,"anabap"],
 ["presby","chr","Presbyterians",1560,null,"reformed"],
 ["unitar","chr","Unitarians",1565,null,"reformed"],
 ["congreg","chr","Congregationalists",1582,null,"reformed"],
 ["baptist","chr","Baptists",1609,null,"congreg"],
 ["quaker","chr","Quakers",1652,null,"congreg","m"],
 ["advent","chr","Adventists",1831,null,"baptist"],
 ["jw","chr","Jehovah’s Witnesses",1879,null,"advent","m"],
 ["anglican","chr","Anglicans",1534,null,"catholic"],
 ["method","chr","Methodists",1739,null,"anglican"],
 ["lds","chr","Latter Day Saints",1830,null,"method","m"],
 ["pente","chr","Pentecostals",1906,null,"method"],

 ["wafr","afr","West & Central African religions",-1000,null,null,0,null,1],
 ["vodou","afr","Haitian Vodou",1750,null,"wafr"],
 ["santeria","afr","Santería",1850,null,"wafr"],
 ["candom","afr","Candomblé",1830,null,"wafr"],
 ["rasta","afr","Rastafari",1930,null,null],

 ["hindu","ind","Vedic religion",-1500,null,null,0,"up",1],
 ["vaish","ind","Vaishnavism",-220,null,"hindu"],
 ["shaiva","ind","Shaivism",-180,null,"hindu"],
 ["shakta","ind","Shaktism",500,null,"hindu"],
 ["iskcon","ind","Hare Krishna (ISKCON)",1966,null,"vaish"],
 ["sikh","ind","Sikhism",1499,null,"hindu","m"],
 ["sramana","ind","Śramaṇa ascetics",-800,-400,null,0,"up",0,1],
 ["jain","ind","Jainism",-700,80,"sramana",0,null,0,0,1],
 ["digam","ind","Digambara Jains",80,null,"jain",0,"up"],
 ["svet","ind","Śvetāmbara Jains",80,null,"jain",0,"down"],
 ["ajivika","ind","Ājīvikas",-500,1400,"sramana"],

 ["ebud","bud","Buddhism",-500,-350,"sramana",0,null,0,0,1],
 ["thera","bud","Theravāda",-350,null,"ebud"],
 ["maha","bud","Mahāsāṃghika",-350,1100,"ebud"],
 ["mahayana","bud","Mahāyāna",-100,null,"maha","m"],
 ["pureland","bud","Pure Land",402,null,"mahayana"],
 ["tiantai","bud","Tiantai / Tendai",575,null,"mahayana"],
 ["nichiren","bud","Nichiren",1253,null,"tiantai"],
 ["chan","bud","Chan / Zen",600,null,"mahayana"],
 ["vajra","bud","Vajrayāna",650,null,"mahayana"],
 ["tibet","bud","Tibetan Buddhism",779,null,"vajra"],
 ["gelug","bud","Gelug",1409,null,"tibet"],

 ["cfolk","eas","Chinese folk religion",-1600,null,null,0,null,1],
 ["confu","eas","Confucianism",-500,null,"cfolk"],
 ["tao","eas","Taoism",-400,null,"cfolk"],
 ["quanzhen","eas","Quanzhen Taoism",1167,null,"tao"],
 ["shinto","eas","Shinto",-300,null,null,0,null,1],
 ["tenri","eas","Tenrikyo",1838,null,"shinto"],
 ["stshinto","eas","State Shinto",1868,1945,"shinto"]
].map((a, idx) => ({id:a[0], fam:a[1], name:a[2], start:a[3], end:a[4], parent:a[5] || null, link:a[6] || 0, side:a[7] || null, fuzzy:!!a[8], fadeEnd:!!a[9], splitEnd:!!a[10], idx}));
const byId = {}; D.forEach(l => byId[l.id] = l);

/* ---------------- captions (the story) ---------------- */
const CAPS = [
 [-3500,"meso","c. 3500 BCE","Temples of Sumer","In Mesopotamia’s first cities, priests serve gods such as Inanna and Enlil."],
 [-3100,"egypt","c. 3100 BCE","Gods of the Nile","Egypt unites under pharaohs who rule as sons of the sun god Ra."],
 [-1600,"cfolk","c. 1600 BCE","Oracle bones","In China, Shang kings consult their ancestors by carving questions into bone."],
 [-1500,"hindu","c. 1500 BCE","The Vedas","Hymns composed in northern India become the oldest roots of Hinduism."],
 [-1200,"jud","c. 1200 BCE","The Israelites","Worship of Yahweh takes hold in Canaan: the root of Judaism. Zoroastrianism in Iran may date from around this time."],
 [-700,"jain","c. 700 BCE","Harm no living thing","Wandering ascetics in India reject Vedic ritual. Jain teachers preach ahimsa: non-violence."],
 [-586,"jud","586 BCE","Exile in Babylon","Babylon destroys Jerusalem’s Temple. In exile, Israelite religion is reshaped into Judaism."],
 [-500,"ebud","c. 500 BCE","An age of sages","The Buddha teaches the path to awakening. In China, Confucius teaches and Daoist thought takes shape.","INDIA & CHINA"],
 [-100,"mahayana","c. 100 BCE","The Great Vehicle","Buddhism divides into schools. Mahāyāna arises, centered on the compassionate bodhisattva path."],
 [30,"xtrunk","c. 30 CE","Jesus of Nazareth","His followers form a movement within Judaism that becomes Christianity."],
 [70,"jud","70 CE","The Temple falls","Rome destroys the Second Temple. The rabbis rebuild Judaism around study, prayer and the synagogue."],
 [451,"orient","431–451 CE","Councils divide the East","Disputes over the nature of Christ split off the Church of the East and the Oriental Orthodox."],
 [540,"greco","6th century","The old gods fall silent","The last temples of Greece, Rome and Egypt close."],
 [610,"islam","610 CE","The Prophet Muhammad","In Mecca, Muhammad receives the first revelations of the Qur’an. Islam begins."],
 [661,"islam","661 CE","Sunni and Shia","A dispute over who should lead the Muslim community divides Islam."],
 [765,"ismaili","740–874 CE","Branches of Shia Islam","Zaydis, Ismailis and Twelvers follow different lines of Imams."],
 [1054,"xtrunk","1054","The Great Schism","Rome and Constantinople excommunicate each other: Catholic and Orthodox."],
 [1173,"waldo","1100s–1400s","Dissent in Europe","Cathars, Waldensians and Hussites challenge the Church. Some are crushed; some survive."],
 [1499,"sikh","c. 1500","Guru Nanak","In Punjab, Guru Nanak begins teaching, and Sikhism is born."],
 [1517,"lutheran","1517–1534","The Reformation","Luther, Zwingli, the Anabaptists and the Church of England break with Rome."],
 [1609,"baptist","1560–1693","Protestants multiply","Presbyterians, Baptists, Quakers, the Amish and others form their own churches."],
 [1739,"method","1739–1740","Revival","Methodism sweeps Britain while Hasidism sweeps Eastern Europe.","CHRISTIANITY & JUDAISM"],
 [1750,"vodou","1700s–1800s","Faiths of the African diaspora","In the Americas, enslaved Africans’ religions blend with Catholic saints: Vodou, Candomblé, Santería."],
 [1830,"lds","1810–1863","A century of new faiths","Reform Judaism, the Latter Day Saints, and in Iran the Báb and the Baháʼí Faith.","NEW MOVEMENTS"],
 [1906,"pente","1906","Pentecost, again","The Azusa Street Revival in Los Angeles launches Pentecostalism worldwide."],
 [2025,"catholic","2025","A pope from America","Leo XIV becomes the first pope from the United States."],
 [2026,null,"Today","Still growing","Some branches ended. Most are still growing."]
];
const T_START = 6.6;
const caps = [];
{ let t = T_START;
  for (const c of CAPS){
    const chars = c[3].length + c[4].length;
    const dur = Math.max(2.9, Math.min(3.8, 2.3 + 0.012*chars));
    caps.push({year:c[0], lane:c[1], when:c[2], title:c[3], text:c[4], tag:c[5] || null, t, dur});
    t += dur;
  }
}
const CAP_TODAY = caps[caps.length - 1];
const T_TODAY = CAP_TODAY.t;
const T_END = T_TODAY + 10.5;
const NFRAMES = Math.round(T_END * FPS);

/* ---------------- time mapping (monotone cubic) ---------------- */
function pchip(xs, ys){
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i+1] - ys[i]) / (xs[i+1] - xs[i]);
  m[0] = d[0]; m[n-1] = d[n-2];
  for (let i = 1; i < n - 1; i++){
    if (d[i-1]*d[i] <= 0) m[i] = 0;
    else { const h0 = xs[i]-xs[i-1], h1 = xs[i+1]-xs[i], w1 = 2*h1 + h0, w2 = h1 + 2*h0; m[i] = (w1 + w2)/(w1/d[i-1] + w2/d[i]); }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n-1]) return ys[n-1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1){ const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
    const h = xs[hi] - xs[lo], s = (x - xs[lo])/h, s2 = s*s, s3 = s2*s;
    return (2*s3 - 3*s2 + 1)*ys[lo] + (s3 - 2*s2 + s)*h*m[lo] + (-2*s3 + 3*s2)*ys[hi] + (s3 - s2)*h*m[hi];
  };
}
const yearAt = pchip(caps.map(c => c.t), caps.map(c => c.year));
function timeOfYear(y){
  let lo = T_START, hi = T_TODAY;
  if (y <= yearAt(lo)) return lo;
  for (let k = 0; k < 50; k++){ const mid = (lo + hi)/2; if (yearAt(mid) >= y) hi = mid; else lo = mid; }
  return hi;
}

/* ---------------- geometry ---------------- */
const RSEG = [[-3500,-1000,112,240],[-1000,0,240,440],[0,1500,440,735],[1500,2026,735,1000]];
function R(y){ for (const [a,b,r0,r1] of RSEG){ if (y <= b) return r0 + (Math.max(y,a) - a)/(b - a)*(r1 - r0); } return 1000; }
const CORE = 92, RMAX = 1000;

function place(n, dir){
  const kids = D.filter(k => k.parent === n.id && k.fam === n.fam);
  const desc = (a,b) => (b.start - a.start) || (a.idx - b.idx);
  const up = kids.filter(k => (k.side || dir) === "up").sort(desc);
  const down = kids.filter(k => (k.side || dir) === "down").sort(desc);
  let above = []; for (const k of up) above = place(k, "up").concat(above);
  let below = []; for (const k of down) below = below.concat(place(k, "down"));
  return above.concat([n], below);
}
const MIN_SLOTS = 10, GAP_SLOTS = 2;
const sectors = {};
let slot = 0;
for (const f of FAMS){
  const roots = D.filter(l => l.fam === f.id && (!l.parent || byId[l.parent].fam !== f.id));
  let rows = []; for (const r of roots) rows = rows.concat(place(r, r.side || "down"));
  const n = rows.length, slots = Math.max(n, MIN_SLOTS), off = (slots - n)/2;
  rows.forEach((l, i) => l.slot = slot + off + i);
  sectors[f.id] = {a0: slot - 0.5, a1: slot + slots - 0.5, n};
  slot += slots + GAP_SLOTS;
}
const DTH = 2*Math.PI / slot;
const TH0 = -((sectors.chr.a0 + sectors.chr.a1)/2) * DTH;
for (const l of D){
  l.th = TH0 + l.slot*DTH;
  l.tBirth = timeOfYear(l.start);
  l.tEnd = l.end != null ? timeOfYear(l.end) : Infinity;
}
for (const f of FAMS){ const s = sectors[f.id]; s.th = TH0 + ((s.a0 + s.a1)/2)*DTH; }
const polar = (r, th) => [r*Math.cos(th), r*Math.sin(th)];
for (const c of caps){ c.l = c.lane ? byId[c.lane] : null; }

/* ---------------- camera (precomputed, deterministic) ---------------- */
const S_INTRO = 2.4, S_FINAL = 0.415;
function capAt(t){ let c = null; for (const x of caps){ if (x.t <= t) c = x; else break; } return c; }
function camTarget(t){
  if (t < T_START - 0.4) return [0, 0, S_INTRO];
  if (t >= T_TODAY + 0.7) return [0, 0, S_FINAL];
  const y = yearAt(t), rNow = R(y);
  const sFit = 430 / (rNow + 64);
  const c = capAt(t);
  if (c && c.l){
    const [fx, fy] = polar(R(c.year), c.l.th);
    const k = 0.45;
    return [fx*k, fy*k, Math.max(0.46, Math.min(3.0, sFit*1.22))];
  }
  return [0, 0, Math.max(S_FINAL, Math.min(3.0, sFit))];
}
const CAM = [];
{ let cx = 0, cy = 0, ls = Math.log(S_INTRO);
  const dt = 1/FPS, kc = 1 - Math.exp(-dt/0.95), ks = 1 - Math.exp(-dt/1.15);
  for (let i = 0; i < NFRAMES; i++){
    const [tx, ty, ts] = camTarget(i/FPS);
    cx += (tx - cx)*kc; cy += (ty - cy)*kc; ls += (Math.log(ts) - ls)*ks;
    CAM.push([cx, cy, Math.exp(ls)]);
  }
}

/* ---------------- helpers ---------------- */
function hexRgb(h){ const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
const RGB = {}; for (const k in COL) RGB[k] = hexRgb(COL[k]);
function rgba(f, a){ const c = RGB[f]; return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function light(f, mix, a){ const c = RGB[f]; const m = v => Math.round(v + (255 - v)*mix); return `rgba(${m(c[0])},${m(c[1])},${m(c[2])},${a})`; }
const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp01(x); return x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2; };
function env(t, a, b, fi, fo){ return clamp01((t - a)/fi) * clamp01((b - t)/fo); }
function rng(seed){ let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function fmtYear(y){ y = Math.round(y); return y < 0 ? [String(-y), " BCE"] : (y < 1 ? ["1", " CE"] : (y < 1000 ? [String(y), " CE"] : [String(y), ""])); }

const cv = document.getElementById("c"), ctx = cv.getContext("2d");
const DISPLAY = '"Marcellus", Georgia, serif', BODY = '"Figtree", system-ui, sans-serif';

/* star field & grain (static) */
const stars = document.createElement("canvas"); stars.width = 1400; stars.height = 2300;
{ const g = stars.getContext("2d"), r = rng(7);
  for (let i = 0; i < 900; i++){
    const x = r()*1400, y = r()*2300, s = r() < 0.92 ? 0.7 + r()*0.9 : 1.6 + r()*1.2, a = 0.08 + r()*0.35;
    g.fillStyle = `rgba(${200 + r()*55|0},${205 + r()*50|0},255,${a})`; g.beginPath(); g.arc(x, y, s, 0, Math.PI*2); g.fill();
  }
}
const twinkles = []; { const r = rng(99); for (let i = 0; i < 70; i++) twinkles.push([r()*WIDTH, r()*HEIGHT, 1 + r()*1.6, r()*6.28, 0.6 + r()*1.6]); }
const grain = document.createElement("canvas"); grain.width = WIDTH; grain.height = HEIGHT;
{ const g = grain.getContext("2d"), id = g.createImageData(WIDTH, HEIGHT), r = rng(3);
  for (let i = 0; i < id.data.length; i += 4){ const v = 128 + (r() - 0.5)*40; id.data[i] = id.data[i+1] = id.data[i+2] = v; id.data[i+3] = 255; }
  g.putImageData(id, 0, 0);
}
const RINGS = [[-3000,""],[-2000,"2000 BCE"],[-1000,"1000 BCE"],[-500,""],[1,"1 CE"],[500,""],[1000,"1000"],[1500,"1500"],[1750,""],[2000,"2000"]];

/* ---------------- drawing ---------------- */
let S = 1, OX = 0, OY = 0;
function toS(x, y){ return [OX + x*S, OY + y*S]; }
function ptS(r, th){ return [OX + r*S*Math.cos(th), OY + r*S*Math.sin(th)]; }

function drawBackground(t, cam){
  const g = ctx.createRadialGradient(WIDTH/2, CY, 60, WIDTH/2, CY, 1250);
  g.addColorStop(0, "#0b0d18"); g.addColorStop(0.55, "#06070e"); g.addColorStop(1, "#020306");
  ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const px = -((cam[0]*0.05) % 160) - 160, py = -((cam[1]*0.05) % 190) - 190;
  ctx.globalAlpha = 0.85; ctx.drawImage(stars, px, py); ctx.globalAlpha = 1;
  for (const [x, y, s, ph, sp] of twinkles){
    const a = 0.15 + 0.45*Math.max(0, Math.sin(t*sp + ph));
    ctx.fillStyle = `rgba(230,236,255,${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI*2); ctx.fill();
  }
}

function drawRings(year, labelA){
  ctx.save();
  ctx.lineWidth = 1.2;
  let lastLabelY = 1e9;
  for (const [y, label] of RINGS){
    const r = R(y)*S, past = y <= year;
    ctx.strokeStyle = past ? "rgba(214,222,255,0.10)" : "rgba(214,222,255,0.035)";
    ctx.beginPath(); ctx.arc(OX, OY, r, 0, Math.PI*2); ctx.stroke();
    if (label && r > 60){
      const lx = OX, ly = OY - r - 8;
      if (ly > 360 && ly < 1380 && lastLabelY - ly > 30){
        lastLabelY = ly;
        ctx.font = `500 22px ${BODY}`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = past ? `rgba(214,222,255,${0.42*labelA})` : `rgba(214,222,255,${0.16*labelA})`;
        ctx.fillText(label, lx, ly);
      }
    }
  }
  ctx.restore();
}

function drawCore(t){
  const r = CORE*S, pulse = 1 + 0.06*Math.sin(t*1.7), gr = Math.min(r*1.9, 250)*pulse;
  const g = ctx.createRadialGradient(OX, OY, 0, OX, OY, gr);
  g.addColorStop(0, "rgba(255,244,220,0.55)"); g.addColorStop(0.35, "rgba(255,228,190,0.20)"); g.addColorStop(1, "rgba(255,220,180,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(OX, OY, gr, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = "rgba(255,236,205,0.18)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(OX, OY, r, 0, Math.PI*2); ctx.stroke();
}

function strokeGlow(f, pathFn, alive, dash){
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.setLineDash(dash || []);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(f, 0.06*alive); ctx.lineWidth = 16; pathFn(); ctx.stroke();
  ctx.strokeStyle = rgba(f, 0.16*alive); ctx.lineWidth = 6.5; pathFn(); ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = light(f, 0.28, 0.95*alive); ctx.lineWidth = 2.3; pathFn(); ctx.stroke();
  ctx.setLineDash([]);
}

function drawLanes(t, year){
  const rNow = R(year);
  for (const l of D){
    if (t < l.tBirth) continue;
    const f = l.fam, rS = R(l.start);
    const ended = l.end != null && year >= l.end;
    const rE = Math.min(R(l.end != null ? l.end : 2026), rNow);
    const fade = ended && !l.splitEnd ? 0.55 : 1;
    // fuzzy roots rising from the core
    if (l.fuzzy){
      const [x0, y0] = ptS(CORE, l.th), [x1, y1] = ptS(rS, l.th);
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, rgba(f, 0)); g.addColorStop(1, rgba(f, 0.75));
      ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.globalCompositeOperation = "source-over";
    }
    // connector arc from parent
    let arcDone = 1;
    if (l.parent){
      const p = byId[l.parent];
      arcDone = ease((t - l.tBirth)/0.6);
      const dth = l.th - p.th, th1 = p.th + dth*arcDone;
      strokeGlow(f, () => { ctx.beginPath(); ctx.arc(OX, OY, rS*S, p.th, th1, dth < 0); }, fade, l.link === "m" ? [0.1, 8] : null);
      // spark travelling along the arc
      if (arcDone < 1){
        const [sx, sy] = ptS(rS, th1);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 16);
        g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.4, rgba(f, 0.5)); g.addColorStop(1, rgba(f, 0));
        ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 16, 0, Math.PI*2); ctx.fill(); ctx.globalCompositeOperation = "source-over";
      }
    }
    // radial branch
    if (arcDone >= 1 && rE > rS + 0.5){
      const [x0, y0] = ptS(rS, l.th), [x1, y1] = ptS(rE, l.th);
      let fadeEndA = 1;
      if (l.fadeEnd && ended) fadeEndA = 0.35;
      strokeGlow(f, () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }, fade*fadeEndA);
    }
    // end tick for extinct lines
    if (ended && !l.splitEnd && !l.fadeEnd){
      const [ex, ey] = ptS(R(l.end), l.th), nx = -Math.sin(l.th)*7, ny = Math.cos(l.th)*7;
      ctx.strokeStyle = rgba(f, 0.8); ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(ex - nx, ey - ny); ctx.lineTo(ex + nx, ey + ny); ctx.stroke();
    }
    // branch point dot
    if (l.parent){
      const [bx, by] = ptS(rS, byId[l.parent].th);
      ctx.fillStyle = light(f, 0.35, 0.9*fade); ctx.beginPath(); ctx.arc(bx, by, 3.6, 0, Math.PI*2); ctx.fill();
    }
  }
}

function drawTips(t, year){
  const rNow = R(year);
  ctx.globalCompositeOperation = "lighter";
  for (const l of D){
    if (t < l.tBirth) continue;
    const f = l.fam;
    const alive = l.end == null || year < l.end;
    if (alive){
      if (l.parent && t - l.tBirth < 0.6) continue;
      const [x, y] = ptS(rNow, l.th);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 15);
      g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.3, rgba(f, 0.55)); g.addColorStop(1, rgba(f, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI*2); ctx.fill();
    } else if (!l.splitEnd && t - l.tEnd < 2.2){
      const k = 1 - (t - l.tEnd)/2.2, [x, y] = ptS(R(l.end), l.th);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
      g.addColorStop(0, `rgba(255,190,120,${0.9*k})`); g.addColorStop(0.4, rgba(f, 0.35*k)); g.addColorStop(1, rgba(f, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI*2); ctx.fill();
      const r = rng(l.idx*31 + 5);
      for (let i = 0; i < 7; i++){
        const dt = t - l.tEnd, vx = (r() - 0.5)*30, vy = -18 - r()*26;
        ctx.fillStyle = `rgba(255,${170 + r()*60|0},110,${0.8*k})`;
        ctx.beginPath(); ctx.arc(x + vx*dt, y + vy*dt, 1.6, 0, Math.PI*2); ctx.fill();
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

const CAP_LANES = new Set(caps.filter(c => c.l).map(c => c.l.id));
function drawBursts(t){
  ctx.globalCompositeOperation = "lighter";
  for (const l of D){
    const dt = t - l.tBirth;
    if (dt < 0 || dt > 1.4) continue;
    const f = l.fam;
    const pth = l.parent ? byId[l.parent].th : l.th;
    const [bx, by] = ptS(R(l.start), pth);
    const k = dt/1.4;
    ctx.strokeStyle = rgba(f, 0.7*(1 - k)); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, 6 + 50*ease(k), 0, Math.PI*2); ctx.stroke();
    if (CAP_LANES.has(l.id)){
      ctx.strokeStyle = light(f, 0.4, 0.45*(1 - k)); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx, by, 10 + 150*ease(k), 0, Math.PI*2); ctx.stroke();
    }
    const r = rng(l.idx*97 + 13), n = CAP_LANES.has(l.id) ? 26 : 14;
    for (let i = 0; i < n; i++){
      const a = r()*Math.PI*2, sp = 60 + r()*170, life = 0.6 + r()*0.8;
      if (dt > life) { r(); continue; }
      const d = sp*(1 - Math.exp(-dt*2.6))/2.6, q = 1 - dt/life;
      const x = bx + Math.cos(a)*d, y = by + Math.sin(a)*d, sz = 1.2 + r()*1.8;
      ctx.fillStyle = light(f, 0.5, 0.9*q); ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawFrontRing(year, a){
  const r = R(year)*S;
  ctx.strokeStyle = `rgba(255,240,215,${0.05*a})`; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(OX, OY, r, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = `rgba(255,240,215,${0.12*a})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(OX, OY, r, 0, Math.PI*2); ctx.stroke();
}

function drawBranchLabels(t, year, alpha){
  if (alpha <= 0) return;
  const items = [];
  const rNow = R(year);
  for (const l of D){
    const dt = t - l.tBirth;
    let a = 0, text = l.name, dim = false, r = rNow;
    if (dt >= 0 && dt < 3.6){ a = clamp01(dt/0.35)*clamp01((3.6 - dt)/0.9); }
    if (l.end != null && !l.splitEnd && !l.fadeEnd){
      const de = t - l.tEnd;
      if (de >= 0 && de < 2.6){ const b = clamp01(de/0.3)*clamp01((2.6 - de)/0.8); if (b > a){ a = b; text = l.name + " ends"; dim = true; r = R(l.end); } }
    }
    if (a <= 0.01) continue;
    if (!dim && l.end != null && year >= l.end) r = R(l.end);
    const [x, y] = ptS(r, l.th);
    const c = Math.cos(l.th), s = Math.sin(l.th);
    const off = 20;
    let ax = x + c*off, ay = y + s*off, align = c > 0.25 ? "left" : (c < -0.25 ? "right" : "center");
    if (align === "center") ay += s > 0 ? 18 : -18;
    const stage = clamp01((ay - 360)/50)*clamp01((1390 - ay)/50);
    if (stage <= 0) continue;
    items.push({l, text, a: a*alpha*stage, dim, x: ax, y: ay, align, side: align === "left" ? 1 : (align === "right" ? -1 : 0)});
  }
  // de-overlap per side
  ctx.font = `600 32px ${BODY}`;
  for (const it of items){ it.w = ctx.measureText(it.text).width; }
  for (let iter = 0; iter < 6; iter++){
    items.sort((p, q) => p.y - q.y);
    for (let i = 1; i < items.length; i++){
      for (let j = 0; j < i; j++){
        const p = items[j], q = items[i];
        const px0 = p.align === "left" ? p.x : p.align === "right" ? p.x - p.w : p.x - p.w/2, px1 = px0 + p.w;
        const qx0 = q.align === "left" ? q.x : q.align === "right" ? q.x - q.w : q.x - q.w/2, qx1 = qx0 + q.w;
        if (px1 < qx0 - 8 || qx1 < px0 - 8) continue;
        const dy = q.y - p.y;
        if (dy < 40){ const push = (40 - dy)/2; p.y -= push; q.y += push; }
      }
    }
  }
  ctx.textBaseline = "middle";
  for (const it of items){
    const x0 = it.align === "left" ? it.x : it.align === "right" ? it.x - it.w : it.x - it.w/2;
    if (x0 < 28) it.x += 28 - x0;
    if (x0 + it.w > WIDTH - 28) it.x -= x0 + it.w - (WIDTH - 28);
    ctx.textAlign = it.align;
    ctx.font = it.dim ? `italic 500 28px ${BODY}` : `600 32px ${BODY}`;
    ctx.lineJoin = "round"; ctx.lineWidth = 8; ctx.strokeStyle = `rgba(4,5,10,${0.85*it.a})`;
    ctx.strokeText(it.text, it.x, it.y);
    ctx.fillStyle = it.dim ? `rgba(176,182,198,${it.a})` : light(it.l.fam, 0.72, it.a);
    ctx.fillText(it.text, it.x, it.y);
  }
}

function wrap(text, maxW){
  const words = text.split(" "), lines = []; let cur = "";
  for (const w of words){ const test = cur ? cur + " " + w : w; if (ctx.measureText(test).width > maxW && cur){ lines.push(cur); cur = w; } else cur = test; }
  if (cur) lines.push(cur); return lines;
}

function drawScrims(){
  let g = ctx.createLinearGradient(0, 0, 0, 460);
  g.addColorStop(0, "rgba(3,4,9,0.97)"); g.addColorStop(0.62, "rgba(3,4,9,0.93)"); g.addColorStop(1, "rgba(3,4,9,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, 460);
  g = ctx.createLinearGradient(0, 1330, 0, HEIGHT);
  g.addColorStop(0, "rgba(3,4,9,0)"); g.addColorStop(0.28, "rgba(3,4,9,0.9)"); g.addColorStop(1, "rgba(3,4,9,0.97)");
  ctx.fillStyle = g; ctx.fillRect(0, 1330, WIDTH, HEIGHT - 1330);
}

let digitW = 0;
function drawYear(year, a){
  if (a <= 0) return;
  const [num, suf] = fmtYear(year);
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = `104px ${DISPLAY}`; ctx.textBaseline = "alphabetic";
  if (!digitW){ let mx = 0; for (const d of "0123456789") mx = Math.max(mx, ctx.measureText(d).width); digitW = mx*0.9; }
  ctx.font = `64px ${DISPLAY}`; const sw = suf ? ctx.measureText(suf).width : 0;
  const total = num.length*digitW + sw, x0 = WIDTH/2 - total/2, y = 214;
  ctx.fillStyle = "#f3eee4";
  ctx.font = `104px ${DISPLAY}`; ctx.textAlign = "center";
  for (let i = 0; i < num.length; i++) ctx.fillText(num[i], x0 + digitW*(i + 0.5), y);
  if (suf){ ctx.font = `64px ${DISPLAY}`; ctx.textAlign = "left"; ctx.fillStyle = "#d9d2c3"; ctx.fillText(suf, x0 + num.length*digitW, y); }
  ctx.restore();
}
function drawProgress(year, a, living){
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const x0 = 180, x1 = 900, y = 272, p = (R(year) - R(-3500))/(RMAX - R(-3500));
  ctx.strokeStyle = "rgba(230,226,215,0.22)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  ctx.strokeStyle = "rgba(255,236,200,0.75)"; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (x1 - x0)*p, y); ctx.stroke();
  const g = ctx.createRadialGradient(x0 + (x1 - x0)*p, y, 0, x0 + (x1 - x0)*p, y, 12);
  g.addColorStop(0, "rgba(255,250,235,1)"); g.addColorStop(1, "rgba(255,230,190,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x0 + (x1 - x0)*p, y, 12, 0, Math.PI*2); ctx.fill();
  ctx.font = `600 21px ${BODY}`; ctx.fillStyle = "rgba(230,226,215,0.55)"; ctx.textBaseline = "top";
  ctx.textAlign = "left"; ctx.fillText("3500 BCE", x0, y + 14);
  ctx.textAlign = "right"; ctx.fillText("TODAY", x1, y + 14);
  ctx.textAlign = "center"; ctx.letterSpacing = "3px"; ctx.fillStyle = "rgba(230,226,215,0.8)";
  if (living > 0) ctx.fillText(`${living} LIVING ${living === 1 ? "BRANCH" : "BRANCHES"}`, WIDTH/2, y + 14);
  ctx.letterSpacing = "0px";
  ctx.restore();
}

function drawCaption(t){
  let c = null;
  for (const x of caps){ if (x.t <= t + 0.001) c = x; else break; }
  if (!c) return;
  const end = c === CAP_TODAY ? c.t + 3.4 : c.t + c.dur;
  const a = env(t, c.t + 0.05, end - 0.05, 0.35, 0.3);
  if (a <= 0) return;
  const slide = (1 - ease(clamp01((t - c.t)/0.45)))*16;
  ctx.save(); ctx.globalAlpha = a;
  const X = 84, maxW = WIDTH - 2*X;
  let y = 1532 + slide;
  const famName = c.tag || (c.l ? FAMS.find(f => f.id === c.l.fam).name.toUpperCase() : "5,500 YEARS");
  ctx.font = `700 25px ${BODY}`; ctx.letterSpacing = "4px"; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  if (c.l){ ctx.strokeStyle = COL[c.l.fam]; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(X, y - 9); ctx.lineTo(X + 34, y - 9); ctx.stroke(); }
  ctx.fillStyle = "rgba(226,222,212,0.78)"; ctx.fillText(`${c.when.toUpperCase()}  ·  ${famName}`, X + (c.l ? 52 : 0), y);
  ctx.letterSpacing = "0px";
  y += 78;
  ctx.font = `66px ${DISPLAY}`; ctx.fillStyle = "#f6f1e7";
  const tl = wrap(c.title, maxW);
  for (const line of tl){ ctx.fillText(line, X, y); y += 72; }
  y += 2;
  ctx.font = `400 37px ${BODY}`; ctx.fillStyle = "rgba(226,222,212,0.9)";
  for (const line of wrap(c.text, maxW)){ ctx.fillText(line, X, y); y += 50; }
  ctx.restore();
}

function drawArcText(text, r, thC, size, alpha, flipSide){
  ctx.font = `700 ${size}px ${BODY}`; ctx.letterSpacing = "0px";
  const sp = size*0.16;
  const widths = [...text].map(ch => ctx.measureText(ch).width + sp);
  const total = widths.reduce((a, b) => a + b, 0) - sp;
  const bottom = flipSide;
  let th = bottom ? thC + total/(2*r) : thC - total/(2*r);
  ctx.fillStyle = `rgba(244,240,230,${alpha})`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  [...text].forEach((ch, i) => {
    const w = widths[i], half = (w - (i === widths.length - 1 ? 0 : sp))/2;
    th += (bottom ? -1 : 1)*half/r;
    const x = OX + r*Math.cos(th), y = OY + r*Math.sin(th);
    ctx.save(); ctx.translate(x, y); ctx.rotate(bottom ? th - Math.PI/2 : th + Math.PI/2); ctx.fillText(ch, 0, 0); ctx.restore();
    th += (bottom ? -1 : 1)*(w - half)/r;
  });
}
function drawFamilyArcs(t){
  const t0 = T_TODAY + 2.1;
  if (t < t0) return;
  FAMS.forEach((f, i) => {
    const a = clamp01((t - t0 - i*0.16)/0.7);
    if (a <= 0) return;
    const sec = sectors[f.id], th = sec.th;
    const bottom = Math.sin(th) > 0.05;
    const base = (RMAX + 44)*S, size = 25, lineGap = 31;
    // arc stroke marking the sector
    ctx.strokeStyle = rgba(f.id, 0.55*a); ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(OX, OY, (RMAX + 16)*S, TH0 + (sec.a0 + 0.3)*DTH, TH0 + (sec.a1 - 0.3)*DTH); ctx.stroke();
    const lines = f.arc;
    lines.forEach((ln, j) => {
      const r = bottom ? base + (j)*lineGap + 6 : base + (lines.length - 1 - j)*lineGap;
      drawArcText(ln, r, th, size, 0.92*a, bottom);
    });
  });
}

function drawIntro(t){
  const a = env(t, 0.5, 4.8, 0.9, 0.9);
  if (a > 0){
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = `600 26px ${BODY}`; ctx.letterSpacing = "8px"; ctx.fillStyle = "rgba(236,228,210,0.72)";
    ctx.fillText("5,500 YEARS IN ONE TREE", WIDTH/2, 640);
    ctx.letterSpacing = "0px";
    ctx.font = `112px ${DISPLAY}`; ctx.fillStyle = "#f7f1e5";
    ctx.fillText("The Family Tree", WIDTH/2, 1330);
    ctx.fillText("of Faiths", WIDTH/2, 1448);
    ctx.font = `400 36px ${BODY}`; ctx.fillStyle = "rgba(230,224,210,0.82)";
    ctx.fillText("How the world’s religions were born and branched", WIDTH/2, 1530);
    ctx.restore();
  }
  const b = env(t, 4.9, 8.4, 0.8, 0.8);
  if (b > 0){
    ctx.save(); ctx.globalAlpha = b; ctx.textAlign = "center";
    ctx.font = `italic 400 30px ${BODY}`; ctx.fillStyle = "rgba(240,228,205,0.8)";
    ctx.fillText("Before writing: countless beliefs we can’t trace", WIDTH/2, CY + CORE*S + 110);
    ctx.restore();
  }
}
function drawOutro(t){
  const a = clamp01((t - (T_TODAY + 3.6))/1.0);
  if (a > 0){
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = `80px ${DISPLAY}`; ctx.fillStyle = "#f7f1e5";
    ctx.fillText("The Family Tree of Faiths", WIDTH/2, 206);
    ctx.font = `600 25px ${BODY}`; ctx.letterSpacing = "5px"; ctx.fillStyle = "rgba(236,228,210,0.72)";
    ctx.fillText("91 TRADITIONS · 8 FAMILIES · 5,500 YEARS", WIDTH/2, 280);
    ctx.letterSpacing = "0px";
    ctx.font = `400 34px ${BODY}`; ctx.fillStyle = "rgba(236,230,216,0.86)";
    ctx.fillText("Some branches ended. Most are still growing.", WIDTH/2, 1640);
    ctx.font = `400 25px ${BODY}`; ctx.fillStyle = "rgba(210,206,196,0.55)";
    ctx.fillText("Dates are approximate, and many are debated.", WIDTH/2, 1712);
    ctx.restore();
  }
}

function drawFrame(i){
  const t = i/FPS, cam = CAM[Math.min(i, CAM.length - 1)];
  S = cam[2]; OX = WIDTH/2 - cam[0]*S; OY = CY - cam[1]*S;
  const year = yearAt(t);
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.setLineDash([]);
  drawBackground(t, cam);
  drawRings(year, clamp01(1 - (t - T_TODAY - 0.5)/1.2));
  drawCore(t);
  if (t >= T_START - 0.2) drawFrontRing(year, t < T_TODAY + 1 ? 1 : clamp01(1 - (t - T_TODAY - 1)/1.5));
  drawLanes(t, year);
  drawTips(t, year);
  drawBursts(t);
  drawBranchLabels(t, year, t < T_TODAY + 1.2 ? 1 : clamp01(1 - (t - T_TODAY - 1.2)/0.8));
  drawFamilyArcs(t);
  drawScrims();
  const living = D.filter(l => t >= l.tBirth && (l.end == null || year < l.end) && !(l.splitEnd && year >= l.end)).length;
  const hud = env(t, 4.6, T_TODAY + 3.3, 1.0, 0.8);
  drawYear(year, hud);
  drawProgress(year, hud, living);
  drawCaption(t);
  drawIntro(t);
  drawOutro(t);
  // grain + fades
  ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = 0.07; ctx.drawImage(grain, 0, 0);
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  const fadeIn = 1 - clamp01(t/0.9), fadeOut = clamp01((t - (T_END - 1.8))/1.6);
  const k = Math.max(fadeIn, fadeOut);
  if (k > 0){ ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
}

window.VIDEO = {
  frames: NFRAMES, fps: FPS, duration: T_END,
  frame(i, q){ drawFrame(i); return cv.toDataURL("image/jpeg", q || 0.94); },
  draw(i){ drawFrame(i); return true; },
  timeline(){
    return {
      duration: T_END, tToday: T_TODAY, tStart: T_START,
      caps: caps.map(c => ({t: c.t, fam: c.l ? c.l.fam : null, dur: c.dur})),
      births: D.map(l => ({t: l.tBirth, fam: l.fam, cap: CAP_LANES.has(l.id)})),
      ends: D.filter(l => l.end != null && !l.splitEnd && !l.fadeEnd).map(l => ({t: l.tEnd, fam: l.fam}))
    };
  }
};
