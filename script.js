(async function () {
  const tg = window.Telegram?.WebApp;
  if (tg?.expand) tg.expand();

  const user = tg?.initDataUnsafe?.user || {};
  const userId = String(user.id || "");

  // === Прямая ссылка на GAS ===
  const apiUrl = "https://script.google.com/macros/s/AKfycbzvdslq3ohyZhu2E0kjABLd4HK0hsPhhjuXCC3Yy1DZylBFlrcoZRQXOncz_ZzHsZ0H/exec";

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

  function dbg(...args) {
    if (debug) debug.innerText += `[${new Date().toLocaleTimeString()}] ${args.join(" ")}\n`;
    console.log(...args);
  }

  function showMessage(text, cls) {
    if (!message) return;
    message.textContent = text || "";
    message.className = cls || "";
  }

  // === Прямая отправка в GAS ===
  async function sendToGAS(payload) {
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      dbg("POST:", payload, "→", data);
      return data;
    } catch (e) {
      dbg("sendToGAS error:", e);
      return { success: false, error: e.message };
    }
  }

  function createCalendarIfNeeded() {
    if (!calendar || calendar.children.length) return;
    for (let day = 1; day <= 31; day++) {
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
    cell.classList.remove("blue", "green", "red", "yellow", "gray");
    cell.classList.add(userColors[uid] || "gray");
    cell.dataset.userId = String(uid);
  }

  function applyDaysData(items) {
    if (!Array.isArray(items)) {
      dbg("applyDaysData: неверный формат", items);
      return;
    }
    [...calendar.children].forEach(c => {
      c.classList.remove("blue", "green", "red", "yellow", "gray");
      delete c.dataset.userId;
    });
    items.forEach(item => {
      const d = parseInt(item.date, 10);
      if (!d || d < 1 || d > 31) return;
      const cell = [...calendar.children][d - 1];
      if (!cell) return;
      markCellByUser(cell, String(item.userId));
    });
  }

  async function loadDays() {
    createCalendarIfNeeded();
    showMessage("Загрузка...", "");
    try {
      const res = await fetch(apiUrl + "?action=getDays");
      const data = await res.json();
      dbg("GET getDays:", data);
      applyDaysData(data);
      renderShiftsList(data);
      loadSalary();
      showMessage("");
    } catch (err) {
      dbg("loadDays error:", err);
      showMessage("Ошибка загрузки данных", "error");
    }
  }

  async function handleDayClick(day, cell) {
    if (!cell) return;
    const occupied = ["blue", "green", "red", "yellow"].some(c => cell.classList.contains(c));

    if (occupied) {
      if (cell.dataset.userId === userId && confirm("Удалить смену?")) {
        const res = await sendToGAS({ action: "deleteDay", userId, date: String(day) });
        if (res.success) {
          showMessage("Смена удалена", "success");
          loadDays();
        } else {
          showMessage(res.error || "Ошибка удаления", "error");
        }
        return;
      }
      showMessage("Этот день уже занят!", "error");
      return;
    }

    const res = await sendToGAS({ action: "addDay", userId, date: String(day) });
    if (res.success) {
      cell.classList.add(userColors[userId] || "blue");
      showMessage("Смена добавлена", "success");
    } else {
      showMessage(res.error || "Ошибка добавления", "error");
    }
  }

  function renderShiftsList(data) {
    shiftsList.innerHTML = "<h3 style='margin:6px 0 8px 0; text-align:center;'>Мои смены</h3>";
    const myDays = Array.isArray(data) ? data.filter(d => String(d.userId) === userId) : [];
    if (myDays.length === 0) {
      shiftsList.innerHTML += "<p style='text-align:center; color:#777; margin:6px 0;'>У тебя пока нет смен</p>";
      return;
    }
    myDays.forEach(d => {
      const btn = document.createElement("button");
      btn.textContent = `День ${d.date} • Выручка: ${d.revenue || 0}`;
      btn.style.display = "block";
      btn.style.width = "92%";
      btn.style.margin = "6px auto";
      btn.onclick = () => handleRevenueInput(d.date);
      shiftsList.appendChild(btn);
    });
  }

  async function handleRevenueInput(day) {
    const sum = prompt(`Введите выручку за ${day} число:`);
    if (sum === null || sum.trim() === "" || isNaN(Number(sum))) return alert("Введите корректное число!");
    const res = await sendToGAS({ action: "addRevenue", userId, date: String(day), sum: Number(sum) });
    if (res.success) alert("Выручка сохранена");
    else alert("Ошибка: " + (res.error || "неизвестно"));
  }

  async function loadSalary() {
    try {
      const res = await fetch(apiUrl + "?action=getSalary");
      const data = await res.json();
      dbg("getSalary:", data);
      if (data?.success) {
        if (userId === "578828973") salaryInfo.innerHTML = `<h3 style="text-align:center;">ЗП (Влад): ${data.salaryVlad}</h3>`;
        else if (userId === "951377763") salaryInfo.innerHTML = `<h3 style="text-align:center;">ЗП (Артур): ${data.salaryArtur}</h3>`;
        else salaryInfo.innerHTML = "";
      }
    } catch (e) {
      dbg("loadSalary error:", e);
    }
  }

  // === ПРИЕМКА ===
  async function loadPriemka() {
    priemkaListElem.innerHTML = "<p style='text-align:center;color:#666;margin:8px 0;'>Загрузка...</p>";
    try {
      const res = await fetch(apiUrl + "?action=getPriemka");
      const data = await res.json();
      dbg("getPriemka:", data);
      if (!data?.success) {
        priemkaListElem.innerHTML = `<p style='color:red;text-align:center;'>Ошибка: ${data?.error}</p>`;
        return;
      }
      priemkaListElem.innerHTML = "";
      (data.items || []).forEach(it => {
        const row = document.createElement("div");
        row.className = "priemka-row";
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.padding = "6px";
        row.style.margin = "6px 4px";
        row.style.borderRadius = "8px";
        row.style.border = "1px solid #e6e6e6";
        row.dataset.target = String(it.value);

        const label = document.createElement("div");
        label.textContent = it.name;
        label.style.flex = "1";
        label.style.marginRight = "8px";

        const input = document.createElement("input");
        input.type = "number";
        input.min = 1;
        input.max = 1000;
        input.value = "";
        input.style.width = "64px";
        input.style.textAlign = "center";

        input.addEventListener("input", async () => {
          await sendToGAS({ action: "updatePriemka", name: it.name, value: Number(input.value) });
          checkPriemkaCompletion();
        });

        row.appendChild(label);
        row.appendChild(input);
        priemkaListElem.appendChild(row);
      });
    } catch (e) {
      dbg("loadPriemka error:", e);
      priemkaListElem.innerHTML = `<p style='color:red;text-align:center;'>Ошибка загрузки</p>`;
    }
  }

  async function checkPriemkaCompletion() {
    const rows = document.querySelectorAll(".priemka-row");
    if (!rows.length) return;
    let allMatched = true;
    rows.forEach(r => {
      const input = r.querySelector("input");
      if (String(input.value).trim() === "" || Number(input.value) !== Number(r.dataset.target))
        allMatched = false;
    });
    if (allMatched) {
      priemkaMsgElem.textContent = "Приемка совпала!";
      priemkaMsgElem.style.color = "green";
      await sendToGAS({ action: "sendPriemkaMessage" });
    } else priemkaMsgElem.textContent = "";
  }

  // === Переключение вкладок ===
  function setupTabSwitching() {
    document.querySelectorAll(".bottom-bar button[data-page]").forEach(btn => {
      btn.addEventListener("click", () => {
        const pageId = btn.getAttribute("data-page");
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        document.getElementById(pageId)?.classList.add("active");
        document.querySelectorAll(".bottom-bar button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        if (pageId === "page-grafik") {
          createCalendarIfNeeded();
          loadDays();
        }
        if (pageId === "page-acceptance") {
          loadPriemka();
        }
      });
    });
  }

  function init() {
    createCalendarIfNeeded();
    setupTabSwitching();
    if (document.querySelector(".page.active")?.id === "page-grafik") loadDays();
  }

  init();
})();
