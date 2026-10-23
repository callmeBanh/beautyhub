const retry = document.getElementById("retry");
const connection = document.getElementById("connection");
retry.addEventListener("click", () => location.reload());
function update() {
  connection.textContent = navigator.onLine ? "Thiết bị có kết nối mạng. Bạn có thể thử tải lại." : "Thiết bị đang ngoại tuyến.";
}
window.addEventListener("online", update);
window.addEventListener("offline", update);
update();
