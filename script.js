const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || {};
const userId = user.id; // уникальный ID Telegram
const apiUrl = "https://script.google.com/macros/s/AKfycbzSy0h3uWURmz9wdGOqbRYx73ciayzXVTyIX5YcIL-tzi0ZJZfrAwi2WIaXvn2cGbqK/exec"; // например, https://script.google.com/macros/s/xxx/exec

// Привязка цветов к userId
const userColors = {
  [userId]: "blue", // текущий пользователь
  "654321": "green",
  "111111": "red",
  "222222": "yellow"
};

const calendar = document.getElementById("calendar");
const message = document.getElementById("message");

// Генерация календаря 1–31
for (let day = 1; day <= 31; day++) {
  const cell = document.createElement("div");
  cell.className = "day";
  cell.textContent = day;
  cell.onclick = () => handleDayClick(day, cell);
  calendar.appendChild(cell);
}

async function loadDays() {
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    data.forEach(item => {
      const cell = [...calendar.children][parseInt(item.date) - 1];
      if (!cell) return;
      const color = userColors[item.userId] || "gray";
      cell.classList.add(color);
    });
  } catch (err) {
    console.error("Ошибка при загрузке дней:", err);
  }
}

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
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!data.success) {
      message.textContent = data.error || "Ошибка при добавлении";
    } else {
      const color = userColors[userId] || "blue";
      cell.classList.add(color);
      message.textContent = "Смена добавлена!";
    }
  } catch (err) {
    console.error("Ошибка при добавлении дня:", err);
    message.textContent = "Ошибка сети";
  }
}

loadDays();