// === Telegram Mini App и календарь ===
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { id: "0", username: "Неизвестен" };

// 🔗 URL твоего Google Apps Script (должен быть типа https://script.google.com/macros/s/AKfycb.../exec)
const apiUrl = "https://script.google.com/macros/s/AKfycbwzCCGv-zM_7BFb_E0N4MnHmy_vBQmujcaxGU0lO3cTu8zVMU3klbFTxrza13lcbV-Y/exec";

// 🔹 Цвета пользователей (по user.id Telegram)
const userColors = {
  "298802988": "blue",  // Артур
  "654321": "green"  // Влад
};

// 🔹 Элементы DOM
const calendar = document.getElementById("calendar");
const message = document.getElementById("message");
const legend = document.getElementById("legend");

// === Генерация простого календаря (1–31) ===
for (let day = 1; day <= 31; day++) {
  const cell = document.createElement("div");
  cell.className = "day";
  cell.textContent = day;
  cell.onclick = () => handleDayClick(day, cell);
  calendar.appendChild(cell);
}

// === Загрузка данных из таблицы ===
async function loadDays() {
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    data.forEach(item => {
      const dayNum = parseInt(item.date);
      const cell = calendar.children[dayNum - 1];
      if (!cell) return;

      const color =
        userColors[String(item.userId)] ||
        (item.userId === "999" ? "red" : "yellow");
      cell.classList.add(color);
    });
  } catch (err) {
    console.error("Ошибка при загрузке дней:", err);
  }
}

// === Обработка клика по дню ===
async function handleDayClick(day, cell) {
  if (cell.classList.contains("blue") || cell.classList.contains("green") ||
      cell.classList.contains("red") || cell.classList.contains("yellow")) {
    message.textContent = "Этот день уже занят!";
    return;
  }

  try {
    const body = { userId: String(user.id), date: String(day) };
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.status === "ERROR_DAY_TAKEN") {
      message.textContent = "День уже занят!";
    } else {
      const color = userColors[String(user.id)] || "yellow";
      cell.classList.add(color);
      message.textContent = "Смена добавлена!";
    }
  } catch (err) {
    console.error("Ошибка при добавлении дня:", err);
    message.textContent = "Ошибка при добавлении дня!";
  }
}

// === Легенда ===
legend.innerHTML = `
  <div class="legend-item"><div class="legend-color blue"></div> Артур</div>
  <div class="legend-item"><div class="legend-color green"></div> Влад</div>
  <div class="legend-item"><div class="legend-color red"></div> Пользователь 3</div>
  <div class="legend-item"><div class="legend-color yellow"></div> Пользователь 4</div>
`;

// === Инициализация ===
loadDays();