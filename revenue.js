const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || {};
const userId = String(user.id);

// URL Apps Script для работы с листом "Выручка"
const apiRevenueUrl = "https://script.google.com/macros/s/ВАШ_ID/exec";

// Кнопка для открытия второго календаря
const openRevenueBtn = document.getElementById("openRevenue");
const revenueWindow = document.getElementById("revenueWindow");
const calendarRevenue = document.getElementById("calendarRevenue");
const messageRevenue = document.getElementById("messageRevenue");
const debugRevenue = document.getElementById("debugRevenue");

openRevenueBtn.onclick = () => {
    revenueWindow.style.display = "block";
    loadRevenueDays();
};

// Генерация календаря для выручки (1–31)
for (let day = 1; day <= 31; day++) {
    const cell = document.createElement("div");
    cell.className = "dayRevenue";
    cell.textContent = day;
    cell.onclick = () => handleRevenueDayClick(day, cell);
    calendarRevenue.appendChild(cell);
}

// Загрузка уже введенной выручки
async function loadRevenueDays() {
    try {
        const res = await fetch(apiRevenueUrl);
        debugRevenue.innerText += `GET status: ${res.status}\n`;
        const data = await res.json();
        debugRevenue.innerText += `GET response: ${JSON.stringify(data)}\n`;

        data.forEach(item => {
            const cell = [...calendarRevenue.children][parseInt(item.day) - 1];
            if (!cell) return;
            if (item.value) {
                cell.style.border = "1px solid gray";
                cell.style.fontSize = "10px";
                cell.style.color = "gray";
                cell.textContent = `${item.day}\n${item.value}`;
            }
        });

        // Показ ЗП
        if (userId === "654321") messageRevenue.textContent = `ЗП Артур: ${data[0]?.salaryA || 0}`;
        else if (userId === "654323") messageRevenue.textContent = `ЗП Влад: ${data[0]?.salaryB || 0}`;
    } catch (err) {
        debugRevenue.innerText += `Ошибка при загрузке выручки: ${err}\n`;
    }
}

// Обработка клика по дню календаря выручки
async function handleRevenueDayClick(day, cell) {
    let value = prompt(`Введите выручку за ${day} число:`);
    if (value === null) return; // отмена

    const body = { day: String(day), value: value };

    try {
        const res = await fetch(apiRevenueUrl, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        debugRevenue.innerText += `POST status: ${res.status}\n`;
        const data = await res.json();
        debugRevenue.innerText += `POST response: ${JSON.stringify(data)}\n`;

        if (!data.success) {
            messageRevenue.textContent = data.error || "Ошибка при добавлении";
        } else {
            // Обновляем ячейку с рамкой и числом
            cell.style.border = "1px solid gray";
            cell.style.fontSize = "10px";
            cell.style.color = "gray";
            cell.textContent = `${day}\n${value}`;

            messageRevenue.textContent = "Выручка добавлена!";
        }

        // Обновляем ЗП
        if (userId === "654321") messageRevenue.textContent += ` | ЗП Артур: ${data.salaryA || 0}`;
        else if (userId === "654323") messageRevenue.textContent += ` | ЗП Влад: ${data.salaryB || 0}`;

    } catch (err) {
        debugRevenue.innerText += `Ошибка при добавлении выручки: ${err}\n`;
        messageRevenue.textContent = "Ошибка сети";
    }
}