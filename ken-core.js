/* ============================================================
   ken-core.js · Bản DEMO (chạy phía trình duyệt)
   Gộp 3 tính năng: Telegram thông báo, Ví trả trước, Chống spam.
   ⚠️ Nạp SAU firebase + pods.js (cần kenPriceOf). Chỉ dùng cho demo:
      token để lộ ở client, dữ liệu có thể bị chỉnh tay vì rules đang mở.
   ============================================================ */

// ===== Cấu hình Telegram =====
const KEN_TELEGRAM = {
    token:  "8649637780:AAFCABsuFTXJ6LWGPZFUNL-OBkTreVZWGbg",
    chatId: "-5198166728"
};

const KenTele = (function () {
    let _enabled = true;   // CÔNG TẮC: bật/tắt gửi Telegram (đồng bộ qua config/telegramEnabled)

    // Lắng nghe công tắc từ Firebase (Admin bật/tắt -> mọi máy áp dụng ngay)
    function init(db) {
        try {
            db.ref("config/telegramEnabled").on("value", function (s) {
                const v = s.val();
                _enabled = (v === null ? true : v !== false); // mặc định BẬT nếu chưa cấu hình
            });
        } catch (e) { console.error("KenTele.init:", e); }
    }
    function isEnabled() { return _enabled; }
    function setEnabled(db, on) { db.ref("config/telegramEnabled").set(!!on); }

    // Gửi tin nhắn Telegram bằng GET (request đơn giản -> không bị CORS preflight chặn).
    function send(text) {
        if (!_enabled) return Promise.resolve();   // công tắc TẮT -> không gửi gì cả
        const url = "https://api.telegram.org/bot" + KEN_TELEGRAM.token + "/sendMessage" +
            "?chat_id=" + encodeURIComponent(KEN_TELEGRAM.chatId) +
            "&parse_mode=HTML" +
            "&text=" + encodeURIComponent(text);
        return fetch(url, { mode: "no-cors" }).catch(e => console.error("Telegram lỗi:", e));
    }
    // Gửi DUY NHẤT 1 lần theo key — dùng transaction để nhiều máy mở web cũng không gửi trùng
    function sendOnce(db, key, text) {
        if (!_enabled) return;                     // tắt thì khỏi đụng DB luôn
        db.ref("tg_sent/" + key).transaction(
            cur => (cur === null ? true : undefined),
            (err, committed) => { if (!err && committed) send(text); }
        );
    }
    return { init: init, isEnabled: isEnabled, setEnabled: setEnabled, send: send, sendOnce: sendOnce };
})();

// ===== Ví trả trước =====
const KenWallet = {
    // Trừ tiền 1 lượt dùng (idempotent theo key nhờ node 'charged/<key>' + transaction số dư)
    charge: function (db, usageKey, mssv, price) {
        if (!db || !usageKey || !mssv || mssv === "Admin") return; // Admin không trừ tiền
        db.ref("charged/" + usageKey).transaction(
            cur => (cur ? undefined : true),
            (err, committed) => {
                if (err || !committed) return; // máy khác đã/đang tính -> bỏ qua
                db.ref("accounts/" + mssv + "/balance").transaction(b => (b || 0) - (price || 0));
            }
        );
    },
    // Báo Telegram khi 1 đơn HOÀN THÀNH (check-out xong) — chỉ 1 lần.
    // Đọc số dư hiện tại từ DB để hiển thị chính xác (không phụ thuộc nơi gọi).
    notifyDone: function (db, usageKey, info) {
        const mssv = info.mssv || "";
        // Đơn rác: kén bị dùng mà KHÔNG qua đặt chỗ (không có người đặt) -> bỏ qua hoàn toàn
        if (!mssv) return;
        // Đơn do ADMIN đặt -> chỉ là test, KHÔNG tính doanh thu
        if (mssv === "Admin") {
            KenTele.sendOnce(db, "done_" + usageKey,
                "🧪 <b>ĐƠN TEST (Admin)</b> — không tính doanh thu\n" +
                "Kén: <b>" + info.pod + "</b>\n" +
                "Gói: " + info.durationSec + " giây · " + (info.price || 0).toLocaleString("vi-VN") + "đ");
            return;
        }
        db.ref("accounts/" + mssv + "/balance").once("value").then(function (snap) {
            const balText = (mssv && mssv !== "Admin")
                ? ((Number(snap.val()) || 0).toLocaleString("vi-VN") + "đ") : "—";
            const txt =
                "✅ <b>ĐƠN HOÀN THÀNH</b>\n" +
                "Kén: <b>" + info.pod + "</b>\n" +
                "Người dùng: " + info.user + " (MSSV " + mssv + ")\n" +
                "Gói: " + info.durationSec + " giây · " + (info.price || 0).toLocaleString("vi-VN") + "đ\n" +
                "Số dư còn: " + balText;
            KenTele.sendOnce(db, "done_" + usageKey, txt);
        });
    },

    // Báo Telegram khi Admin NẠP TIỀN cho 1 tài khoản
    notifyTopup: function (mssv, amount, newBalance, by) {
        KenTele.send(
            "💰 <b>NẠP TIỀN</b>\n" +
            "Tài khoản: <b>" + mssv + "</b>\n" +
            "Nạp thêm: +" + (amount || 0).toLocaleString("vi-VN") + "đ\n" +
            "Số dư mới: <b>" + (Number(newBalance) || 0).toLocaleString("vi-VN") + "đ</b>\n" +
            "Bởi: " + (by || "Admin")
        );
    }
};

