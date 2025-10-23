const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || {};
const userId = user.id;

const apiUrl = "https://script.google.com/macros/s/AKfycbzSy0h3uWURmz9wdGOqbRYx73ciayzXVTyIX5YcIL-tzi0ZJZfrAwi2WIaXvn2cGbqK/exec";

const userColors = {
  "654321": "blue",
  "654323": "green",
  "298802988": "red",
  "222222": "yellow"
};

const calendar = document.getElementById("calendar");
const message = document.getElementById("message");
const debug = document.getElementById("debug"); // новый блок для ошибок

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
    debug.innerText += `GET status: ${res.status}\n`;
    const data = await res.json();
    debug.innerText += `GET response: ${JSON.stringify(data)}\n`;
    data.forEach(item => {
      const cell = [...calendar.children][parseInt(item.date) - 1];
      if (!cell) return;
      const color = userColors[item.userId] || "gray";
      cell.classList.add(color);
    });
  } catch (err) {
    debug.innerText += `Ошибка при загрузке дней: ${err}\n`;
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
    debug.innerText += `POST status: ${res.status}\n`;
    const data = await res.json();
    debug.innerText += `POST response: ${JSON.stringify(data)}\n`;
    
    if (!data.success) {
      message.textContent = data.error || "Ошибка при добавлении";
    } else {
      cell.classList.add(userColors[userId] || "blue");
      message.textContent = "Смена добавлена!";
    }
  } catch (err) {
    debug.innerText += `Ошибка при добавлении дня: ${err}\n`;
    message.textContent = "Ошибка сети";
  }
}

loadDays();