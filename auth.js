/* ============================================================
   auth.js  ·  Tiện ích dùng chung cho hệ thống Kén Ngủ V2
   - Cấu hình Firebase
   - Băm mật khẩu (SHA-256 + salt) trước khi lưu / so sánh
   - Kiểm tra hợp lệ tên đăng nhập & mật khẩu (chỉ Latin + số)
   - Cổng bảo vệ phiên đăng nhập cho từng trang
   ============================================================ */

// Cấu hình Firebase Realtime Database (dùng chung mọi trang)
const KEN_FIREBASE_CONFIG = {
    databaseURL: "https://kennguv-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const KenAuth = (function () {
    const SALT = "KenNguV2::salt::2026";

    // Mật khẩu mặc định của tài khoản Admin (bất di bất dịch) khi hệ thống khởi tạo lần đầu
    const ADMIN_DEFAULT_PASSWORD = "A@a123";
    // Mật khẩu mặc định cho mọi tài khoản mới do Admin thêm vào
    const NEW_USER_DEFAULT_PASSWORD = "123456";

    // Chỉ cho phép chữ Latin (a-z, A-Z) và số (0-9). Độ dài 1..30.
    // Loại bỏ mọi ký tự đặc biệt, khoảng trắng, dấu tiếng Việt.
    const CREDENTIAL_REGEX = /^[A-Za-z0-9]{1,30}$/;

    function isValidCredential(str) {
        return typeof str === "string" && CREDENTIAL_REGEX.test(str);
    }

    // MSSV = đúng 11 chữ số (dùng làm tên đăng nhập của sinh viên)
    function isValidMSSV(str) { return /^\d{11}$/.test(str); }
    // Số điện thoại = 10 hoặc 11 chữ số
    function isValidPhone(str) { return /^\d{10,11}$/.test(str); }
    // Họ tên = chữ (có dấu) và khoảng trắng, 2..50 ký tự
    function isValidName(str) { return /^[\p{L}][\p{L} ]{1,49}$/u.test(str.trim()); }

    // Ẩn danh tính sinh viên cho người khác xem: "SV" + 3 số đầu + x...
    function maskStudent(mssv) {
        const s = String(mssv || "");
        if (s.length <= 3) return "SV" + s;
        return "SV" + s.slice(0, 3) + "x".repeat(s.length - 3);
    }

    // Băm mật khẩu bằng SHA-256 (Web Crypto). Có fallback FNV cho ngữ cảnh không bảo mật.
    async function hashPassword(plain) {
        const data = new TextEncoder().encode(SALT + plain);
        if (window.crypto && crypto.subtle && crypto.subtle.digest) {
            try {
                const buf = await crypto.subtle.digest("SHA-256", data);
                const hex = Array.from(new Uint8Array(buf))
                    .map(b => b.toString(16).padStart(2, "0")).join("");
                return "sha256$" + hex;
            } catch (e) { /* rơi xuống fallback */ }
        }
        // Fallback (FNV-1a) - dùng khi crypto.subtle không khả dụng
        let h = 0x811c9dc5;
        const s = SALT + plain;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = (h * 0x01000193) >>> 0;
        }
        return "fnv$" + h.toString(16);
    }

    // ===== Cổng bảo vệ phiên =====
    // Yêu cầu đã đăng nhập (bất kỳ vai trò nào). Nếu chưa -> về trang login.
    function requireLogin() {
        if (!sessionStorage.getItem("user_name")) {
            window.location.href = "index22.html";
            return false;
        }
        return true;
    }

    // Yêu cầu quyền truy cập Dashboard (Admin hoặc đã được cấp quyền dashboard).
    function requireDashboard() {
        if (!requireLogin()) return false;
        const role = sessionStorage.getItem("user_role");
        const perm = sessionStorage.getItem("perm_dashboard");
        if (role !== "admin" && perm !== "true") {
            alert("Cảnh báo bảo mật: Bạn không có quyền truy cập Dashboard này!");
            window.location.href = "booking.html";
            return false;
        }
        return true;
    }

    // Yêu cầu quyền Admin (chỉ tài khoản quản trị). Dùng cho trang admin.html.
    function requireAdmin() {
        if (!requireLogin()) return false;
        if (sessionStorage.getItem("user_role") !== "admin") {
            alert("Cảnh báo bảo mật: Chỉ Admin mới được truy cập trang quản lý!");
            window.location.href = "booking.html";
            return false;
        }
        return true;
    }

    function logout() {
        sessionStorage.clear();
        window.location.href = "index22.html";
    }

    // Theo dõi quyền Dashboard của CHÍNH tài khoản đang đăng nhập (realtime).
    // Admin cấp/thu hồi -> cập nhật ngay, không cần đăng xuất/đăng nhập lại.
    // onChange(canDashboard) được gọi mỗi khi quyền thay đổi.
    function watchPermissions(database, onChange) {
        const role = sessionStorage.getItem("user_role");
        const uname = sessionStorage.getItem("user_name");
        if (!uname || role === "admin") return; // Admin luôn đầy quyền, không cần theo dõi
        database.ref('accounts/' + uname).on('value', snap => {
            // Nếu tài khoản bị xóa -> buộc đăng xuất
            if (!snap.exists()) { logout(); return; }
            const can = snap.child('dashboard').val() === true;
            sessionStorage.setItem("perm_dashboard", can ? "true" : "false");
            if (typeof onChange === "function") onChange(can);
        });
    }

    // ===== Điều hướng =====
    // Trang chủ theo vai trò: Admin -> home.html (trang tổng quan 3 mục), user -> booking.html.
    function homeUrl() {
        return sessionStorage.getItem("user_role") === "admin" ? "home.html" : "booking.html";
    }

    function goHome() {
        window.location.href = homeUrl();
    }

    // Quay lại trang trước; nếu không có lịch sử thì về trang chủ.
    function goBack() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            goHome();
        }
    }

    return {
        ADMIN_DEFAULT_PASSWORD,
        NEW_USER_DEFAULT_PASSWORD,
        isValidCredential,
        isValidMSSV,
        isValidPhone,
        isValidName,
        maskStudent,
        hashPassword,
        requireLogin,
        requireDashboard,
        requireAdmin,
        logout,
        watchPermissions,
        homeUrl,
        goHome,
        goBack
    };
})();
