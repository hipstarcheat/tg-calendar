// script.js — интеграция вкладок, календаря и раздела "Приемка"
// Особенности:
// 1) чтение данных делаем через JSONP (doGet в GAS поддерживает callback)
// 2) запись (addDay, deleteDay, addRevenue, sendPriemkaMessage) — через tg.sendData (Telegram WebApp),
//    если TG не доступен — пытаем fetch (fallback, но обычно упадёт из-за CORS).
(function () {
  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.expand === "function") tg.expand();

  const user = tg?.initDataUnsafe?.user || {};
  const userId = String(user.id || "");

  // URL скрипта GAS (тот же /exec URL)
  const apiUrl = "https://script.google.com/macros/s/AKfycbyWuR7tVom19MXM11wPzusNEW1db3I4Ok_OLLFrYHU_hJMENCZXDvxq4s1WbDAlY_Ro/exec";

  const userColors = {
    "951377763": "blue",
    "578828973": "green",
    "298802988": "red",
    "222222": "yellow"
  };

  // DOM
  const calendar = document.getElementById("calendar");
  const message = document.getElementById("message");
  const debug = document.getElementById("debug");
  const pageGrafik = document.getElementById("page-grafik");
  const pagePriemka = document.getElementById("page-acceptance");

  // blocks for Grafik
  const shiftsList = document.createElement("div");
  shiftsList.id = "shiftsList";
  shiftsList.style.marginTop = "12px";
  const salaryInfo = document.createElement("div");
  salaryInfo.id = "salaryInfo";
  salaryInfo.style.marginTop = "12px";
  if (pageGrafik) {
    pageGrafik.appendChild(shiftsList);
    pageGrafik.appendChild(salaryInfo);
  } else {
    document.body.appendChild(shiftsList);
    document.body.appendChild(salaryInfo);
  }

  // Priemka containers (if not present in HTML, will be appended)
  const priemkaListElem = document.getElementById("priemkaList") || (function () {
    const el = document.createElement("div");
    el.id = "priemkaList";
    if (pagePriemka) pagePriemka.appendChild(el);
    else document.body.appendChild(el);
    return el;
  })();
  const priemkaMsgElem = document.getElementById("priemkaMessage") || (function () {
    const el = document.createElement("div");
    el.id = "priemkaMessage";
    el.style.marginTop = "10px";
    el.style.textAlign = "center";
    if (pagePriemka) pagePriemka.appendChild(el);
    else document.body.appendChild(el);
    return el;
  })();

  // --- helpers ---
  function dbg(...args) {
    if (!debug) return;
    const t = new Date().toLocaleTimeString();
    debug.innerText += `[${t}] ${args.map(a => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ")}\n`;
    console.log(...args);
  }

  function showMessage(text, cls) {
    if (!message) return;
    message.textContent = text || "";
    message.className = cls ? cls : "";
  }

  // --- tg.sendData helper (for writes) ---
  function sendViaTG(payload) {
    try {
      if (window.Telegram?.WebApp && typeof window.Telegram.WebApp.sendData === "function") {
        window.Telegram.WebApp.sendData(JSON.stringify(payload));
        dbg("sendData via TG:", payload);
        return true;
      }
    } catch (e) {
      dbg("sendViaTG error:", e);
    }
    return false;
  }

  // --- JSONP loader for GET (to avoid CORS) ---
  function loadJsonp(url, callbackName, onData, onError) {
    window[callbackName] = function (data) {
      try {
        onData && onData(data);
      } finally {
        // cleanup
        try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
        const s = document.getElementById(callbackName + "_script");
        if (s) s.remove();
      }
    };
    const script = document.createElement("script");
    script.id = callbackName + "_script";
    // do not double-add callback param if already
    script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + "callback=" + callbackName;
    script.onerror = function (e) {
      onError && onError(e);
      try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
      script.remove();
    };
    document.head.appendChild(script);
  }

  // --- Calendar build & helpers ---
  function createCalendarIfNeeded() {
    if (!calendar) return;
    if (calendar.children.length > 0) return;
    for (let day = 1; day <= 31; day++) {
      const cell = document.createElement("div");
      cell.className = "day";
      cell.textContent = day;
      cell.dataset.day = String(day);
      cell.onclick = () => handleDayClick(day, cell);
      calendar.appendChild(cell);
    }
  }

  function markCellByUser(cell, uid) {
    if (!cell) return;
    cell.classList.remove("blue", "green", "red", "yellow", "gray");
    const cls = userColors[uid] || "gray";
    cell.classList.add(cls);
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

  // --- LOAD DAYS via JSONP (uses doGet?action=getDays) ---
  function loadDays() {
    createCalendarIfNeeded();
    showMessage("Загрузка...", "");
    const cb = "cbDays_" + Date.now();
    const url = apiUrl + "?action=getDays";
    loadJsonp(url, cb, function (data) {
      dbg("JSONP getDays:", data);
      applyDaysData(data);
      renderShiftsList(data);
      loadSalary(); // will use JSONP as well
      showMessage("", "");
    }, function (err) {
      dbg("JSONP getDays failed:", err);
      // fallback to initDataUnsafe if available
      if (tg && tg.initDataUnsafe && Array.isArray(tg.initDataUnsafe.days)) {
        dbg("fallback to initDataUnsafe.days");
        applyDaysData(tg.initDataUnsafe.days);
        renderShiftsList(tg.initDataUnsafe.days);
        loadSalary();
        showMessage("", "");
        return;
      }
      showMessage("Не удалось загрузить данные (JSONP).", "error");
    });
  }

  // --- handle click (write) ---
  async function handleDayClick(day, cell) {
    if (!cell) return;
    const occupied = ["blue", "green", "red", "yellow"].some(c => cell.classList.contains(c));
    if (occupied) {
      if (cell.dataset.userId === String(userId)) {
        if (confirm("Удалить смену?")) {
          await deleteDay(day, cell);
        }
        return;
      }
      showMessage("Этот день уже занят!", "error");
      return;
    }

    const payload = { action: "addDay", userId, date: String(day) };

    // send via TG if possible (bypasses CORS)
    if (sendViaTG(payload)) {
      // optimistic UI: mark locally and ask user to wait for bot->GAS processing
      markCellByUser(cell, userId);
      showMessage("Смена отправлена (через TG).", "success");
      dbg("Optimistic addDay applied locally");
      return;
    }

    // fallback: try fetch POST (may fail due to CORS)
    try {
      dbg("POST addDay fallback ->", payload);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      dbg("POST response:", data);
      if (data && data.success) {
        markCellByUser(cell, userId);
        showMessage("Смена добавлена!", "success");
        loadDays();
      } else {
        showMessage(data?.error || "Ошибка при добавлении", "error");
      }
    } catch (err) {
      dbg("POST addDay failed:", err);
      showMessage("Ошибка сети при добавлении", "error");
    }
  }

  // --- deleteDay ---
  async function deleteDay(day, cell) {
    const payload = { action: "deleteDay", userId, date: String(day) };
    if (sendViaTG(payload)) {
      // optimistic
      cell.className = "day";
      delete cell.dataset.userId;
      showMessage("Запрос удаления отправлен через TG.", "success");
      return;
    }
    try {
      dbg("POST deleteDay fallback ->", payload);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data && data.success) {
        cell.className = "day";
        delete cell.dataset.userId;
        showMessage("Смена удалена!", "success");
        loadDays();
      } else {
        showMessage(data?.error || "Ошибка при удалении", "error");
      }
    } catch (err) {
      dbg("deleteDay failed:", err);
      showMessage("Ошибка сети при удалении", "error");
    }
  }

  // === Shifts list ===
  function renderShiftsList(data) {
    shiftsList.innerHTML = "<h3 style='margin:6px 0 8px 0; text-align:center;'>Мои смены</h3>";
    const myDays = Array.isArray(data) ? data.filter(d => String(d.userId) === String(userId)) : [];
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

  // === handleRevenueInput (write) ===
  async function handleRevenueInput(day) {
    const sum = prompt(`Введите выручку за ${day} число:`);
    if (sum === null) return;
    if (String(sum).trim() === "" || isNaN(Number(sum))) return alert("Введите корректное число!");
    const payload = { action: "addRevenue", userId, date: String(day), sum: Number(sum) };

    if (sendViaTG(payload)) {
      alert("Выручка отправлена через TG (ожидает обработки).");
      return;
    }

    try {
      dbg("POST addRevenue fallback ->", payload);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data && data.success) {
        alert("Выручка записана!");
        loadSalary();
        loadDays();
      } else {
        alert(data?.error || "Ошибка при записи выручки");
      }
    } catch (err) {
      dbg("addRevenue failed:", err);
      alert("Ошибка сети при записи выручки");
    }
  }

  // === loadSalary via JSONP (action=getSalary) ===
  function loadSalary() {
    const cb = "cbSalary_" + Date.now();
    const url = apiUrl + "?action=getSalary";
    loadJsonp(url, cb, function (data) {
      dbg("JSONP getSalary:", data);
      if (data && data.success) {
        if (userId === "578828973") salaryInfo.innerHTML = `<h3 style="text-align:center;">ЗП (Влад): ${data.salaryVlad}</h3>`;
        else if (userId === "951377763") salaryInfo.innerHTML = `<h3 style="text-align:center;">ЗП (Артур): ${data.salaryArtur}</h3>`;
        else salaryInfo.innerHTML = "";
      } else {
        salaryInfo.innerHTML = "";
      }
    }, function (err) {
      dbg("JSONP getSalary failed:", err);
      salaryInfo.innerHTML = "";
    });
  }

  // === Priemka load (JSONP) ===
  function loadPriemka() {
    const list = priemkaListElem;
    const msg = priemkaMsgElem;
    if (!list || !msg) return;
    list.innerHTML = "<p style='text-align:center;color:#666;margin:8px 0;'>Загрузка...</p>";
    msg.textContent = "";

    const cb = "cbPriemka_" + Date.now();
    const url = apiUrl + "?action=getPriemka";
    loadJsonp(url, cb, function (data) {
      dbg("JSONP getPriemka:", data);
      if (!data || !data.success) {
        list.innerHTML = `<p style='color:red;text-align:center;'>Ошибка: ${data?.error || "Неизвестный ответ"}</p>`;
        return;
      }
      const items = data.items || [];
      list.innerHTML = "";
      items.forEach((it, idx) => {
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
        input.max = 20;
        input.value = "";
        input.style.width = "64px";
        input.style.textAlign = "center";
        input.dataset.index = String(idx);

        input.addEventListener("input", () => {
          const target = Number(row.dataset.target);
          const val = Number(input.value);
          if (input.value === "") {
            row.style.backgroundColor = "";
            label.style.color = "";
          } else if (val === target) {
            row.style.backgroundColor = "#d1fae5";
            label.style.color = "#000";
          } else {
            row.style.backgroundColor = "";
            label.style.color = "#6b021a";
          }
          checkPriemkaCompletion();
        });

        row.appendChild(label);
        row.appendChild(input);
        list.appendChild(row);
      });
    }, function (err) {
      dbg("JSONP getPriemka failed:", err);
      list.innerHTML = `<p style='color:red;text-align:center;'>Ошибка загрузки приемки</p>`;
    });
  }

  function checkPriemkaCompletion() {
    const rows = document.querySelectorAll(".priemka-row");
    if (!rows || rows.length === 0) return;
    let allMatched = true;
    rows.forEach(r => {
      const input = r.querySelector("input");
      const target = Number(r.dataset.target);
      if (String(input.value).trim() === "" || Number(input.value) !== target) allMatched = false;
    });
    const msg = priemkaMsgElem;
    if (allMatched) {
      msg.textContent = "Приемка совпала!";
      msg.style.color = "green";
      // send message via TG if possible, otherwise try fetch (may fail CORS)
      const payload = { action: "sendPriemkaMessage" };
      if (sendViaTG(payload)) {
        dbg("sendPriemkaMessage sent via TG");
      } else {
        // fallback POST
        fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).then(r => r.json()).then(d => dbg("sendPriemkaMessage fallback:", d)).catch(e => dbg("sendPriemkaMessage fallback failed:", e));
      }
    } else {
      msg.textContent = "";
    }
  }

  // --- bottom tab switching (keeps existing setup) ---
  function setupTabSwitching() {
    const navButtons = document.querySelectorAll(".bottom-bar button[data-page]");
    if (!navButtons || navButtons.length === 0) return;
    navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const pageId = btn.getAttribute("data-page");
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        const target = document.getElementById(pageId);
        if (target) target.classList.add("active");
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

  // --- init ---
  function init() {
    createCalendarIfNeeded();
    setupTabSwitching();
    const activePage = document.querySelector(".page.active");
    if (activePage && activePage.id === "page-grafik") {
      loadDays();
    }
  }

  init();

})();
