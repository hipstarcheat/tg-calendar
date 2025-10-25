const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || {};
const userId = String(user.id);

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

const shiftsList = document.createElement("div");
const salaryInfo = document.createElement("div");
document.body.appendChild(shiftsList);
document.body.appendChild(salaryInfo);

// генерация календаря
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
      cell.dataset.userId = item.userId;
      cell.classList.add(color);
    });

    renderShiftsList(data);
    loadSalary();
  } catch (err) {
    debug.innerText += `Ошибка при загрузке: ${err}\n`;
  }
}

// обработка клика по дню
async function handleDayClick(day, cell) {
  const isOccupied = Object.values(userColors).some(c => cell.classList.contains(c));

  if (isOccupied) {
    if (cell.dataset.userId === String(userId)) {
      const confirmDelete = confirm("Удалить смену?");
      if (confirmDelete) await deleteDay(day, cell);
      return;
    }
    message.textContent = "Этот день уже занят!";
    return;
  }

  const body = { action: "addDay", userId, date: String(day) };

  const res = await fetch(apiUrl, { method: "POST", body: JSON.stringify(body) });
  const data = await res.json();

  if (data.success) {
    cell.classList.add(userColors[userId] || "blue");
    cell.dataset.userId = userId;
    message.textContent = "Смена добавлена!";
    loadDays();
  } else message.textContent = data.error || "Ошибка";
}

// удаление смены
async function deleteDay(day, cell) {
  const body = { action: "deleteDay", userId, date: String(day) };
  const res = await fetch(apiUrl, { method: "POST", body: JSON.stringify(body) });
  const data = await res.json();

  if (data.success) {
    cell.className = "day";
    delete cell.dataset.userId;
    message.textContent = "Смена удалена!";
    loadDays();
  } else message.textContent = data.error || "Ошибка";
}

// === СПИСОК СМЕН ===
function renderShiftsList(data) {
  const myDays = data.filter(d => d.userId === userId);
  shiftsList.innerHTML = "<h3>Мои смены:</h3>";

  myDays.forEach(d => {
    const btn = document.createElement("button");
    btn.textContent = `День ${d.date} | Выручка: ${d.revenue || 0}`;
    btn.onclick = () => handleRevenueInput(d.date);
    shiftsList.appendChild(btn);
  });
}


// === ВВОД ВЫРУЧКИ ===
async function handleRevenueInput(day) {
  const sum = prompt(`Введите выручку за ${day} число:`);

  if (!sum || isNaN(sum)) return alert("Введите число!");

  const body = {
    action: "addRevenue",
    userId,
    date: String(day),
    sum: Number(sum)
  };

  const res = await fetch(apiUrl, {
    method: "POST",
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (data.success) {
    alert("Выручка записана!");
    loadSalary();
  } else alert(data.error || "Ошибка при записи");
}

// === ЗАГРУЗКА ЗП ===
async function loadSalary() {
  const body = { action: "getSalary" };
  const res = await fetch(apiUrl, { method: "POST", body: JSON.stringify(body) });
  const data = await res.json();

  if (data.success) {
    if (userId === "298802988")
      salaryInfo.innerHTML = `<h3>ЗП (Влад): ${data.salaryVlad}</h3>`;
    else if (userId === "578828973")
      salaryInfo.innerHTML = `<h3>ЗП (Артур): ${data.salaryArtur}</h3>`;
    else salaryInfo.innerHTML = "";
  }
}

loadDays();
