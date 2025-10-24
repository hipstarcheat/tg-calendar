const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || {};
const userId = String(user.id);

const userColors = {
  "654321": "blue",
  "654323": "green",
  "298802988": "red",
  "222222": "yellow"
};

const userNames = {
  "654321": "Артур",
  "654323": "Влад",
  "298802988": "Управляющий",
  "1": "Замена"
};

const calendar = document.getElementById("calendar");
const message = document.getElementById("message");
const debug = document.getElementById("debug");
const legendContainer = document.getElementById("legend");

// Генерация календаря
for (let day = 1; day <= 31; day++) {
  const cell = document.createElement("div");
  cell.className = "day";
  cell.textContent = day;
  cell.onclick = () => handleDayClick(day, cell);
  calendar.appendChild(cell);
}

// Генерация легенды
for (const id in userColors) {
  const block = document.createElement("div");

  const colorBox = document.createElement("span");
  colorBox.className = "color-box";
  colorBox.style.backgroundColor = userColors[id];

  const label = document.createElement("span");
  label.textContent = userNames[id];

  block.appendChild(colorBox);
  block.appendChild(label);
  legendContainer.appendChild(block);
}

// Обработка клика по дню
function handleDayClick(day, cell) {
  if (cell.classList.contains("blue") || cell.classList.contains("green") ||
      cell.classList.contains("red") || cell.classList.contains("yellow")) {
    message.textContent = "Этот день уже занят!";
    return;
  }

  const payload = { action: "addDay", userId, date: day };
  tg.sendData(JSON.stringify(payload));
  debug.innerText += `Отправлено через TG WebApp: ${JSON.stringify(payload)}\n`;

  // локальное отображение
  cell.classList.add(userColors[userId] || "blue");
  message.textContent = "Смена добавлена (локально)";
}

// Загрузка дней
function loadDays(days) {
  // days = [{ userId: "298802988", date: 5 }, ...]
  days.forEach(item => {
    const cell = [...calendar.children][item.date - 1];
    if (!cell) return;
    const color = userColors[item.userId] || "gray";
    cell.classList.add(color);
  });
  debug.innerText += `Загружены дни: ${JSON.stringify(days)}\n`;
}

// Автоматическая инициализация, если GAS передал дни через initData
if (tg.initDataUnsafe && tg.initDataUnsafe.days) {
  loadDays(tg.initDataUnsafe.days);
}
