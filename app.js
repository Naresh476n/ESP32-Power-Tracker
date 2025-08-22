// Init Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---- Remote switches ----
for (let i=1;i<=4;i++){
  const el = document.getElementById("relay"+i);
  el.addEventListener("change", e=>{
    db.ref("relays/relay"+i).set(e.target.checked);
  });
}
// Keep UI in sync with DB states
db.ref("relays").on("value", snap=>{
  const v = snap.val() || {};
  for (let i=1;i<=4;i++){
    const el = document.getElementById("relay"+i);
    if (el) el.checked = !!v["relay"+i];
  }
});

// ---- Timer UI ----
document.querySelectorAll(".preset").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.getElementById("customMin").value = btn.dataset.min;
  });
});
document.getElementById("applyTimer").addEventListener("click", ()=>{
  const sel = document.getElementById("loadSelect").value;
  const val = parseInt(document.getElementById("customMin").value||"0",10);
  db.ref("timers/minutes/load"+sel).set(val>0?val:0);
  // if relay is already ON, ESP32 will arm a fresh countdown
});

// ---- Usage limits ----
document.getElementById("saveLimits").addEventListener("click", ()=>{
  const vals = [
    parseFloat(document.getElementById("limit1").value||"12"),
    parseFloat(document.getElementById("limit2").value||"12"),
    parseFloat(document.getElementById("limit3").value||"12"),
    parseFloat(document.getElementById("limit4").value||"12"),
  ];
  vals.forEach((h,i)=>{
    const sec = Math.max(1, Math.round(h*3600));
    db.ref("limits/seconds/load"+(i+1)).set(sec);
  });
});

// ---- Unit price ----
document.getElementById("savePrice").addEventListener("click", ()=>{
  const p = parseFloat(document.getElementById("price").value||"8");
  db.ref("settings/unitPrice").set(p);
});

// ---- Live monitoring tiles ----
const liveDiv = document.getElementById("live");
for (let i = 1; i <= 4; i++) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.innerHTML = `
    <h4>Load ${i}</h4>
    <div class="kv"><span>Voltage:</span><span id="v${i}">0 V</span></div>
    <div class="kv"><span>Current:</span><span id="c${i}">0 A</span></div>
    <div class="kv"><span>Power:</span><span id="p${i}">0 W</span></div>
    <div class="kv"><span>Energy:</span><span id="e${i}">0 Wh</span></div>
  `;
  liveDiv.appendChild(tile);
}

db.ref("loads").on("value", snap=>{
  const d = snap.val() || {};
  for (let i=1;i<=4;i++){
    const L = d["load"+i] || {};
    const v = (Number(L.voltage)||0).toFixed(2);
    const c = (Number(L.current)||0).toFixed(3);
    const p = (Number(L.power)||0).toFixed(2);
    const e = (Number(L.energy)||0).toFixed(2);
    document.getElementById("v"+i).innerText = v+" V";
    document.getElementById("c"+i).innerText = c+" A";
    document.getElementById("p"+i).innerText = p+" W";
    document.getElementById("e"+i).innerText = e+" Wh";
  }
});

// ---- Notifications ----
db.ref("notifications").on("child_added", snap=>{
  const li = document.createElement("li");
  li.textContent = snap.val();
  document.getElementById("notifs").appendChild(li);
});

// ---- Charts ----
function makeBar(ctx, title){
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        { label: "Load 1", data: [] },
        { label: "Load 2", data: [] },
        { label: "Load 3", data: [] },
        { label: "Load 4", data: [] }
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true }, title: { display: true, text: title } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

const dailyChart   = makeBar(document.getElementById("dailyChart"),   "Daily Usage (Wh)");
const weeklyChart  = makeBar(document.getElementById("weeklyChart"),  "Weekly Usage (Wh)");
const monthlyChart = makeBar(document.getElementById("monthlyChart"), "Monthly Usage (Wh)");

// Feed charts from logs
function wireChart(path, chart){
  db.ref(path).on("value", snap=>{
    const obj = snap.val();
    if (!obj) return;
    const labels = Object.keys(obj);
    chart.data.labels = labels;
    chart.data.datasets.forEach((ds, i)=>{
      ds.data = labels.map(k => Number(obj[k]?.["load"+(i+1)]?.energy || 0).toFixed(2));
    });
    chart.update();
  });
}
wireChart("logs/daily",   dailyChart);
wireChart("logs/weekly",  weeklyChart);
wireChart("logs/monthly", monthlyChart);

// ---- Range chart + PDF (optional placeholder) ----
const rangeChart = new Chart(document.getElementById("chart"), {type:"line", data:{labels:[],datasets:[]}, options:{responsive:true}});
document.getElementById("loadCharts").addEventListener("click", ()=>{
  // (Optional) You can build a custom query over logs/daily between dates
  // For now, we keep the static daily/weekly/monthly charts above.
});

document.getElementById("downloadPdf").addEventListener("click", async ()=>{
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const loads = (await db.ref("loads").get()).val() || {};
  let y = 12;
  doc.text("Smart Energy Tracker - Snapshot", 10, y); y+=8;
  for (let i=1;i<=4;i++){
    const L = loads["load"+i] || {};
    doc.text(`Load ${i}: V=${Number(L.voltage||0).toFixed(2)}V  I=${Number(L.current||0).toFixed(3)}A  P=${Number(L.power||0).toFixed(2)}W  E=${Number(L.energy||0).toFixed(2)}Wh`, 10, y);
    y+=6;
  }
  doc.save("Power_Report.pdf");
});
