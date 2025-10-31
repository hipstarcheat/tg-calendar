(async function () {
  const tg = window.Telegram?.WebApp;
  if (tg?.expand) tg.expand();

  const user = tg?.initDataUnsafe?.user || {};
  const userId = String(user.id || "");

  const apiUrl = "https://script.google.com/macros/s/AKfycbxKFN4S613Fhod01BiY1fXfxRvhK-HFJLi3y65pXZTlwM-c7jQ2Gf2i_Bl2tfUo3xsU/exec";

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
        else if (userId === "298802988") salaryInfo.innerHTML = `<h3 style="text-align:center;">ЗП (Артур): ${data.salaryArtur}</h3>`;
        else salaryInfo.innerHTML = "";
      }
    } catch {}
  }

  // === Приемка ===
  async function loadPriemka() {
    priemkaListElem.innerHTML = "<p style='text-align:center;color:#666;'>Загрузка...</p>";
    try {
      const res = await fetch(apiUrl + "?action=getPriemka");
      const data = await res.json();
      if (!data?.success) { priemkaListElem.innerHTML = `<p style='color:red;text-align:center;'>Ошибка</p>`; return; }
      priemkaListElem.innerHTML = "";

      (data.items || []).forEach(it => {
        const row = document.createElement("div");
        row.className = "priemka-row";
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.padding = "6px";
        row.style.border = "1px solid #e6e6e6";
        row.style.margin = "6px 4px";
        row.style.borderRadius = "8px";

        // сохраняем целевое G в data-атрибуте
        row.dataset.g = (it.g === null || it.g === undefined) ? "" : String(it.g);
        row.dataset.rowIndex = String(it.rowIndex);

        const label = document.createElement("div");
        label.textContent = it.name;
        label.style.flex = "1";
        label.style.marginRight = "8px";

        const input = document.createElement("input");
        input.type = "number";
        // если в H уже есть значение (h !== null), ставим его, иначе оставляем пустоту
        input.value = (it.h === null || it.h === undefined) ? "" : String(it.h);
        input.style.width = "64px";
        input.style.textAlign = "center";

        // При вводе — отправляем H в GAS (updatePriemka) и затем проверяем совпадения
        input.addEventListener("input", async () => {
          const v = input.value === "" ? null : Number(input.value);
          await sendToGAS({ action: "updatePriemka", row: it.rowIndex, value: v });
          await checkPriemkaCompletion();
        });

        row.appendChild(label);
        row.appendChild(input);
        priemkaListElem.appendChild(row);
      });

      // после загрузки проверяем (подтягиваем пустые H не нужно — H показаны из сервера)
      await checkPriemkaCompletion();
    } catch (err) {
      dbg("loadPriemka error:", err);
      priemkaListElem.innerHTML = `<p style='color:red;text-align:center;'>Ошибка загрузки</p>`;
    }
  }

  async function checkPriemkaCompletion() {
    const rows = Array.from(document.querySelectorAll(".priemka-row"));
    if (!rows.length) return;
    let allMatched = true;

    // Берём свежие значения G и H с сервера, чтобы сравнение было корректным
    const res = await fetch(apiUrl + "?action=getPriemka");
    const data = await res.json();
    if (!data?.success) return;

    // data.items содержит объекты { rowIndex, name, g, h }
    // создаём мапу по rowIndex (на случай, если порядок поменяется)
    const map = new Map();
    (data.items || []).forEach(it => map.set(String(it.rowIndex), it));

    rows.forEach(row => {
      const input = row.querySelector("input");
      const rowIndex = row.dataset.rowIndex;
      const info = map.get(rowIndex) || {};
      const gValue = (info.g === null || info.g === undefined) ? null : Number(info.g);
      const hValue = (input.value === "" ? null : Number(input.value));

      // если целевое G задано, а H пусто — считаем несовпадением
      if (gValue === null) {
        // если нет целевого значения — не учитываем в проверке (или можно считать требующим ручной проверки)
        allMatched = false;
        return;
      }

      // строгая проверка: H обязательно равна G и не null
      if (hValue === null || Number(hValue) !== Number(gValue)) {
        allMatched = false;
      }
    });

    if (allMatched) {
      priemkaMsgElem.textContent = "Приемка совпала!";
      priemkaMsgElem.style.color = "green";
      await sendToGAS({ action: "sendPriemkaMessage" });
    } else {
      priemkaMsgElem.textContent = "Не совпадает!";
      priemkaMsgElem.style.color = "red";
    }

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
      });
    });
  }

  function init() { createCalendarIfNeeded(); setupTabSwitching(); if (document.querySelector(".page.active")?.id==="page-grafik") loadDays(); }
  init();
})();
