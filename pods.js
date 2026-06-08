/* ============================================================
   pods.js  ·  Cấu hình dùng chung cho hệ thống kén N1 / N2
   - Danh sách kén (mỗi khu 5 kén)
   - Thông tin khu vực
   - Bảng giá theo thời lượng
   - Thời gian giữ chỗ
   ============================================================ */

// Hai khu vực
const KEN_ZONES = {
    N1: { code: "N1", name: "Thư viện · Tầng 9",   desc: "Tầng 9" },
    N2: { code: "N2", name: "Phòng tự học · Trệt", desc: "Tầng trệt" }
};

// 10 kén: mỗi khu 5 kén
const KEN_PODS = [
    "N1-01", "N1-02", "N1-03", "N1-04", "N1-05",
    "N2-01", "N2-02", "N2-03", "N2-04", "N2-05"
];

// Giá dịch vụ theo thời lượng (bản demo tính bằng GIÂY) — VNĐ
const KEN_POD_PRICE = { 15: 4000, 30: 8000, 45: 10000 };

// Giữ chỗ trong 30 giây (theo yêu cầu)
const KEN_RESERVE_HOLD_MS = 30 * 1000;

// Kén DUY NHẤT nối với mạch ESP thật (cảm biến + servo). Các kén khác là giả lập.
const KEN_HARDWARE_POD = "N1-01";

function kenZoneOf(podId) { return podId.slice(0, 2); }       // "N1-03" -> "N1"
function kenPriceOf(seconds) { return KEN_POD_PRICE[seconds] || 4000; }
function kenZoneLabel(podId) {
    const z = KEN_ZONES[kenZoneOf(podId)];
    return z ? z.name : "";
}
