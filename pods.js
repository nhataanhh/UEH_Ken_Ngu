/* ============================================================
   pods.js  ·  Cấu hình dùng chung cho hệ thống kén N1 / N2
   - Danh sách kén (mỗi khu 5 kén)
   - Thông tin khu vực
   - Bảng giá theo thời lượng
   - Thời gian giữ chỗ
   ============================================================ */

// Một khu vực duy nhất: N2 — Phòng tự học
const KEN_ZONES = {
    N2: { code: "N2", name: "Phòng tự học · Trệt", desc: "Tầng trệt" }
};

// 13 kén, tất cả thuộc khu N2
const KEN_PODS = [
    "N2-01", "N2-02", "N2-03", "N2-04", "N2-05",
    "N2-06", "N2-07", "N2-08", "N2-09", "N2-10",
    "N2-11", "N2-12", "N2-13"
];

// Giá dịch vụ theo thời lượng (bản demo tính bằng GIÂY) — VNĐ
const KEN_POD_PRICE = { 20: 6000, 30: 8000, 45: 10000 };

// Thời gian giữ chỗ: 20 giây cho MỌI người (admin lẫn sinh viên đều như nhau)
const KEN_RESERVE_HOLD_MS = 20 * 1000;
function kenHoldMs(role) { return KEN_RESERVE_HOLD_MS; } // giữ hàm để các trang khác gọi không lỗi

// Kén DUY NHẤT nối với mạch ESP thật (cảm biến + servo). Các kén khác là giả lập.
const KEN_HARDWARE_POD = "N2-01";

function kenZoneOf(podId) { return podId.slice(0, 2); }       // "N1-03" -> "N1"
function kenPriceOf(seconds) { return KEN_POD_PRICE[seconds] || 6000; }
function kenZoneLabel(podId) {
    const z = KEN_ZONES[kenZoneOf(podId)];
    return z ? z.name : "";
}
