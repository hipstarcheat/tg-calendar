(async function () {
  const tg = window.Telegram?.WebApp;
  if (tg?.expand) tg.expand();

  const user = tg?.initDataUnsafe?.user || {};
  const userId = String(user.id || "");

  const apiUrl = "https://script.google.com/macros/s/AKfycbyyzvmiB3bLlmr1tzI7r3GCY77FgWtUUWhxNhweH2HZrdw90eFUAIjeXOLIlYxS-Ujh/exec";

  const userColors = { "951377763":"blue", "578828973":"green", "298802988":"red", "222222":"yellow" };

  const calendar = document.getElementById("calendar");
  const message = document.getElementById("message");
  const debug = document.getElementById("debug");
  const pageGrafik = document.getElementById("page-grafik");
  const pagePriemka = document.getElementById("page-acceptance");

  const shiftsList = document.createElement("div"); shiftsList.id="shiftsList"; shiftsList.style.marginTop="12px"; (pageGrafik||document.body).appendChild(shiftsList);
  const salaryInfo = document.createElement("div"); salaryInfo.id="salaryInfo"; salaryInfo.style.marginTop="12px"; (pageGrafik||document.body).appendChild(salaryInfo);
  const priemkaListElem = document.getElementById("priemkaList") || (()=>{const el=document.createElement("div"); el.id="priemkaList"; (pagePriemka||document.body).appendChild(el); return el;})();
  const priemkaMsgElem = document.getElementById("priemkaMessage") || (()=>{const el=document.createElement("div"); el.id="priemkaMessage"; el.style.marginTop="10px"; el.style.textAlign="center"; (pagePriemka||document.body).appendChild(el); return el;})();

  let currentMonthOffset = 0; // 0 = текущий месяц

  function dbg(...args){ if(debug) debug.innerText+=`[${new Date().toLocaleTimeString()}] ${args.join(" ")}\n`; console.log(...args); }
  function showMessage(text, cls){ if(!message)return; message.textContent=text||""; message.className=cls||""; }

  async function sendToGAS(payload){ try{ const res=await fetch(apiUrl,{method:"POST",body:JSON.stringify(payload)}); return await res.json(); } catch(e){ return {success:false,error:e.message}; } }

  function createCalendar(monthOffset=0){
    if(!calendar) return;
    calendar.innerHTML="";
    const today=new Date();
    const month=today.getMonth()+monthOffset;
    const year=today.getFullYear();
    const firstDay=new Date(year,month,1);
    const lastDay=new Date(year,month+1,0);
    const daysCount=lastDay.getDate();
    for(let day=1; day<=daysCount; day++){
      const cell=document.createElement("div");
      cell.className="day";
      cell.textContent=day;
      cell.dataset.day=day; cell.dataset.month=month+1; cell.dataset.year=year;
      cell.onclick=()=>handleDayClick(day,month+1,year,cell);
      calendar.appendChild(cell);
    }
  }

  function markCellByUser(cell, uid){ if(!cell) return; cell.classList.remove("blue","green","red","yellow","gray"); cell.classList.add(userColors[uid]||"gray"); cell.dataset.userId=String(uid); }

  function applyDaysData(items){
    if(!Array.isArray(items)) return;
    [...calendar.children].forEach(c=>{c.className="day"; delete c.dataset.userId;});
    items.forEach(item=>{
      const [day,month,year]=item.date.split(",").map(Number);
      const cell=[...calendar.children].find(c=>Number(c.dataset.day)===day && Number(c.dataset.month)===month && Number(c.dataset.year)===year);
      if(cell) markCellByUser(cell,String(item.userId));
    });
  }

  async function loadDays(){
    createCalendar(currentMonthOffset);
    showMessage("Загрузка...","");
    try{
      const res=await fetch(apiUrl+"?action=getDays");
      const data=await res.json();
      applyDaysData(data);
      renderShiftsList(data);
      loadSalary();
      showMessage("");
    }catch(err){ showMessage("Ошибка загрузки данных","error"); }
  }

  async function handleDayClick(day, month, year, cell){
    if(!cell) return;
    const occupied=["blue","green","red","yellow"].some(c=>cell.classList.contains(c));
    const dateStr=`${day},${month},${year}`;
    if(occupied){
      if(cell.dataset.userId===userId && confirm("Удалить смену?")){
        const res=await sendToGAS({action:"deleteDay",userId,date:dateStr});
        if(res.success) loadDays(); return;
      } return;
    }
    const res=await sendToGAS({action:"addDay",userId,date:dateStr});
    if(res.success) loadDays();
  }

  function renderShiftsList(data){
    shiftsList.innerHTML="<h3 style='text-align:center;'>Мои смены</h3>";
    const myDays=Array.isArray(data)?data.filter(d=>String(d.userId)===userId):[];
    if(!myDays.length){ shiftsList.innerHTML+="<p style='text-align:center;color:#777;'>У тебя пока нет смен</p>"; return; }
    myDays.forEach(d=>{
      const btn=document.createElement("button");
      btn.textContent=`День ${d.date} • Выручка: ${d.revenue||0}`;
      btn.style.display="block"; btn.style.width="92%"; btn.style.margin="6px auto";
      btn.onclick=()=>handleRevenueInput(d.date);
      shiftsList.appendChild(btn);
    });
  }

  async function handleRevenueInput(dateStr){
    const [day,month,year]=dateStr.split(",");
    const sum=prompt(`Введите выручку за ${day}.${month}.${year}:`);
    if(sum===null || sum.trim()==="" || isNaN(Number(sum))) return alert("Введите корректное число!");
    const res=await sendToGAS({action:"addRevenue",userId,date:dateStr,sum:Number(sum)});
    if(res.success) loadDays();
  }

  async function loadSalary(){
    try{
      const res=await fetch(apiUrl+"?action=getSalary"); const data=await res.json();
      if(data?.success){
        if(userId==="578828973") salaryInfo.innerHTML=`<h3 style="text-align:center;">ЗП (Влад): ${data.salaryVlad}</h3>`;
        else if(userId==="951377763") salaryInfo.innerHTML=`<h3 style="text-align:center;">ЗП (Артур): ${data.salaryArtur}</h3>`;
        else salaryInfo.innerHTML="";
      }
    }catch{}
  }

  // === Приемка ===
  async function loadPriemka(){
    priemkaListElem.innerHTML="<p style='text-align:center;color:#666;'>Загрузка...</p>";
    try{
      const res=await fetch(apiUrl+"?action=getPriemka"); const data=await res.json();
      if(!data?.success){ priemkaListElem.innerHTML=`<p style='color:red;text-align:center;'>Ошибка</p>`; return; }
      priemkaListElem.innerHTML="";
      (data.items||[]).forEach(it=>{
        const row=document.createElement("div"); row.className="priemka-row";
        row.style.display="flex"; row.style.justifyContent="space-between"; row.style.padding="6px"; row.style.border="1px solid #e6e6e6"; row.style.margin="6px 4px"; row.style.borderRadius="8px";

        const label=document.createElement("div"); label.textContent=it.name; label.style.flex="1"; label.style.marginRight="8px";
        const input=document.createElement("input"); input.type="number"; input.value=it.value||0; input.style.width="64px"; input.style.textAlign="center";
        input.addEventListener("input", async()=>{ await sendToGAS({action:"updatePriemka",row:it.rowIndex,value:Number(input.value)}); checkPriemkaCompletion(); });

        row.appendChild(label); row.appendChild(input); priemkaListElem.appendChild(row);
      });
      checkPriemkaCompletion();
    }catch{}
  }

  async function checkPriemkaCompletion(){
    const rows=document.querySelectorAll(".priemka-row"); if(!rows.length) return;
    let allMatched=true;
    const res=await fetch(apiUrl+"?action=getPriemka"); const data=await res.json();
    if(!data?.success) return;

    rows.forEach((row,i)=>{
      const input=row.querySelector("input");
      const gValue=data.items[i]?.value||0;
      if(input.value==="" && gValue!==undefined) input.value=gValue;
      if(Number(input.value)!==Number(gValue)) allMatched=false;
    });

    if(allMatched){ priemkaMsgElem.textContent="Приемка совпала!"; priemkaMsgElem.style.color="green"; await sendToGAS({action:"sendPriemkaMessage"}); }
    else priemkaMsgElem.textContent="";
  }

  function setupTabSwitching(){
    document.querySelectorAll(".bottom-bar button[data-page]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const pageId=btn.getAttribute("data-page");
        document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
        document.getElementById(pageId)?.classList.add("active");
        document.querySelectorAll(".bottom-bar button").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
        if(pageId==="page-grafik") loadDays();
        if(pageId==="page-acceptance") loadPriemka();
      });
    });
  }

  // === Пролистывание месяцев ===
  function nextMonth(){ currentMonthOffset++; loadDays(); }
  function prevMonth(){ currentMonthOffset--; loadDays(); }

  function init(){
    createCalendar(currentMonthOffset);
    setupTabSwitching();
    document.getElementById("btnNextMonth")?.addEventListener("click", nextMonth);
    document.getElementById("btnPrevMonth")?.addEventListener("click", prevMonth);
    if(document.querySelector(".page.active")?.id==="page-grafik") loadDays();
  }
  init();

})();
