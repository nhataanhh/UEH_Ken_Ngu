#include <WiFi.h>
#include <Firebase_ESP_Client.h>   // THƯ VIỆN MỚI (ổn định, không lỗi SSL như FirebaseESP32 cũ)
#include <ESP32Servo.h>

// 1. CẤU HÌNH WI-FI & FIREBASE
#define WIFI_SSID     "ThanhHuy"
#define WIFI_PASSWORD "Nghia!@#123"

// Host database hệ thống kén V2 (BỎ https:// và dấu / ở cuối)
#define FIREBASE_HOST "kennguv-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "test_mode_secret"   // database secret bất kỳ (rules đang mở)

// Node riêng cho kén phần cứng N1-01 (9 kén còn lại là giả lập, check-in tay trên web)
#define POD_PATH "/pods/N1-01"

// 2. CHÂN PHẦN CỨNG
const int chanCamBien   = 25;
const int chanLedBlynk  = 2;
const int chanServo     = 4;
const int led2Chau      = 18;
const int trafficRed    = 19;
const int trafficYellow = 22;
const int trafficGreen  = 21;

Servo cuaKen;
FirebaseData   fbdo;
FirebaseAuth   auth;
FirebaseConfig config;

String kenStatus     = "available";
String lastKenStatus = "available";
String trangThaiInGanNhat = "";
int    duration      = 15;

// Các mốc thời gian (millis) để chạy KHÔNG-BLOCKING -> không đơ/giật
unsigned long thoiGianQuetMang      = 0;
unsigned long thoiGianBatCamBien    = 0;
unsigned long thoiGianBatDauDemNguoc = 0;
unsigned long thoiGianBatDauGiuCho  = 0;
const unsigned long GIU_CHO_TOI_DA_MS = 35000;   // tự huỷ giữ chỗ sau 35s nếu không ai đặt ĐT (web giữ 30s)
int  lastCountdownPushed = -1;
bool dangChoQuayServo    = false;

// Đặt toàn bộ đèn về trạng thái TRỐNG (xanh) — gom 1 chỗ cho gọn
void denTrong() {
  digitalWrite(led2Chau, HIGH);
  digitalWrite(trafficGreen, HIGH);
  digitalWrite(trafficYellow, LOW);
  digitalWrite(trafficRed, LOW);
  digitalWrite(chanLedBlynk, LOW);
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.printf("\n[BOOT] Ly do reset: %d | RAM trong: %u bytes\n", (int)esp_reset_reason(), ESP.getFreeHeap());

  pinMode(chanCamBien, INPUT);
  pinMode(chanLedBlynk, OUTPUT);
  pinMode(led2Chau, OUTPUT);
  pinMode(trafficRed, OUTPUT);
  pinMode(trafficYellow, OUTPUT);
  pinMode(trafficGreen, OUTPUT);

  denTrong();
  cuaKen.attach(chanServo);
  cuaKen.write(0);   // cửa mở mặc định

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Dang ket noi Wi-Fi...");
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(chanLedBlynk, HIGH); delay(250);
    digitalWrite(chanLedBlynk, LOW);  delay(250);
    Serial.print(".");
  }
  digitalWrite(chanLedBlynk, HIGH);
  Serial.println("\nWi-Fi da ket noi thanh cong!");
  delay(1000);
  digitalWrite(chanLedBlynk, LOW);

  // Liên kết Firebase bằng API thư viện MỚI
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.reconnectWiFi(true);
  Firebase.begin(&config, &auth);

  Serial.println("==> Firebase.begin() xong. Node dieu khien: " + String(POD_PATH));
}

// Giải phóng kén về TRỐNG (dùng khi hết giờ ngủ hoặc hết hạn giữ chỗ)
void traVeTrong(const char* lyDo) {
  Serial.print("==> Tra ve TRONG: "); Serial.println(lyDo);
  cuaKen.write(0);
  denTrong();
  if (Firebase.ready()) {
    Firebase.RTDB.setString(&fbdo, String(POD_PATH) + "/status", "available");
    Firebase.RTDB.setInt(&fbdo,    String(POD_PATH) + "/countdown", 0);
    Firebase.RTDB.setString(&fbdo, String(POD_PATH) + "/user", "");
    Firebase.RTDB.setString(&fbdo, String(POD_PATH) + "/mssv", "");
    Firebase.RTDB.setString(&fbdo, String(POD_PATH) + "/booking_owner", "");
  }
  kenStatus = "available";
  lastKenStatus = "available";
}

