const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || {};
const userId = String(user.id); // обязательно строка

const apiUrl = "https://script.google.com/macros/s/AKfycbzHpdlvADP0UxzavvlriKX1dUSjju0QrvIaDFYmqzeHl36WeXfrgiMlrRrsuUHZnT9Q/exec";

// Цвета закреплены за конкретными ID
const userColors = {
  "654321": "blue",
  "654323": "green",
  "298802988": "red",
  "222222": "yellow"
};

const calendar = document.getElementById("calendar");
const message = document.getElementById("message");
const debug = document.getElementById("debug");

// Генерация календаря
for (let day = 1; day <= 31; day++) {
  const cell = document.createElement("div");
  cell.className = "day";
  cell.textContent = day;
  cell.onclick = () => handleDayClick(day, cell);
  calendar.appendChild(cell);
}

// Загрузка уже выбранных дней
async function loadDays() {
  try {
    const res = await fetch(apiUrl);
    debug.innerText += `GET status: ${res.status}\n`;
    const data = await res.json();
    debug.innerText += `GET response: ${JSON.stringify(data)}\n`;

    data.forEach(item => {
      const cell = [...calendar.children][parseInt(item.date) - 1];
      if (!cell) return;
      const color = userColors[item.userId] || "gray"; // чужой или неизвестный ID
      cell.classList.add(color);
    });
  } catch (err) {
    debug.innerText += `Ошибка при загрузке дней: ${err}\n`;
  }
}

// Обработка клика по дню
async function handleDayClick(day, cell) {
  if (cell.classList.contains("blue") || cell.classList.contains("green") ||
      cell.classList.contains("red") || cell.classList.contains("yellow")) {
    message.textContent = "Этот день уже занят!";
    return;
  }

  const body = { userId, date: String(day) };

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    debug.innerText += `POST status: ${res.status}\n`;
    const data = await res.json();
    debug.innerText += `POST response: ${JSON.stringify(data)}\n`;
    
    if (!data.success) {
      message.textContent = data.error || "Ошибка при добавлении";
    } else {
      // красим день только в цвет текущего пользователя
      cell.classList.add(userColors[userId] || "blue");
      message.textContent = "Смена добавлена!";
    }
  } catch (err) {
    debug.innerText += `Ошибка при добавлении дня: ${err}\n`;
    message.textContent = "Ошибка сети";
  }
}

loadDays();
