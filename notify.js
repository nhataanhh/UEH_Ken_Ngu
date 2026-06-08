/* ============================================================
   notify.js  ·  Thông báo pop-up (toast) — CHỈ dành cho Admin
   Hiện ~3 giây rồi tự biến mất khi có sự kiện:
   đặt kén / hủy giữ chỗ / check-in / check-out.
   Nội dung: Tên · MSSV · Trạng thái · Kén.
   ============================================================ */
const KenNotify = (function () {
    let ready = false, started = false, styled = false;

    function injectStyle() {
        if (styled) return; styled = true;
        const css =
        '#ken-toast-wrap{position:fixed;top:18px;right:18px;z-index:99999;display:flex;flex-direction:column;gap:10px;max-width:340px}' +
        '.ken-toast{background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:12px 14px;display:flex;gap:10px;align-items:flex-start;border-left:4px solid #007aff;animation:kenToastIn .25s ease;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
        '.ken-toast.out{animation:kenToastOut .35s ease forwards}' +
        '.ken-toast .kt-ic{font-size:20px;margin-top:1px}' +
        '.ken-toast .kt-title{font-size:14px;font-weight:700;color:#1c1c1e}' +
        '.ken-toast .kt-sub{font-size:12px;color:#636366;margin-top:2px}' +
        '.ken-toast .kt-st{font-size:12px;font-weight:700;margin-top:3px}' +
        '@keyframes kenToastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}' +
        '@keyframes kenToastOut{to{opacity:0;transform:translateX(40px)}}';
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    }

    function wrap() {
        let w = document.getElementById('ken-toast-wrap');
        if (!w) { w = document.createElement('div'); w.id = 'ken-toast-wrap'; document.body.appendChild(w); }
        return w;
    }

    function statusInfo(status) {
        switch (status) {
            case 'reserved':  return { t: 'Vừa đặt kén',    c: '#ff9500', i: 'ti-calendar-plus' };
            case 'cancelled': return { t: 'Đã hủy giữ chỗ', c: '#86868b', i: 'ti-trash-x' };
            case 'busy':      return { t: 'Đã check-in',    c: '#ff3b30', i: 'ti-login-2' };
            case 'completed': return { t: 'Đã check-out',   c: '#34c759', i: 'ti-logout-2' };
            default:          return { t: status || 'Cập nhật', c: '#007aff', i: 'ti-bell' };
        }
    }

    function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

    function show(d) {
        if (!d) return;
        injectStyle();
        const info = statusInfo(d.status);
        const el = document.createElement('div');
        el.className = 'ken-toast';
        el.style.borderLeftColor = info.c;
        el.innerHTML =
            '<i class="ti ' + info.i + ' kt-ic" style="color:' + info.c + '"></i>' +
            '<div>' +
              '<div class="kt-title">' + esc(d.user || '—') + '</div>' +
              '<div class="kt-sub">MSSV: ' + esc(d.mssv || '—') + ' · Kén ' + esc(d.pod || '') + '</div>' +
              '<div class="kt-st" style="color:' + info.c + '">' + info.t + '</div>' +
            '</div>';
        wrap().appendChild(el);
        setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 3000);
    }

    // Gọi sau khi đã initializeApp Firebase. Chỉ Admin mới nhận thông báo.
    function init(database) {
        if (started) return; started = true;
        if (sessionStorage.getItem('user_role') !== 'admin') return;
        const ref = database.ref('activity_log');
        // Bỏ qua dữ liệu có sẵn lúc tải trang, chỉ báo sự kiện mới phát sinh sau đó
        ref.once('value').then(() => { ready = true; });
        ref.on('child_added',   s => { if (ready) show(s.val()); });
        ref.on('child_changed', s => { if (ready) show(s.val()); });
    }

    return { init, show };
})();