void loop() {
  // Đọc trạng thái định kỳ mỗi 300ms (KHÔNG đọc khi đang busy để tránh nhồi hàng đợi mạng)
  if (Firebase.ready() && (millis() - thoiGianQuetMang > 300)) {
    thoiGianQuetMang = millis();
    if (kenStatus != "busy") {
      if (Firebase.RTDB.getString(&fbdo, String(POD_PATH) + "/status")) {
        if (fbdo.dataType() == "string") kenStatus = fbdo.stringData();
      } else {
        Serial.print("[LOI DOC status] "); Serial.println(fbdo.errorReason());
      }
      if (Firebase.RTDB.getInt(&fbdo, String(POD_PATH) + "/duration")) {
        if (fbdo.dataType() == "int") duration = fbdo.intData();
      }
      if (kenStatus != trangThaiInGanNhat) {
        trangThaiInGanNhat = kenStatus;
        Serial.print(">> Web bao trang thai: "); Serial.print(kenStatus);
        Serial.print(" | goi: "); Serial.print(duration); Serial.println("s");
      }
    }
  }

  // Đổi đèn VÀNG tức khắc khi web vừa bấm đặt giữ chỗ
  if (kenStatus != lastKenStatus) {
    if (kenStatus == "reserved") {
      digitalWrite(led2Chau, HIGH);
      digitalWrite(trafficGreen, LOW);
      digitalWrite(trafficYellow, HIGH);
      digitalWrite(trafficRed, LOW);
      digitalWrite(chanLedBlynk, LOW);
      cuaKen.write(0);
      thoiGianBatDauGiuCho = millis();   // bắt đầu đếm hạn giữ chỗ
      Serial.println("==> DA DAT KEN N1-01: Len den VANG lap tuc!");
    }
    lastKenStatus = kenStatus;
  }

  // TRẠNG THÁI 1: TRỐNG (xanh)
  if (kenStatus == "available") {
    denTrong();
    cuaKen.write(0);
    if (digitalRead(chanCamBien) == LOW) kichHoatKhoaKen();
  }
  // TRẠNG THÁI 2: ĐÃ ĐẶT — chờ khách đến (vàng)
  else if (kenStatus == "reserved") {
    digitalWrite(led2Chau, HIGH);
    digitalWrite(trafficGreen, LOW);
    digitalWrite(trafficYellow, HIGH);
    digitalWrite(trafficRed, LOW);
    digitalWrite(chanLedBlynk, LOW);

    if (digitalRead(chanCamBien) == LOW) {
      kichHoatKhoaKen();
    }
    // Tự giải phóng nếu giữ chỗ quá hạn mà không ai đặt ĐT vào (chống kẹt "Đã đặt" mãi)
    else if (millis() - thoiGianBatDauGiuCho > GIU_CHO_TOI_DA_MS) {
      traVeTrong("Het han giu cho, khong ai dat DT vao");
    }
  }
  // TRẠNG THÁI 3: ĐANG DÙNG — đếm ngược (đỏ)
  else if (kenStatus == "busy") {
    // Pha 1: chờ 3 giây an toàn để người dùng rút tay ra
    if (dangChoQuayServo) {
      if (millis() - thoiGianBatCamBien >= 3000) {
        dangChoQuayServo = false;
        cuaKen.write(180);   // đóng chốt
        delay(600);
        digitalWrite(chanLedBlynk, LOW);
        thoiGianBatDauDemNguoc = millis();
        lastCountdownPushed = -1;   // ép đẩy giá trị đầu ngay
      }
    }
    // Pha 2: đếm ngược theo ĐỒNG HỒ THỰC (không trừ dần -> không giãn khi mạng nghẽn)
    else {
      unsigned long daTroiQua = (millis() - thoiGianBatDauDemNguoc) / 1000;
      int conLai = duration - (int)daTroiQua;
      if (conLai < 0) conLai = 0;

      if (conLai > 0) {
        // Chỉ đẩy lên Firebase khi số giây đổi -> giảm tối đa lần gọi mạng (chống đơ)
        if (conLai != lastCountdownPushed) {
          lastCountdownPushed = conLai;
          if (Firebase.ready()) Firebase.RTDB.setInt(&fbdo, String(POD_PATH) + "/countdown", conLai);
          Serial.printf("Ken N1-01 con lai: %d giay\n", conLai);
        }
      } else {
        traVeTrong("Het gio ngu");
        Serial.println("==> 4 giay an toan de rut may...");
        delay(4000);   // cooldown chống đọc trùng tín hiệu cảm biến cũ
      }
    }
  }
}

// Cảm biến phát hiện vật -> khoá kén, chuyển sang busy
void kichHoatKhoaKen() {
  kenStatus = "busy";
  lastKenStatus = "busy";

  if (Firebase.ready()) {
    if (!Firebase.RTDB.setString(&fbdo, String(POD_PATH) + "/status", "busy"))
      Serial.print("[LOI GHI busy] "), Serial.println(fbdo.errorReason());
    else
      Serial.println(">> Da ghi status=busy len Firebase OK.");
  }

  digitalWrite(trafficYellow, LOW);
  digitalWrite(trafficGreen, LOW);
  digitalWrite(trafficRed, HIGH);
  digitalWrite(led2Chau, LOW);
  digitalWrite(chanLedBlynk, HIGH);

  thoiGianBatCamBien = millis();
  dangChoQuayServo = true;
  Serial.println("==> CAM BIEN KICH HOAT KEN N1-01! Chuyen mau DO.");
}