// ===== Chống spam đặt/huỷ + auto-ban =====
const KenBan = {
    WINDOW_MS: 5 * 60 * 1000,   // cửa sổ 5 phút
    THRESHOLD: 5,               // 5 lần đặt-huỷ
    TEMP_MS:   60 * 1000,       // khoá tạm 1 phút (lần đầu)

    // Ghi 1 "điểm spam" cho mssv (idempotent theo reserveAt) rồi đánh giá ngưỡng
    recordStrike: function (db, mssv, reserveAt, podId) {
        if (!db || !mssv || !reserveAt || mssv === "Admin") return; // Admin không bị tính spam
        db.ref("strikes/" + mssv + "/r" + reserveAt).transaction(
            cur => (cur ? undefined : { at: Date.now(), pod: podId || "" }),
            (err, committed) => { if (!err && committed) KenBan.evaluate(db, mssv); }
        );
    },

    // Đếm điểm spam trong 5 phút gần nhất -> quyết định khoá
    evaluate: function (db, mssv) {
        db.ref("strikes/" + mssv).once("value").then(function (snap) {
            const now = Date.now();
            const all = snap.val() || {};
            const recent = Object.values(all).filter(s => s && s.at && (now - s.at) < KenBan.WINDOW_MS);
            if (recent.length < KenBan.THRESHOLD) return;

            db.ref("accounts/" + mssv).once("value").then(function (aSnap) {
                const acc = aSnap.val();
                if (!acc || acc.banned) return; // không có tài khoản hoặc đã khoá cứng
                const stage = acc.banStage || 0;
                if (stage < 1) {
                    // Lần đầu: cảnh báo + khoá tạm 1 phút
                    db.ref("accounts/" + mssv).update({
                        banStage: 1, bannedUntil: now + KenBan.TEMP_MS, banReason: "Spam đặt/huỷ liên tục"
                    });
                    db.ref("strikes/" + mssv).remove(); // reset để cần 5 lần mới tiếp theo
                    KenTele.send("⚠️ <b>CẢNH BÁO SPAM</b>\nTài khoản <b>" + mssv + "</b> đặt/huỷ " +
                                 recent.length + " lần trong 5 phút.\n→ Tạm khoá 1 phút.");
                } else {
                    // Tái phạm sau khi đã bị cảnh báo: khoá cho tới khi Admin gỡ
                    db.ref("accounts/" + mssv).update({
                        banned: true, bannedUntil: null, banReason: "Tái phạm spam — cần Admin gỡ khoá"
                    });
                    db.ref("strikes/" + mssv).remove();
                    KenTele.send("⛔ <b>KHOÁ TÀI KHOẢN</b>\n<b>" + mssv + "</b> tái phạm spam sau khi đã bị cảnh báo.\n→ Khoá đến khi Admin gỡ.");
                }
            });
        });
    },

    // Trạng thái chặn của 1 account object (null = không bị chặn)
    blockState: function (acc) {
        if (!acc) return null;
        if (acc.banned) return { perm: true, msg: "Tài khoản đã bị khoá do spam hệ thống. Vui lòng liên hệ Admin để mở lại." };
        if (acc.bannedUntil && Date.now() < acc.bannedUntil) {
            const sec = Math.ceil((acc.bannedUntil - Date.now()) / 1000);
            return { perm: false, msg: "Tài khoản đang bị tạm khoá do spam. Thử lại sau " + sec + " giây." };
        }
        return null;
    },

    // Admin gỡ khoá: xoá mọi cờ ban + điểm spam
    adminUnban: function (db, mssv) {
        db.ref("accounts/" + mssv).update({ banned: false, bannedUntil: null, banStage: 0, banReason: null });
        db.ref("strikes/" + mssv).remove();
    }
};
