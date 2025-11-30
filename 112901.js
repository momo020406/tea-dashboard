/* ===================================================================
   ⭐ 全部放進 DOMContentLoaded（確保所有元件載入完成）
   =================================================================== */
window.addEventListener("DOMContentLoaded",()=>{

/* ============================================================
   1. 通知開關（LocalStorage）
   ============================================================ */
let NOTIFY_ENABLED = true;

if(localStorage.getItem("tea_notify")==="off"){
  NOTIFY_ENABLED=false;
}

function updateNotifyUI(){
  const btn=document.getElementById("btnToggleNotify");
  const st =document.getElementById("notifyStatus");

  if(NOTIFY_ENABLED){
    btn.classList.add("on");
    st.textContent="通知：已開啟";
  }else{
    btn.classList.remove("on");
    st.textContent="通知：已關閉";
  }
}
updateNotifyUI();

document.getElementById("btnToggleNotify").onclick=()=>{
  NOTIFY_ENABLED=!NOTIFY_ENABLED;
  localStorage.setItem("tea_notify",NOTIFY_ENABLED?"on":"off");
  updateNotifyUI();
};

/* ============================================================
   2. 通知（含 LINE + Web）
   ============================================================ */
async function sendNotification(title, body) {
  if(!NOTIFY_ENABLED) return;

  if(Notification.permission!=="granted"){
    const perm=await Notification.requestPermission();
    if(perm!=="granted") return;
  }

  new Notification(title,{
    body,
    icon:"https://img.icons8.com/color/96/tea.png"
  });
}

// 您的網頁程式碼片段
function sendLineNotify(title,message){
  if(!NOTIFY_ENABLED) return;

  fetch("https://script.google.com/macros/s/AKfycby6kJ61k4OqXD6tcRFGOdazemtFYt8bqEXZhv0NU0qS-pIlXaoN1WkIQb9J6uFJUyTS/exec",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:`title=${encodeURIComponent(title)}&message=${encodeURIComponent(message)}`
  });
}

function alertTea(title,message){
  if(!NOTIFY_ENABLED) return;
  sendNotification(title,message);
  sendLineNotify(title,message);
  console.log("[AI 通知] ",title,message);
}

/* ============================================================
   3. AI 警報規則 (已更新為 Line 彙整報告模式)
   ============================================================ */
const ALERT_RULES={
  moisture:{low:20},
  temperature:{high:35,low:10},
  npk:{min:1,low:20}, // 舊有規則，保留作為 UI 顏色判斷
  rain:{min:0.1},
  offline:{limitMinutes:10}
};

/* 針對 LINE 報告新增的規則與建議 */
const AI_RULES={
  temp:{
    high:{ threshold:35, emoji:"🔥 過高", suggestion:"遮陰、灑水降溫" },
    low:{ threshold:10, emoji:"❄ 過低", suggestion:"保溫" }
  },
  moist:{
    low:{ threshold:20, emoji:"💧 偏低", suggestion:"立即灌溉" }
  },
  N:{
    low:{ threshold:10, emoji:"🔴 嚴重偏低", suggestion:"補充氮肥（尿素）" }
  },
  P:{
    low:{ threshold:6, emoji:"🔴 嚴重偏低", suggestion:"補充磷肥（過磷酸鈣）" }
  },
  K:{
    low:{ threshold:8, emoji:"🔴 嚴重偏低", suggestion:"補充鉀肥（硫酸鉀）" }
  }
};

/* ============================================================
   4. config
   ============================================================ */
const CONFIG={
  sheetCsvUrl:"https://docs.google.com/spreadsheets/d/e/2PACX-1vTS7HeQa-EF65JqRoZufcn3U6msKU7NSr0QqPezgqcuCHousSsK8z_IBHkdGvLNU0XZTcreLfnBwL0M/pub?output=csv",
  cwaAuth:"CWA-4A8A0D9D-95EA-4DA0-A62C-2DC7A8909F06",
  cwaStation:"C0I410",
  autoRefreshMinutes:1,
  stationCount:4,
  reportIntervalMinutes:1 // 限制 AI 診斷報告發送頻率
};

/* ============================================================
   5. 時間工具
   ============================================================ */
function pad(n){return n<10?"0"+n:n}
function nowStr(){
  const d=new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function dateStr(){
  const d=new Date();
  const w=["日","一","二","三","四","五","六"][d.getDay()];
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}（週${w}）`;
}
function roundInt(x){
  if(x==null||x==="") return "—";
  const n=Number(x);
  return isFinite(n)?Math.round(n):String(x);
}
/* 判斷是否為有效數字 */
function isValidNum(v){
  return v !== "—" && isFinite(Number(v));
}

/* ============================================================
   6. AI 通知狀態記錄（改為記錄上次發送時間）
   ============================================================ */
// 上次發送完整 AI 報告的時間
let lastSentReport = 0;
// 上次發送雨量通知的時間
let lastRainNotify = 0;
// 上次發送掉線通知的時間
let lastOfflineNotify = 0;

/* ============================================================
   7. 診斷核心與報告生成
   ============================================================ */
let lastStationData = []; // 儲存上次更新的資料，供診斷使用
let weatherRain = 0; // 儲存降雨量

/* 檢查降雨 (獨立於站點診斷) */
function checkRain(v){
  const rain = Number(v || 0);
  if(rain >= ALERT_RULES.rain.min && Date.now() - lastRainNotify > 3600000){ // 1 小時內只發一次
    alertTea("🌧 開始下雨",`名間降雨量：${rain} mm`);
    lastRainNotify = Date.now();
  }
  weatherRain = rain;
}

/* 檢查感測器離線狀態 */
let lastUpdateTime=Date.now();
function checkOffline(){
  const limitMs=ALERT_RULES.offline.limitMinutes*60*1000;
  if(Date.now()-lastUpdateTime>limitMs && Date.now() - lastOfflineNotify > 300000){ // 5 分鐘內只發一次
    alertTea("⚠ 感測器掉線",`已 ${ALERT_RULES.offline.limitMinutes} 分鐘無更新`);
    lastOfflineNotify = Date.now();
  }
}
setInterval(checkOffline,10000);

/* AI 診斷並生成報告 */
function runAIDiagnosisAndReport(){
  const totalMinutes = CONFIG.reportIntervalMinutes;
  // 檢查發送頻率 (10 分鐘內只發送一次)
  if(Date.now() - lastSentReport < totalMinutes * 60 * 1000) return;

  const allStationProblems = [];

  // 遍歷所有站點
  for(let s=1;s<=CONFIG.stationCount;s++){
    const station = lastStationData[s-1];
    if(!station) continue;

    const problems = []; // 該站點所有問題
    const {temp, moist, N, P, K} = station;

    // 檢查土壤溫度
    if(isValidNum(temp)){
      if(Number(temp) >= AI_RULES.temp.high.threshold)
        problems.push(`土壤溫度：${temp} ${AI_RULES.temp.high.emoji}\n→ 建議：${AI_RULES.temp.high.suggestion}`);
      else if(Number(temp) <= AI_RULES.temp.low.threshold)
        problems.push(`土壤溫度：${temp} ${AI_RULES.temp.low.emoji}\n→ 建議：${AI_RULES.temp.low.suggestion}`);
    }

    // 檢查含水率
    if(isValidNum(moist) && Number(moist) < AI_RULES.moist.low.threshold)
      problems.push(`含水率：${moist} ${AI_RULES.moist.low.emoji}\n→ 建議：${AI_RULES.moist.low.suggestion}`);

    // 檢查 NPK
    [
      {key:'N', val:N}, {key:'P', val:P}, {key:'K', val:K}
    ].forEach(({key,val})=>{
      if(isValidNum(val) && Number(val) < AI_RULES[key].low.threshold){
        problems.push(
          `${key}：${val} ${AI_RULES[key].low.emoji}\n→ 建議：${AI_RULES[key].low.suggestion}`.replace("N","氮").replace("P","磷").replace("K","鉀")
        );
      }
    });

    // 彙整站點結果
    if(problems.length > 0){
      allStationProblems.push(`【第${s}站】\n${problems.join('\n\n')}`);
    }else{
      allStationProblems.push(`【第${s}站】\n🟢 全部正常`);
    }
  }

  // 生成最終報告
  const header = "📡 瑞成智慧茶園 AI 養分與土壤診斷報告\n（依站點排序）\n\n";
  const reportBody = allStationProblems.join('\n\n');

  // 報告與上次不同才發送
  if(localStorage.getItem("lastReportBody") !== reportBody){
    const fullReport = header + reportBody;
    alertTea("智慧茶園 AI 診斷", fullReport);

    localStorage.setItem("lastReportBody", reportBody);
    lastSentReport = Date.now();
  }else{
    // 即使報告相同，如果超過 24 小時，也發送一次「全部正常」的報告
    if(Date.now() - lastSentReport > 24 * 60 * 60 * 1000){
      alertTea("智慧茶園 AI 診斷", fullReport);
      lastSentReport = Date.now();
    }
  }
}


/* ============================================================
   8. 數值顏色 (保留原邏輯供 Dashboard UI 使用)
   ============================================================ */
function colorClass(type,v){
  if(v==="—"||v==null||v==="") return "";
  v=Number(v);
  switch(type){
    case "temp":
      if(v<ALERT_RULES.temperature.low) return "val-warn";
      if(v<28) return "val-ok";
      if(v<ALERT_RULES.temperature.high) return "val-warn";
      return "val-bad";
    case "moist":
      if(v<ALERT_RULES.moisture.low) return "val-bad";
      if(v<35) return "val-warn";
      if(v<70) return "val-ok";
      return "val-warn";
    case "n":
    case "p":
    case "k":
      if(v===0) return "val-bad";
      if(v<ALERT_RULES.npk.low) return "val-warn";
      return "val-ok";
    default: return "";
  }
}

/* ============================================================
   9. 表格資料更新
   ============================================================ */
let weatherTime="—", genTime="—";
let remainingSec = CONFIG.autoRefreshMinutes*60;
let currentDepth = "Surface"; // 新增變數記錄當前深度

function updateFooter(){
  const m=Math.floor(remainingSec/60);
  const s=pad(remainingSec%60);
  document.getElementById("footerInfo").textContent=
    `氣象站更新時間：${weatherTime} ｜ 感測器讀取時間：${genTime} ｜ 🔄 下次更新倒數：${m}:${s}`;
}

async function fetchCSV(){
  const res=await fetch(CONFIG.sheetCsvUrl+"&t="+Date.now());
  const text=await res.text();
  const lines=text.trim().split(/\r?\n/).map(l=>l.split(','));
  return {cols:lines[0],rows:lines.slice(1)};
}

function getLastValid(rows){
  for(let i=rows.length-1;i>=0;i--)
    if(rows[i].some(v=>v!=="")) return rows[i];
  return null;
}

async function refreshSheet(depth=currentDepth){
  currentDepth = depth; // 儲存當前深度

  try{
    const {cols,rows}=await fetchCSV();
    const last=getLastValid(rows);
    if(!last) return;

    const idx={};
    cols.forEach((c,i)=>idx[c.toLowerCase()]=i);

    genTime=last[idx["time"]]||"—";
    lastUpdateTime=Date.now();
    updateFooter();

    document.getElementById("envTemp").textContent =
      roundInt(last[idx["teagarden_air_temp"]]);

    document.getElementById("envHumi").textContent =
      roundInt(last[idx["teagarden_air_humidity"]]);

    const tbody=document.getElementById("tbody");
    tbody.innerHTML="";

    // 彙整所有站點資料 (AI 報告只用 Surface 表面層資料)
    const allStationData = [];
    const depthKey = depth.toLowerCase();

    for(let s=1;s<=CONFIG.stationCount;s++){
      const p=`station${s}_${depthKey}`;
      const pSurface = `station${s}_surface`;

      // 1. 取得當前深度資料 (供 UI 顯示)
      const soilTemp=roundInt(last[idx[`${p}_soiltemp`]]);
      const soilMoist=roundInt(last[idx[`${p}_soilmoisture`]]);
      const n=roundInt(last[idx[`${p}_nitrogen`]]);
      const p2=roundInt(last[idx[`${p}_phosphorus`]]);
      const k=roundInt(last[idx[`${p}_potassium`]]);

      // 2. 取得 Surface 層資料 (供 AI 診斷)
      const surfaceTemp = roundInt(last[idx[`${pSurface}_soiltemp`]]);
      const surfaceMoist = roundInt(last[idx[`${pSurface}_soilmoisture`]]);
      const surfaceN = roundInt(last[idx[`${pSurface}_nitrogen`]]);
      const surfaceP = roundInt(last[idx[`${pSurface}_phosphorus`]]);
      const surfaceK = roundInt(last[idx[`${pSurface}_potassium`]]);

      allStationData.push({
        station: s,
        temp: surfaceTemp,
        moist: surfaceMoist,
        N: surfaceN,
        P: surfaceP,
        K: surfaceK
      });

      // 3. 更新表格 UI (使用當前深度資料)
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>第${s}站</td>
        <td class="${colorClass('temp',soilTemp)}">${soilTemp}</td>
        <td class="${colorClass('moist',soilMoist)}">${soilMoist}</td>
        <td class="${colorClass('n',n)}">${n}</td>
        <td class="${colorClass('p',p2)}">${p2}</td>
        <td class="${colorClass('k',k)}">${k}</td>
      `;
      tbody.appendChild(tr);
    }

    // 4. 執行 AI 診斷 (只對 Surface 層資料)
    lastStationData = allStationData;
    runAIDiagnosisAndReport();

  }catch(e){
    console.warn("CSV 錯誤:",e);
  }
}

