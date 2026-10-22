# Zeroshi Portfolio — GitHub Pages Ready

Bản website tĩnh HTML/CSS/JS được xây trên giao diện Zero Shi gốc, có **10 project mẫu**, bộ lọc và **popup xem video YouTube/Vimeo**.

## Mở website

1. Giải nén ZIP.
2. Mở thư mục `ZeroShi-Portfolio-Ready` bằng VS Code.
3. Mở `index.html` bằng Live Server, Live Preview hoặc trình duyệt.
4. Bấm thumbnail để xem popup. Nếu chưa thêm ID video thật, popup thông báo **Video coming soon** (không tự tạo video giả).

## Thay tên, video, thumbnail

**Chỉ cần chỉnh file `projects.js`:**

- `displayName`, `greeting`, `role`, `description`, `email`: thông tin trang chủ và nút liên hệ.
- Với từng project, thay `title`, `category`, `year`, `thumbnail`, `description`, `tools`, `videoType`, `videoId`.
- `videoType`: `"youtube"` hoặc `"vimeo"`.
- YouTube: link như `https://www.youtube.com/watch?v=dQw4w9WgXcQ`, thì `videoId` là 11 ký tự sau `v=`. Đây chỉ là ví dụ định dạng, không được gắn sẵn làm video portfolio.
- Vimeo: link như `https://vimeo.com/123456789` thì `videoId` là chuỗi chữ số `123456789` (ví dụ định dạng).
- `thumbnail`: Ví dụ `assets/my-project.jpg`. Chép ảnh vào thư mục `assets/`, rồi điền đúng phần mở rộng `.jpg`, `.png`, `.webp` hoặc `.svg`.
- Mục lọc dùng `category: "compositing"`, `"motion"`, hoặc `"editing"`. Nếu chưa có video riêng, để `videoId: ""`.

## Sửa phần giới thiệu / lời cảm ơn

- Nội dung About Me và lời cảm ơn trong `index.html`, tìm `id="about"` và `id="contact"`.
- Mục **More Experiments** và **How I Work** đã được bỏ theo yêu cầu.
- Nút liên hệ chỉ hiển thị sau khi điền `email` thật trong `projects.js`. Không có email giả có thể gửi nhầm.

## Đưa lên GitHub Pages dạng repo dự án

1. Giữ nguyên tên repo, nhánh `main`, cài đặt Pages: `Deploy from a branch` → `main` → `/(root)`.
2. Backup file cũ của repo trước khi thay.
3. Upload **nội dung bên trong** thư mục `ZeroShi-Portfolio-Ready` lên gốc repo (đừng upload nguyên thư mục bao ngoài).
4. `index.html`, `styles.css`, `script.js`, `projects.js` phải nằm ngay ở root; `assets/` là thư mục con.
5. Nếu repo hiện có `CNAME` của tên miền riêng, giữ nguyên file đó; không tự ý thay DNS hoặc Settings → Pages.
6. Vào Actions đợi deploy xong và mở `https://username.github.io/repository-name/`.

Đường dẫn CSS, JS và ảnh đều **tương đối**, phù hợp với `/repository-name/`.

## Lưu ý

- Đây là **bản cấu hình lại từ template gốc trong cuộc trò chuyện**, không phải một bản copy chính xác mọi thay đổi m đã làm trên máy trong VS Code. Các thumbnail SVG hiện là ảnh mẫu.
- Popup giữ người xem ở nguyên trang và nguyên vị trí cuộn khi đóng.
- Video YouTube/Vimeo cần được bật quyền embed trên nền tảng tương ứng.
- Bộ ZIP **không có video portfolio thật hoặc email cá nhân**; m cần điền vào `projects.js`.
