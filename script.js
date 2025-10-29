// script.js — аккуратно интегрирован с вкладками и календарём
(function () {
  // Telegram
  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.expand === "function") tg.expand();

  const user = tg?.initDataUnsafe?.user || {};
  const userId = String(user.id || "");

  const apiUrl = "https://script.google.com/macros/s/AKfycbyM4dyFL7kaMSBe5U7viQXqKl2fSGphhx2psjGLCTFKnGHdsEKM8A7GmPLKjYeD9dgA/exec";

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
    // fallback, если структура другая
    document.body.appendChild(shiftsList);
    document.body.appendChild(salaryInfo);
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
    // классы можно использовать для стилизации success/error
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