/* ============================================================
   10. 天氣更新
   ============================================================ */
async function refreshWeather(){
  try{
    const url=
      `https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001?`+
      `Authorization=${CONFIG.cwaAuth}&format=JSON&StationId=${CONFIG.cwaStation}`;

    const res=await fetch(url);
    const js=await res.json();
    const st=js.records?.Station?.[0];
    const w=st?.WeatherElement||{};

    document.getElementById("weatherDesc").textContent = w.Weather || "—";
    document.getElementById("weatherTemp").textContent = roundInt(w.AirTemperature);
    document.getElementById("weatherHumi").textContent = roundInt(w.RelativeHumidity);
    const rain = roundInt(w.Now?.Precipitation);
    document.getElementById("rainfall").textContent = rain;

    checkRain(rain); // 執行降雨檢查

    document.getElementById("weatherIcon").src =
      w.Weather?.includes("雨")
        ? "https://img.icons8.com/emoji/48/cloud-with-rain.png"
        : "https://img.icons8.com/emoji/48/sun-emoji.png";

    weatherTime = st?.ObsTime?.DateTime?.replace("T"," ").slice(0,19) || "—";
    updateFooter();

  }catch(e){
    console.warn("氣象錯誤:",e);
  }
}

/* ============================================================
   11. UI 行為 + 自動刷新
   ============================================================ */
document.querySelectorAll(".depth-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".depth-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");

    refreshSheet(btn.dataset.depth);
  });
});

document.getElementById("btnFullscreen").onclick=
  ()=>document.documentElement.requestFullscreen?.();

document.getElementById("btnNotify").onclick=
  ()=>alertTea("🔔 測試通知","這是一則測試（含 LINE + 瀏覽器）");

(function tick(){
  document.getElementById("mainClock").textContent=nowStr();
  document.getElementById("dateBox").textContent=dateStr();
  setTimeout(tick,250);
})();

setInterval(()=>{
  remainingSec--;
  if(remainingSec<=0){
    // 刷新頁面，防止記憶體洩漏或資料連線問題
    location.replace(location.href.split("?")[0]+"?t="+Date.now());
    return;
  }
  updateFooter();
},1000);

/* ============================================================
   12. 初始化
   ============================================================ */
refreshSheet();
refreshWeather();

});  // DOMContentLoaded END
