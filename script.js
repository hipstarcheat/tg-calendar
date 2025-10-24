const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || {};
const userId = String(user.id);

const apiUrl = "https://script.google.com/macros/s/AKfycbxNyQxEMVethlRTZIWac0asTZJZ8BfxPng4YC3KqIr6F7dmM3Lg9CGMuZpkXYSPdusI/exec";

const userColors = {
  "951377763": "blue",
  "578828973": "green",
  "298802988": "red",
  "222222": "yellow"
};

const calendar = document.getElementById("calendar");
const message = document.getElementById("message");
const debug = document.getElementById("debug");

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
      cell.dataset.userId = item.userId; // запомним владельца дня
      cell.classList.add(color);
    });
  } catch (err) {
    debug.innerText += `Ошибка при загрузке дней: ${err}\n`;
  }
}

async function handleDayClick(day, cell) {
  const isOccupied =
    cell.classList.contains("blue") ||
    cell.classList.contains("green") ||
    cell.classList.contains("red") ||
    cell.classList.contains("yellow");

  // если день занят
  if (isOccupied) {
    // если это твоя смена — предлагаем удалить
    if (cell.dataset.userId === String(userId)) {
      const confirmDelete = confirm("Удалить смену?");
      if (confirmDelete) await deleteDay(day, cell);
      return;
    }

    message.textContent = "Этот день уже занят!";
    return;
  }

  // иначе — добавляем новую смену
  const body = { action: "addDay", userId, date: String(day) };

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
      cell.dataset.userId = userId;
      message.textContent = "Смена добавлена!";
    }
  } catch (err) {
    debug.innerText += `Ошибка при добавлении дня: ${err}\n`;
    message.textContent = "Ошибка сети";
  }
}

async function deleteDay(day, cell) {
  const body = { action: "deleteDay", userId, date: String(day) };

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      body: JSON.stringify(body)
    });
    debug.innerText += `DELETE status: ${res.status}\n`;
    const data = await res.json();
    debug.innerText += `DELETE response: ${JSON.stringify(data)}\n`;

    if (data.success) {
      cell.className = "day"; // убираем цвет
      delete cell.dataset.userId;
      message.textContent = "Смена удалена!";
    } else {
      message.textContent = data.error || "Ошибка при удалении";
    }
  } catch (err) {
    debug.innerText += `Ошибка при удалении дня: ${err}\n`;
    message.textContent = "Ошибка сети";
  }
}

loadDays();
