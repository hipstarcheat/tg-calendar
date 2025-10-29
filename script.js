// script.js — интеграция вкладок, календаря и раздела "Приемка"
(function () {
  // Telegram
  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.expand === "function") tg.expand();

  const user = tg?.initDataUnsafe?.user || {};
  const userId = String(user.id || "");

  const apiUrl = "https://script.google.com/macros/s/AKfycbzyfkP53tVjkz61FdwcmhynfgLgRf3_tr4J6lB5-h1j4BbOAJ0KgQKxygu6zf9ZeYjL/exec";

  const userColors = {
    "951377763": "blue",
    "578828973": "green",
    "298802988": "red",
    "222222": "yellow"
  };

  const calendar = document.getElementById("calendar");
  const message = document.getElementById("message");
  const debug = document.getElementById("debug");

  // контейнеры вкладки "График"
  const pageGrafik = document.getElementById("page-grafik");

  // создаём блоки для списка смен и ЗП внутри вкладки "График"
  const shiftsList = document.createElement("div");
  shiftsList.id = "shiftsList";
  shiftsList.style.marginTop = "12px";
  const salaryInfo = document.createElement("div");
  salaryInfo.id = "salaryInfo";
  salaryInfo.style.marginTop = "12px";

  // вставим их под календарём внутри страницы "График"
  if (pageGrafik) {
    pageGrafik.appendChild(shiftsList);
    pageGrafik.appendChild(salaryInfo);
  } else {
    document.body.appendChild(shiftsList);
    document.body.appendChild(salaryInfo);
  }

  // Приемка: контейнер (вкладка "Приемка" в index.html называется page-acceptance)
  const pagePriemka = document.getElementById("page-acceptance");
  const priemkaListContainer = document.createElement("div");
  priemkaListContainer.id = "priemkaList";
  priemkaListContainer.style.marginTop = "8px";
  const priemkaMessage = document.createElement("div");
  priemkaMessage.id = "priemkaMessage";
  priemkaMessage.style.marginTop = "10px";
  priemkaMessage.style.textAlign = "center";
  if (pagePriemka) {
    pagePriemka.appendChild(priemkaListContainer);
    pagePriemka.appendChild(priemkaMessage);
  } else {
    document.body.appendChild(priemkaListContainer);
    document.body.appendChild(priemkaMessage);
  }

  // --- Утилиты debug / UI ---
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

  // --- Создаём календарь (один раз) ---
  function createCalendarIfNeeded() {
    if (!calendar) return;
    if (calendar.children.length > 0) return; // уже создан
    for (let day = 1; day <= 31; day++) {
      const cell = document.createElement("div");
      cell.className = "day";
      cell.textContent = day;
      cell.dataset.day = String(day);
      cell.onclick = () => handleDayClick(day, cell);
      calendar.appendChild(cell);
    }
  }

  // --- Закрашивание ячейки ---
  function markCellByUser(cell, uid) {
    if (!cell) return;
    cell.classList.remove("blue", "green", "red", "yellow", "gray");
    const cls = userColors[uid] || "gray";
    cell.classList.add(cls);
    cell.dataset.userId = String(uid);
  }

  // --- Применение массива дней в календарь ---
  function applyDaysData(items) {
    if (!Array.isArray(items)) {
      dbg("applyDaysData: неверный формат", items);
      return;
    }
    // очистка всех
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

  // --- Загрузка дней (fetch) с fallback на initDataUnsafe ---
  async function loadDays() {
    createCalendarIfNeeded();
    showMessage("Загрузка...", "");
    // Попытка через fetch (если apiUrl задан)
    if (apiUrl) {
      try {
        dbg("Попытка GET ->", apiUrl);
        const res = await fetch(apiUrl, { method: "GET", cache: "no-store" });
        dbg("GET status:", res.status);
        if (!res.ok) throw new Error("Status " + res.status);
        const data = await res.json();
        dbg("GET response:", data);
        applyDaysData(data);
        renderShiftsList(data);
        await loadSalary(); // обновим ЗП
        showMessage("", "");
        return;
      } catch (err) {
        dbg("fetch GET failed:", err);
        // попробуем fallback ниже
      }
    } else {
      dbg("apiUrl не указан, пропускаем fetch");
    }

    // fallback: tg.initDataUnsafe.days
    if (tg && tg.initDataUnsafe && Array.isArray(tg.initDataUnsafe.days)) {
      dbg("Используем initDataUnsafe.days:", tg.initDataUnsafe.days);
      applyDaysData(tg.initDataUnsafe.days);
      renderShiftsList(tg.initDataUnsafe.days);
      await loadSalary();
      showMessage("", "");
      return;
    }

    // ничего не получилось
    showMessage("Нет данных: проверь деплой GAS и URL в настройках WebApp бота.", "error");
    dbg("Нет данных для загрузки (fetch и initDataUnsafe отсутствуют).");
  }

  // --- Обработка клика по дню ---
  async function handleDayClick(day, cell) {
    if (!cell) return;
    const occupied = ["blue", "green", "red", "yellow"].some(c => cell.classList.contains(c));
    if (occupied) {
      // если занят текущим пользователем — дать опцию удалить
      if (cell.dataset.userId === String(userId)) {
        if (confirm("Удалить смену?")) {
          await deleteDay(day, cell);
        }
        return;
      }
      showMessage("Этот день уже занят!", "error");
      return;
    }

    const body = { action: "addDay", userId, date: String(day) };

    // Отправляем POST
    try {
      dbg("POST addDay ->", body);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      dbg("POST response:", data);
      if (data && data.success) {
        markCellByUser(cell, userId);
        showMessage("Смена добавлена!", "success");
        await loadDays();
      } else {
        showMessage(data?.error || "Ошибка при добавлении", "error");
      }
    } catch (err) {
      dbg("POST addDay failed:", err);
      showMessage("Ошибка сети при добавлении", "error");
    }
  }

  // --- Удаление смены ---
  async function deleteDay(day, cell) {
    const body = { action: "deleteDay", userId, date: String(day) };
    try {
      dbg("POST deleteDay ->", body);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      dbg("delete response:", data);
      if (data && data.success) {
        cell.className = "day";
        delete cell.dataset.userId;
        showMessage("Смена удалена!", "success");
        await loadDays();
      } else {
        showMessage(data?.error || "Ошибка при удалении", "error");
      }
    } catch (err) {
      dbg("deleteDay failed:", err);
      showMessage("Ошибка сети при удалении", "error");
    }
  }

  // === СПИСОК СМЕН ===
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

  // === ВВОД ВЫРУЧКИ ===
  async function handleRevenueInput(day) {
    const sum = prompt(`Введите выручку за ${day} число:`);
    if (sum === null) return; // отмена
    if (String(sum).trim() === "" || isNaN(Number(sum))) return alert("Введите корректное число!");
    const body = { action: "addRevenue", userId, date: String(day), sum: Number(sum) };
    try {
      dbg("POST addRevenue ->", body);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      dbg("addRevenue response:", data);
      if (data && data.success) {
        alert("Выручка записана!");
        await loadSalary();
        await loadDays(); // обновим отображение (если используется поле revenue)
      } else {
        alert(data?.error || "Ошибка при записи выручки");
      }
    } catch (err) {
      dbg("addRevenue failed:", err);
      alert("Ошибка сети при записи выручки");
    }
  }

  // === ЗАГРУЗКА ЗП (getSalary) ===
  async function loadSalary() {
    try {
      const body = { action: "getSalary" };
      dbg("POST getSalary ->", body);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      dbg("getSalary response:", data);
      if (data && data.success) {
        if (userId === "578828973") salaryInfo.innerHTML = `<h3 style="text-align:center;">ЗП (Влад): ${data.salaryVlad}</h3>`;
        else if (userId === "951377763") salaryInfo.innerHTML = `<h3 style="text-align:center;">ЗП (Артур): ${data.salaryArtur}</h3>`;
        else salaryInfo.innerHTML = "";
      } else {
        salaryInfo.innerHTML = "";
      }
    } catch (err) {
      dbg("loadSalary failed:", err);
      salaryInfo.innerHTML = "";
    }
  }

  // === ПРИЕМКА ===
  async function loadPriemka() {
    const list = document.getElementById("priemkaList");
    const msg = document.getElementById("priemkaMessage");
    if (!list || !msg) return;
    list.innerHTML = "<p style='text-align:center;color:#666;margin:8px 0;'>Загрузка...</p>";
    msg.textContent = "";

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getPriemka" })
      });
      const data = await res.json();
      dbg("getPriemka response:", data);
      if (!data || !data.success) throw new Error(data?.error || "Ошибка загрузки Приемки");

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
            row.style.backgroundColor = "#d1fae5"; // зелёный фон
            label.style.color = "#000";
          } else {
            row.style.backgroundColor = "";
            label.style.color = "#6b021a"; // бордовый текст
          }
          checkPriemkaCompletion();
        });

        row.appendChild(label);
        row.appendChild(input);
        list.appendChild(row);
      });

    } catch (err) {
      dbg("loadPriemka failed:", err);
      list.innerHTML = `<p style='color:red;text-align:center;'>Ошибка: ${err.message}</p>`;
    }
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

    const msg = document.getElementById("priemkaMessage");
    if (allMatched) {
      msg.textContent = "Приемка совпала!";
      msg.style.color = "green";
      sendPriemkaSuccess(); // шлём уведомление через GAS
    } else {
      msg.textContent = "";
    }
  }

  async function sendPriemkaSuccess() {
    try {
      dbg("POST sendPriemkaMessage ->");
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendPriemkaMessage" })
      });
      const data = await res.json();
      dbg("sendPriemkaMessage response:", data);
      // не критично, просто логируем
    } catch (err) {
      dbg("sendPriemkaMessage failed:", err);
    }
  }

  // --- Переключение вкладок (нижний бар) ---
  function setupTabSwitching() {
    const navButtons = document.querySelectorAll(".bottom-bar button[data-page]");
    if (!navButtons || navButtons.length === 0) return;
    navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const pageId = btn.getAttribute("data-page");
        // переключаем активную страницу
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        const target = document.getElementById(pageId);
        if (target) target.classList.add("active");
        // переключаем класс active у кнопок
        document.querySelectorAll(".bottom-bar button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // если перешли на график — обновим календарь
        if (pageId === "page-grafik") {
          createCalendarIfNeeded();
          loadDays();
        }
        // если перешли на приемку — загрузим Приемку
        if (pageId === "page-acceptance") {
          loadPriemka();
        }
      });
    });
  }

  // --- Инициализация ---
  function init() {
    createCalendarIfNeeded();
    setupTabSwitching();
    // если первая вкладка активна — загрузим сразу
    const activePage = document.querySelector(".page.active");
    if (activePage && activePage.id === "page-grafik") {
      loadDays();
    }
  }

  // запускаем
  init();

})();
