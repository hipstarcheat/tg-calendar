(async function () {
  const tg = window.Telegram?.WebApp;
  if (tg?.expand) tg.expand();

  const user = tg?.initDataUnsafe?.user || {};
  const userId = String(user.id || "");

  const apiUrl = "https://script.google.com/macros/s/AKfycbxRgs5t6hJca2x6PyPGBjRbTYP1wgTGuXUj2B1qUGVQkuS3qtZWoSbIt0qS3s9glIli/exec";

  const userColors = {
    "951377763": "blue",
    "578828973": "green",
    "298802988": "red",
    "222222": "yellow"
  };

  const calendar = document.getElementById("calendar");
  const message = document.getElementById("message");
  const debug = document.getElementById("debug");
  const pageGrafik = document.getElementById("page-grafik");
  const pagePriemka = document.getElementById("page-acceptance");

  const shiftsList = document.createElement("div");
  shiftsList.id = "shiftsList";
  shiftsList.style.marginTop = "12px";
  (pageGrafik || document.body).appendChild(shiftsList);

  const salaryInfo = document.createElement("div");
  salaryInfo.id = "salaryInfo";
  salaryInfo.style.marginTop = "12px";
  (pageGrafik || document.body).appendChild(salaryInfo);

  const priemkaListElem = document.getElementById("priemkaList") || (() => {
    const el = document.createElement("div");
    el.id = "priemkaList";
    (pagePriemka || document.body).appendChild(el);
    return el;
  })();

  const priemkaMsgElem = document.getElementById("priemkaMessage") || (() => {
    const el = document.createElement("div");
    el.id = "priemkaMessage";
    el.style.marginTop = "10px";
    el.style.textAlign = "center";
    (pagePriemka || document.body).appendChild(el);
    return el;
  })();

  function dbg(...args) { if (debug) debug.innerText += `[${new Date().toLocaleTimeString()}] ${args.join(" ")}\n`; console.log(...args); }
  function showMessage(text, cls) { if (!message) return; message.textContent = text || ""; message.className = cls || ""; }

  async function sendToGAS(payload) {
    try {
      const res = await fetch(apiUrl, { method: "POST", body: JSON.stringify(payload) });
      return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
  }

  function createCalendarIfNeeded() {
    if (!calendar || calendar.children.length) return;
    for (let day = 1; day <= 30; day++) {
      const cell = document.createElement("div");
      cell.className = "day";
      cell.textContent = day;
      cell.dataset.day = day;
      cell.onclick = () => handleDayClick(day, cell);
      calendar.appendChild(cell);
    }
  }

  function markCellByUser(cell, uid) {
    if (!cell) return;
    cell.classList.remove("blue","green","red","yellow","gray");
    cell.classList.add(userColors[uid] || "gray");
    cell.dataset.userId = String(uid);
  }

  function applyDaysData(items) {
    if (!Array.isArray(items)) return;
    [...calendar.children].forEach(c => { c.className = "day"; delete c.dataset.userId; });
    items.forEach(item => {
      const d = parseInt(item.date, 10);
      if (!d || d < 1 || d > 30) return;
      const cell = [...calendar.children][d-1];
      markCellByUser(cell, String(item.userId));
    });
  }

  async function loadDays() {
    createCalendarIfNeeded();
    showMessage("Загрузка...", "");
    try {
      const res = await fetch(apiUrl + "?action=getDays");
      const data = await res.json();
      applyDaysData(data);
      renderShiftsList(data);
      loadSalary();
      showMessage("");
    } catch (err) { showMessage("Ошибка загрузки данных", "error"); }
  }

  async function handleDayClick(day, cell) {
    if (!cell) return;
    const occupied = ["blue","green","red","yellow"].some(c => cell.classList.contains(c));
    if (occupied) {
      if (cell.dataset.userId === userId && confirm("Удалить смену?")) {
        const res = await sendToGAS({ action: "deleteDay", userId, date: String(day) });
        if (res.success) loadDays();
        return;
      }
      return;
    }
    const res = await sendToGAS({ action: "addDay", userId, date: String(day) });
    if (res.success) loadDays();
  }

  function renderShiftsList(data) {
    shiftsList.innerHTML = "<h3 style='text-align:center;'>Мои смены</h3>";
    const myDays = Array.isArray(data) ? data.filter(d => String(d.userId) === userId) : [];
    if (!myDays.length) { shiftsList.innerHTML += "<p style='text-align:center;color:#777;'>У тебя пока нет смен</p>"; return; }
    myDays.forEach(d => {
      const btn = document.createElement("button");
      btn.textContent = `День ${d.date} • Выручка: ${d.revenue || 0}`;
      btn.style.display = "block"; btn.style.width = "92%"; btn.style.margin = "6px auto";
      btn.onclick = () => handleRevenueInput(d.date);
      shiftsList.appendChild(btn);
    });
  }

  async function handleRevenueInput(day) {
    const sum = prompt(`Введите выручку за ${day} число:`);
    if (sum === null || sum.trim() === "" || isNaN(Number(sum))) return alert("Введите корректное число!");
    const res = await sendToGAS({ action:"addRevenue", userId, date: String(day), sum: Number(sum) });
    if (res.success) loadDays();
  }

  async function loadSalary() {
    try {
      const res = await fetch(apiUrl + "?action=getSalary"); const data = await res.json();
      if (data?.success) {
        if (userId === "578828973") salaryInfo.innerHTML = `<h3 style="text-align:center;">ЗП (Влад): ${data.salaryVlad}</h3>`;
        else if (userId === "951377763") salaryInfo.innerHTML = `<h3 style="text-align:center;">ЗП (Артур): ${data.salaryArtur}</h3>`;
        else salaryInfo.innerHTML = "";
      }
    } catch {}
  }

  // === Приемка ===
  let priemkaMessageSent = false; // <--- глобальный флаг (один раз за сессию)

  async function loadPriemka() {
    priemkaListElem.innerHTML = "<p style='text-align:center;color:#666;'>Загрузка...</p>";
    try {
      const res = await fetch(apiUrl + "?action=getPriemka");
      const data = await res.json();
      if (!data?.success) {
        priemkaListElem.innerHTML = `<p style='color:red;text-align:center;'>Ошибка</p>`;
        return;
      }

      priemkaListElem.innerHTML = "";

      (data.items || []).forEach(it => {
        const row = document.createElement("div");
        row.className = "priemka-row";
        Object.assign(row.style, {
          display: "flex",
          justifyContent: "space-between",
          padding: "6px",
          border: "1px solid #e6e6e6",
          margin: "6px 4px",
          borderRadius: "8px",
        });

        row.dataset.rowIndex = String(it.rowIndex);
        row.dataset.g = (it.g === null || it.g === undefined) ? "" : String(it.g);

        const label = document.createElement("div");
        label.textContent = it.name;
        label.style.flex = "1";
        label.style.marginRight = "8px";

        const input = document.createElement("input");
        input.type = "number";
        input.value = (it.h === null || it.h === undefined) ? "" : String(it.h);
        Object.assign(input.style, { width: "64px", textAlign: "center" });

        input.addEventListener("input", async () => {
          const v = input.value === "" ? null : Number(input.value);
          await sendToGAS({ action: "updatePriemka", row: it.rowIndex, value: v });
          await checkPriemkaCompletion();
        });

        row.appendChild(label);
        row.appendChild(input);
        priemkaListElem.appendChild(row);
      });

      await checkPriemkaCompletion();
    } catch (err) {
      dbg("loadPriemka error:", err);
      priemkaListElem.innerHTML = `<p style='color:red;text-align:center;'>Ошибка загрузки</p>`;
    }
  }


  async function checkPriemkaCompletion() {
    const rows = Array.from(document.querySelectorAll(".priemka-row"));
    if (!rows.length) {
      priemkaMsgElem.textContent = "";
      return;
    }

    let data;
    try {
      const res = await fetch(apiUrl + "?action=getPriemka");
      data = await res.json();
      if (!data?.success) return;
    } catch (e) {
      dbg("checkPriemkaCompletion: fetch error", e);
      return;
    }

    const map = new Map();
    (data.items || []).forEach(it => map.set(String(it.rowIndex), it));

    let relevantCount = 0;
    let matchedCount = 0;

    rows.forEach(row => {
      const input = row.querySelector("input");
      const info = map.get(row.dataset.rowIndex) || {};
      const gRaw = info.g;
      const hRaw = (info.h === null || info.h === undefined) ? null : info.h;

      if (gRaw === null || gRaw === undefined || gRaw === "") {
        row.style.backgroundColor = "";
        row.style.color = "";
        return;
      }

      relevantCount++;
      const gVal = Number(gRaw);
      const hVal = (hRaw === null || hRaw === undefined)
        ? (input.value === "" ? null : Number(input.value))
        : Number(hRaw);

      const match = (hVal !== null && !isNaN(hVal) && Number(gVal) === Number(hVal));

      if (match) {
        row.style.backgroundColor = "#e9fbe9";
        row.style.color = "#000";
        matchedCount++;
      } else {
        row.style.backgroundColor = "#fdeaea";
        row.style.color = "#6b021a";
      }
    });

    if (relevantCount > 0 && matchedCount === relevantCount) {
      priemkaMsgElem.textContent = "✅ Приемка совпала!";
      priemkaMsgElem.style.color = "green";

      // отправляем сообщение только 1 раз
      if (!priemkaMessageSent) {
        priemkaMessageSent = true;
        await sendToGAS({ action: "sendPriemkaMessage" });
      }
    } else {
      priemkaMsgElem.textContent = "❌ Не совпадает!";
      priemkaMsgElem.style.color = "red";
      // если расхождение — сбрасываем флаг (сообщение снова отправится после reload)
      priemkaMessageSent = false;
    }
  }


  async function loadSubscribersGrowth() {
    try {
      const res = await fetch(apiUrl + "?action=getSubscribersGrowth");
      const data = await res.json();
      if (!data.success) return;

      const cont = document.createElement("div");
      cont.id = "subsGrowth";
      cont.style.textAlign = "center";
      cont.style.margin = "20px 0";

      const title = document.createElement("h3");
      title.textContent = "📊 Прирост подписчиков";
      title.style.color = "#444";
      cont.appendChild(title);

      const text = document.createElement("p");
      text.textContent = `Подписчики: ${data.currentSubs} (прирост: +${data.growth})`;
      text.style.marginBottom = "10px";
      text.style.color = "#333";
      cont.appendChild(text);

      const barContainer = document.createElement("div");
      barContainer.style.width = "90%";
      barContainer.style.height = "20px";
      barContainer.style.margin = "0 auto";
      barContainer.style.borderRadius = "10px";
      barContainer.style.background = "#eee";
      barContainer.style.position = "relative";

      const progress = document.createElement("div");
      progress.style.position = "absolute";
      progress.style.left = "0";
      progress.style.top = "0";
      progress.style.bottom = "0";
      progress.style.width = Math.min(100, (data.growth / data.levelF) * 100) + "%";
      progress.style.background = data.progressColor;
      progress.style.borderRadius = "10px";
      progress.style.transition = "width 0.8s ease";
      barContainer.appendChild(progress);

      cont.appendChild(barContainer);
      document.body.appendChild(cont);
    } catch (e) {
      console.error("loadSubscribersGrowth error:", e);
    }
  }

  async function loadCleaning() {
    const container = document.getElementById("cleaningContainer");
    if(!container) return;
    container.innerHTML = "Загрузка...";
    try {
      const res = await fetch(apiUrl + "?action=getCleaning");
      const data = await res.json();
      if(!data.success) { container.innerHTML = "Ошибка загрузки"; return; }
      container.innerHTML = "";

      const containerW = container.clientWidth;
      const containerH = container.clientHeight;

      data.items.forEach(it => {
        const rect = document.createElement("div");
        rect.className = "cleaning-rect";
        rect.style.position = "absolute";
        rect.style.opacity = "0.7";
        rect.style.cursor = userId === "298802988" ? "move" : "default";
        rect.style.border = "1px solid #000";
        rect.style.display = "flex";
        rect.style.flexDirection = "column";
        rect.style.justifyContent = "flex-start";
        rect.style.alignItems = "center";
        rect.style.padding = "4px";
        rect.style.boxSizing = "border-box";

        // --- название ---
        // --- название ---
        const titleDiv = document.createElement("div");
        titleDiv.textContent = it.name;
        titleDiv.style.fontSize = "1em"; // основной размер
        rect.appendChild(titleDiv);

        // --- информация о последней уборке ---
      const lastCleaner = String(it.lastUserId) === "951377763" ? "Артур"
                        : String(it.lastUserId) === "578828973" ? "Влад"
                        : "—";

      // Берем строку из B, ожидаем формат "1.11.2025", преобразуем в "01.11.25"
      let lastDateText = "—";

      if(it.lastDate) {
        if(typeof it.lastDate === "string") {
          // Уже текст из ячейки
          const parts = it.lastDate.split(".");
          if(parts.length === 3){
            const day = parts[0].padStart(2,"0");
            const month = parts[1].padStart(2,"0");
            const year = parts[2].slice(-2);
            lastDateText = `${day}.${month}.${year}`;
          }
        } else if(it.lastDate instanceof Date) {
          // Объект Date
          const d = it.lastDate;
          const day = String(d.getDate()).padStart(2,"0");
          const month = String(d.getMonth()+1).padStart(2,"0");
          const year = String(d.getFullYear()).slice(-2);
          lastDateText = `${day}.${month}.${year}`;
        }
      }



      const infoDiv = document.createElement("div");
      infoDiv.style.fontSize = "0.5em"; // в 3 раза меньше
      infoDiv.style.marginTop = "2px";
      infoDiv.textContent = `${lastDateText} (${lastCleaner})`;
      rect.appendChild(infoDiv);



        // Цвет по дате
        const lastDate = it.lastDate ? new Date(it.lastDate) : null;
        const now = new Date();
        const daysThreshold = Number(it.daysThreshold) || 0;
        if(lastDate && (now - lastDate)/(1000*60*60*24) > daysThreshold) rect.style.backgroundColor = "red";
        else rect.style.backgroundColor = "lightblue";

        // Позиция и размер (нормализуем из "x*y")
        const [posX,posY] = it.position.split("*").map(Number);
        const [sizeW,sizeH] = it.size.split("*").map(Number);

        rect.style.left = (posX/100*containerW) + "px";
        rect.style.top = (posY/100*containerH) + "px";
        rect.style.width = (sizeW/100*containerW) + "px";
        rect.style.height = (sizeH/100*containerH) + "px";

        // Клик для записи даты
        rect.onclick = async () => {
          if(["951377763","578828973"].includes(userId)) {
            const today = new Date().toLocaleDateString();
            await sendToGAS({ action:"updateCleaningDate", row: it.rowIndex, userId, date: today });
            loadCleaning();
          }
        };

        // Drag для редактирования позиции
        if(userId === "298802988") {
          let offsetX, offsetY, dragging=false;
          rect.onmousedown = e => { dragging=true; offsetX=e.offsetX; offsetY=e.offsetY; };
          document.onmousemove = e => {
            if(!dragging) return;
            const newX = e.clientX - container.getBoundingClientRect().left - offsetX;
            const newY = e.clientY - container.getBoundingClientRect().top - offsetY;
            rect.style.left = Math.max(0, Math.min(containerW - rect.clientWidth, newX)) + "px";
            rect.style.top = Math.max(0, Math.min(containerH - rect.clientHeight, newY)) + "px";
          };
          rect.onmouseup = async e => {
            if(!dragging) return;
            dragging=false;

            const rectLeft = parseFloat(rect.style.left);
            const rectTop = parseFloat(rect.style.top);
            const rectW = parseFloat(rect.style.width);
            const rectH = parseFloat(rect.style.height);

            // пересчет в 0-100
            const posX = Math.round((rectLeft/containerW)*100);
            const posY = Math.round((rectTop/containerH)*100);
            const sizeW = Math.round((rectW/containerW)*100);
            const sizeH = Math.round((rectH/containerH)*100);

            await sendToGAS({ action:"updateCleaningPosition", row: it.rowIndex, 
              position: posX+"*"+posY, size: sizeW+"*"+sizeH
            });

            loadCleaning(); // обновляем отображение
          };
        }

        container.appendChild(rect);
      });
    } catch(e) { container.innerHTML = "Ошибка"; console.error(e); }
  }




  function setupTabSwitching() {
    document.querySelectorAll(".bottom-bar button[data-page]").forEach(btn => {
      btn.addEventListener("click", () => {
        const pageId = btn.getAttribute("data-page");
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        document.getElementById(pageId)?.classList.add("active");
        document.querySelectorAll(".bottom-bar button").forEach(b => b.classList.remove("active")); btn.classList.add("active");
        if (pageId === "page-grafik") loadDays();
        if (pageId === "page-acceptance") loadPriemka();
        if (pageId === "page-cleaning") loadCleaning();
        if (pageId === "page-plan") loadSubscribersGrowth();
      });
    });
  }

  function init() { createCalendarIfNeeded(); setupTabSwitching(); if (document.querySelector(".page.active")?.id==="page-grafik") loadDays();}
  init();
})();
