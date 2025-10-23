const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || {};

const apiUrl = "https://script.google.com/macros/s/YOUR_SCRIPT_URL/exec";

// Привязка цветов к userId
const userColors = {
  "123456": "blue", // Артур
  "654321": "green" // Влад
};

const calendar = document.getElementById("calendar");
const message = document.getElementById("message");

// Генерация простого календаря (1–31)
for (let day = 1; day <= 31; day++) {
  const cell = document.createElement("div");
  cell.className = "day";
  cell.textContent = day;
  cell.onclick = () => handleDayClick(day, cell);
  calendar.appendChild(cell);
}

async function loadDays() {
  const res = await fetch(apiUrl);
  const data = await res.json();

  data.forEach(item => {
    const cell = [...calendar.children][parseInt(item.date) - 1];
    if (!cell) return;
    const color =
      userColors[item.userId] ||
      (item.userId === "999" ? "red" : "yellow");
    cell.classList.add(color);
  });
}

async function handleDayClick(day, cell) {
  if (cell.classList.contains("blue") || cell.classList.contains("green") ||
      cell.classList.contains("red") || cell.classList.contains("yellow")) {
    message.textContent = "Этот день уже занят!";
    return;
  }

  const body = { userId: user.id, date: String(day) };
  const res = await fetch(apiUrl, { method: "POST", body: JSON.stringify(body) });
  const text = await res.text();

  if (text === "ERROR_DAY_TAKEN") {
    message.textContent = "День уже занят!";
  } else {
    const color = userColors[user.id] || "yellow";
    cell.classList.add(color);
    message.textContent = "Смена добавлена!";
  }
}

loadDays();
